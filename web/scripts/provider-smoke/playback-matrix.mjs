import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { promisify } from "node:util";

const [output, dependencyRoot, executablePath] = process.argv.slice(2);
if (!output || !dependencyRoot) throw new Error("Usage: node scripts/provider-smoke/playback-matrix.mjs OUTPUT.json PLAYWRIGHT_ROOT [CHROME_EXE]");
const { chromium, firefox } = createRequire(join(dependencyRoot, "package.json"))("playwright");
const site = new URL(process.env.K45_SMOKE_SITE_URL || "http://127.0.0.1:3194");
const ffprobe = process.env.K45_SMOKE_FFPROBE;
const ids = process.env.K45_PLAYBACK_PROVIDERS?.split(",") ?? [
  "vega", "4khdhub", "hdhub4u", "anikoto", "animeworld", "castle", "autoEmbed", "movieBoxWeb",
  "hdmovieslife", "1flex", "1tamilblasters", "kickAssAnime", "movielinkdb", "luxMovies", "moviezwap", "movieswood", "kmMovies",
];
const clients = [
  ["Chromium", await chromium.launch({ executablePath, args: ["--autoplay-policy=no-user-gesture-required"] })],
  ["Firefox", await firefox.launch({ firefoxUserPrefs: { "media.autoplay.default": 0 } })],
];
let cookie;
async function provider(id, op, params = {}) {
  const url = new URL("/api/proxy/providers", site);
  url.search = new URLSearchParams({ id, op, ...params });
  const response = await fetch(url, { signal: AbortSignal.timeout(40_000), headers: cookie ? { Cookie: cookie } : undefined });
  cookie ??= response.headers.getSetCookie().find((line) => line.startsWith("k45-provider-client="))?.split(";")[0];
  const payload = await response.json();
  if (!response.ok) throw Error(op + ": " + payload.error);
  return payload;
}

async function inspect(url) {
  if (!ffprobe) return;
  try {
    const { stdout } = await promisify(execFile)(ffprobe, [
      "-v", "error", "-protocol_whitelist", "http,https,tcp,tls,crypto",
      "-probesize", "262144", "-analyzeduration", "1500000", "-show_entries",
      "format=format_name:stream=codec_type,codec_name,profile", "-of", "json", url.href,
    ], { timeout: 9000 });
    const data = JSON.parse(stdout);
    return { container: data.format?.format_name, codecs: [...new Set(data.streams?.filter((track) => ["audio", "video"].includes(track.codec_type)).map((track) => track.codec_name))] };
  } catch { return { error: "ffprobe failed or timed out" }; }
}

async function playback(browser, url, hls) {
  const page = await browser.newPage();
  try {
    const samplePage = new URL("/__phase3_playback_sample", site).href;
    await page.route(samplePage, (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><video muted playsinline></video>" }));
    let httpStatus;
    page.on("response", (response) => { if (response.url() === url.href) httpStatus = response.status(); });
    await page.goto(samplePage);
    if (hls) await page.addScriptTag({ path: resolve("node_modules/hls.js/dist/hls.min.js") });
    const result = await page.evaluate(async ({ url, hls }) => {
      const video = document.querySelector("video");
      const start = performance.now();
      let fatal;
      let engine;
      if (hls && window.Hls?.isSupported()) {
        engine = new window.Hls({ manifestLoadingMaxRetry: 0, levelLoadingMaxRetry: 0, fragLoadingMaxRetry: 0 });
        engine.on(window.Hls.Events.ERROR, (_, event) => { if (event.fatal) fatal = event.details; });
        engine.loadSource(url);
        engine.attachMedia(video);
      } else video.src = url;
      void video.play().catch((error) => { fatal = video.error ? undefined : error.name; });
      while (performance.now() - start < 13_000 && !video.error && !fatal && (!video.videoWidth || video.currentTime < 0.5)) {
        await new Promise((done) => setTimeout(done, 100));
      }
      const result = {
        played: video.videoWidth > 0 && video.currentTime >= 0.5,
        seconds: +video.currentTime.toFixed(2), width: video.videoWidth, height: video.videoHeight,
        frames: video.getVideoPlaybackQuality?.().totalVideoFrames,
        audioBytes: video.webkitAudioDecodedByteCount,
        failure: video.error ? "MediaError " + video.error.code : fatal,
        elapsedMs: Math.round(performance.now() - start),
      };
      if (!result.played && !result.failure) result.failure = "No decoded video within 13 seconds";
      engine?.destroy();
      video.pause();
      return result;
    }, { url: url.href, hls });
    return { ...result, httpStatus };
  } catch (error) {
    return { played: false, failure: error.message.split("\n")[0] };
  } finally { await page.close(); }
}

async function measure(source) {
  const url = new URL(source.url, site);
  if (url.origin !== site.origin) throw Error("Unexpected media origin");
  const remux = source.compatibilityUrl && process.env.K45_PLAYBACK_COMPAT === "1";
  const [evidence, ...results] = await Promise.all([
    inspect(url), ...clients.map(([, browser]) => playback(browser, url, source.hls)),
  ]);
  const row = { server: source.server, quality: source.quality, format: source.format, probe: source.probe, evidence,
    browsers: Object.fromEntries(clients.map(([name, browser], index) => [name, { version: browser.version(), ...results[index] }])) };
  if (remux) {
    const target = new URL(source.compatibilityUrl, site);
    if (target.origin !== site.origin) throw Error("Unexpected conversion origin");
    row.compatibility = Object.fromEntries(await Promise.all(clients.map(async ([name, browser]) => [name, await playback(browser, target, false)])));
  }
  return row;
}

async function sample(id) {
  const seen = new Set();
  const row = { provider: id, titles: [], issues: [] };
  const [catalog, search] = await Promise.allSettled([provider(id, "catalog"), provider(id, "search", { q: "Batman" })]);
  const category = catalog.value?.[0];
  let posts = [];
  if (category) {
    try { posts = await provider(id, "posts", { filter: category.filter, page: "1" }); }
    catch (error) { row.issues.push(error.message); }
  }
  for (const item of [...posts.slice(0, 3), ...(search.value ?? []).slice(0, 2)]) {
    if (seen.has(item.ref)) continue;
    seen.add(item.ref);
    try {
      const meta = await provider(id, "title", { ref: item.ref });
      const groups = id === "4khdhub" ? [...meta.groups].sort((a, b) => Number(/hevc|x265/i.test(b.title)) - Number(/hevc|x265/i.test(a.title))) : meta.groups;
      for (const group of groups.slice(0, 2)) {
        const episodes = group.episodesRef ? await provider(id, "episodes", { ref: group.episodesRef }).catch(() => []) : [];
        const entry = episodes[0] ?? group.directLinks[0];
        if (!entry) continue;
        const type = /series|tv|show/i.test(meta.type ?? "") || group.episodesRef && meta.type !== "movie" ? "series" : "movie";
        const sources = await provider(id, "sources", { ref: entry.ref, type });
        if (!sources.length) continue;
        const result = { title: meta.title, group: group.title, entry: entry.title, samples: [] };
        for (const source of sources.slice(0, id === "vega" || id === "4khdhub" ? 2 : 1)) result.samples.push(await measure(source));
        row.titles.push(result);
        if (result.samples.some((sample) => Object.values(sample.browsers).some(({ played }) => played)) || row.titles.length >= 2) return row;
      }
    } catch (error) { row.issues.push(error.message.split("\n")[0]); }
  }
  return row;
}

try {
  const rows = [];
  let cursor = 0;
  await Promise.all(Array.from({ length: process.env.K45_PLAYBACK_COMPAT === "1" ? 1 : 3 }, async () => {
    while (cursor < ids.length) {
      const index = cursor++;
      const result = await sample(ids[index]);
      rows[index] = result;
      console.log(result.provider, result.titles.map((title) => title.title + " " + title.samples.map((row) => row.format +
        ":" + Object.values(row.browsers).map(({ played }) => played ? "play" : "fail").join("/")).join(" ")).join(", ") || "No healthy sources");
    }
  }));
  await writeFile(output, JSON.stringify({ site: site.origin, engines: clients.map(([name]) => name), rows }, null, 2) + "\n");
} finally { await Promise.all(clients.map(([, browser]) => browser.close())); }
