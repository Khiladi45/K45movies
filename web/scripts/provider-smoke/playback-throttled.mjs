import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [output, dependencyRoot, executablePath] = process.argv.slice(2);
const ffmpeg = process.env.K45_FFMPEG_PATH;
if (!output || !dependencyRoot || !ffmpeg) throw new Error("Set K45_FFMPEG_PATH and pass output, Playwright root and optional Chrome path.");
const { chromium } = createRequire(join(dependencyRoot, "package.json"))("playwright");
const appRequire = createRequire(import.meta.url);
const hlsScript = appRequire.resolve("hls.js/dist/hls.min.js");
const directory = await mkdtemp(join(tmpdir(), "k45-throttled-"));
let server;
let browser;
const throttle = { offline: false, latency: 80, downloadThroughput: 1_000_000, uploadThroughput: 375_000 };
try {
  const mp4 = join(directory, "fixture.mp4");
  const encode = (args) => execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", ...args]);
  encode(["-f", "lavfi", "-i", "testsrc2=size=1920x1080:rate=30", "-f", "lavfi", "-i", "sine=frequency=440",
    "-t", "32", "-c:v", "libx264", "-preset", "ultrafast", "-b:v", "2M", "-maxrate", "3M", "-bufsize", "4M",
    "-g", "60", "-keyint_min", "60", "-sc_threshold", "0", "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart", mp4]);
  encode(["-i", mp4, "-c", "copy", "-hls_time", "2", "-hls_playlist_type", "vod", join(directory, "index.m3u8")]);
  const types = { mp4: "video/mp4", m3u8: "application/vnd.apple.mpegurl", ts: "video/mp2t", js: "text/javascript" };
  server = createServer(async (request, response) => {
    const name = request.url?.slice(1);
    if (!name) return response.end('<!doctype html><video muted playsinline></video><script src="/hls.min.js"></script>');
    if (!/^(fixture\.mp4|index\.m3u8|index\d+\.ts|hls\.min\.js)$/.test(name)) return response.writeHead(404).end();
    const path = name === "hls.min.js" ? hlsScript : join(directory, name);
    try {
      const { size } = await stat(path);
      const range = /^bytes=(\d+)-(\d*)$/.exec(request.headers.range ?? "");
      const start = range ? Number(range[1]) : 0;
      const end = range?.[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
      if (start > end) return response.writeHead(416, { "Content-Range": "bytes */" + size }).end();
      const headers = { "Content-Type": types[name.split(".").at(-1)], "Accept-Ranges": "bytes", "Content-Length": end - start + 1 };
      if (range) headers["Content-Range"] = "bytes " + start + "-" + end + "/" + size;
      response.writeHead(range ? 206 : 200, headers);
      const stream = createReadStream(path, { start, end });
      response.on("close", () => stream.destroy());
      stream.on("error", () => response.destroy());
      stream.pipe(response);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
  const address = "http://127.0.0.1:" + server.address().port;
  browser = await chromium.launch({ executablePath, args: ["--autoplay-policy=no-user-gesture-required"] });
  const results = [];
  for (const format of ["MP4", "HLS"]) {
    const page = await browser.newPage();
    await page.goto(address);
    const network = await page.context().newCDPSession(page);
    await network.send("Network.enable");
    await network.send("Network.setCacheDisabled", { cacheDisabled: true });
    await network.send("Network.emulateNetworkConditions", throttle);
    const sample = await page.evaluate(async (format) => {
      const video = document.querySelector("video");
      const waitFor = (predicate) => new Promise((resolve, reject) => {
        const started = performance.now();
        const timer = setInterval(() => {
          if (predicate()) { clearInterval(timer); resolve(performance.now()); }
          else if (video.error || performance.now() - started > 25_000) {
            clearInterval(timer);
            reject(new Error(video.error?.message || "Decoded playback deadline"));
          }
        }, 30);
      });
      const start = performance.now();
      if (format === "MP4") video.src = "/fixture.mp4";
      else {
        const hls = new window.Hls();
        hls.loadSource("/index.m3u8");
        hls.attachMedia(video);
      }
      void video.play();
      const startup = await waitFor(() => video.videoHeight && video.currentTime >= 0.2);
      const target = 24;
      const bufferedAtSeek = Array.from({ length: video.buffered.length }, (_, index) => index)
        .some((index) => target >= video.buffered.start(index) && target <= video.buffered.end(index));
      const seek = performance.now();
      video.currentTime = target;
      const resumed = await waitFor(() => !video.seeking && video.currentTime >= target + 0.2);
      const before = video.getVideoPlaybackQuality();
      const position = video.currentTime;
      await new Promise((resolve) => setTimeout(resolve, 5000));
      const after = video.getVideoPlaybackQuality();
      return {
        startupMs: Math.round(startup - start), seekMs: Math.round(resumed - seek), bufferedAtSeek,
        width: video.videoWidth, height: video.videoHeight, playedSeconds: Number((video.currentTime - position).toFixed(2)),
        measuredFrames: after.totalVideoFrames - before.totalVideoFrames, droppedFrames: after.droppedVideoFrames - before.droppedVideoFrames,
      };
    }, format);
    assert.equal(sample.height, 1080);
    assert.equal(sample.bufferedAtSeek, false);
    assert.ok(sample.measuredFrames > 0);
    results.push({ format, ...sample });
    await page.close();
  }
  await writeFile(output, JSON.stringify({ browser: browser.version(), codecs: "H.264 and AAC", throttle,
    fixture: "Local HTTP with byte ranges. Chrome native MP4 and the website's hls.js dependency.",
    timing: "Startup and seek include the first 0.2 seconds of playback.", results }, null, 2) + "\n");
} finally {
  await browser?.close();
  server?.close();
  await rm(directory, { recursive: true, force: true });
}
