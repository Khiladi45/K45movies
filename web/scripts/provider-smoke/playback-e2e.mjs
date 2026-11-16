import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [output, dependencyRoot, chrome, mode = "provider"] = process.argv.slice(2);
assert.ok(["provider", "movie"].includes(mode), "Choose provider or movie.");
const site = process.env.K45_SMOKE_SITE_URL || "http://127.0.0.1:3194";
const ffmpeg = process.env.K45_FFMPEG_PATH;
if (!output || !dependencyRoot || !ffmpeg) throw Error("Set K45_FFMPEG_PATH and pass OUTPUT.json PLAYWRIGHT_ROOT [CHROME_EXE].");
const { chromium } = createRequire(join(dependencyRoot, "package.json"))("playwright");
const tmp = await mkdtemp(join(tmpdir(), "k45-phase3-e2e-"));
const file = join(tmp, "fixture.mp4");
let browser;
try {
  execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=320x180:rate=24",
    "-t", "14", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", file]);
  const media = await readFile(file);
  browser = await chromium.launch({ executablePath: chrome, args: ["--autoplay-policy=no-user-gesture-required"] });
  const page = await browser.newPage({ baseURL: site, viewport: { width: 1440, height: 900 } });
  let movie;
  if (mode === "movie") {
    const response = await fetch(new URL("/api/proxy/tmdb?op=title&type=tv&id=66732", site));
    assert.equal(response.status, 200, "Movie Based requires a live TMDB title response.");
    movie = await response.json();
    await page.addInitScript(() => {
      localStorage.setItem("k45-web-library", JSON.stringify({ version: 0,
        state: { installed: ["slow", "broken", "vega"], activeProvider: "vega", providersInitialized: true } }));
      localStorage.setItem("k45-web-appearance", JSON.stringify({ version: 0, state: { layout: "movie" } }));
    });
  }
  const slowStopped = Promise.withResolvers();
  const releaseSlow = Promise.withResolvers();
  page.on("requestfailed", (request) => {
    if (new URL(request.url()).searchParams.get("id") === "slow") slowStopped.resolve(request.failure()?.errorText);
  });
  const groups = [{ title: "Season 1 · 720p", episodesRef: "season1-720", directLinks: [] },
    { title: "Season 1 · 1080p", episodesRef: "season1-1080", directLinks: [] },
    { title: "Season 2 · 720p", episodesRef: "season2-720", directLinks: [] }];
  const post = { title: movie?.title ?? "Playback Fixture", ref: "title-fixture.fixture-signature", type: "series" };
  const detail = { ...post, groups, tags: [], cast: [] };
  const requests = [];
  let rejectSources = mode === "provider";
  const source = (ref) => ({ server: "Fixture server", url: "/api/proxy/media/" + ref, hls: false, format: "mp4",
    probe: { status: "ok", format: "mp4" }, subtitles: [], languages: [] });
  await page.route("**/api/proxy/providers?*", async (route) => {
    const query = new URL(route.request().url()).searchParams;
    const ref = query.get("ref");
    const id = query.get("id");
    if (id === "slow") {
      await releaseSlow.promise;
      return route.fulfill({ json: [] }).catch(() => undefined);
    }
    if (id === "broken") return route.fulfill({ status: 422, json: { error: "Fixture provider unavailable" } });
    switch (query.get("op")) {
      case "search": return route.fulfill({ json: [post] });
      case "manifest": return route.fulfill({ json: [{ id: "vega", name: "Fixture" }, { id: "slow", name: "Slow fixture" }, { id: "broken", name: "Broken fixture" }] });
      case "catalog": return route.fulfill({ json: [{ title: "Featured", filter: "featured" }] });
      case "posts": return route.fulfill({ json: [post] });
      case "title": return route.fulfill({ json: detail });
      case "episodes": return route.fulfill({ json: [2, 1].map((number) => ({ title: "Episode " + number, ref: ref + "-ep" + number })) });
      case "sources": {
        if (rejectSources) return route.fulfill({ json: {
          sources: [],
          issue: { provider: id, operation: "sources", stage: "probe", message: "None of the checked servers returned verified media." },
          attempts: [
            { server: "Expired fixture", quality: "1080p", probe: { status: "failed", httpStatus: 410, contentType: "text/plain", reason: "HTTP 410" } },
            { server: "HTML fixture", probe: { status: "failed", httpStatus: 200, contentType: "text/html", reason: "Invalid streaming manifest." } },
          ],
        } });
        requests.push({ ref, preference: query.get("quality") });
        return route.fulfill({ json: { attempts: [], sources: ref === "season1-1080-ep1" ? [source("dropped-after-probe"), source(ref)] : [source(ref)] } });
      }
      default: return route.fulfill({ status: 400, json: { error: "Unexpected request" } });
    }
  });
  const mediaRequests = [];
  await page.route("**/api/proxy/media/*", (route) => {
    const ref = new URL(route.request().url()).pathname.split("/").at(-1);
    mediaRequests.push(ref);
    if (ref === "dropped-after-probe") return route.fulfill({ status: 410 });
    const requested = route.request().headers().range?.match(/^bytes=(\d+)-(\d*)$/);
    const start = Number(requested?.[1] ?? 0);
    const end = Math.min(media.length - 1, Number(requested?.[2] || media.length - 1));
    return route.fulfill({ status: requested ? 206 : 200, body: media.subarray(start, end + 1),
      headers: { "Content-Type": "video/mp4", "Accept-Ranges": "bytes",
        ...(requested ? { "Content-Range": "bytes " + start + "-" + end + "/" + media.length } : {}) } });
  });
  if (movie) {
    await page.goto("/title/tv/" + movie.id);
    await page.getByRole("heading", { name: movie.title, exact: true }).waitFor();
    await page.getByRole("button", { name: /^1\s/ }).first().click();
    await page.getByText("Broken fixture · Failed", { exact: false }).waitFor();
  } else {
    await page.goto("/");
    await page.locator('a[href="/provider/vega/title/title-fixture.fixture-signature"]').first().click();
    await page.getByRole("heading", { name: post.title }).waitFor();
  }
  const picker = page.getByLabel(movie ? "Quality" : "Season or quality");
  await picker.waitFor();
  assert.equal(await picker.count(), 1);
  await picker.selectOption("1");
  if (rejectSources) {
    await page.getByRole("button", { name: "Watch Now" }).click();
    const servers = page.getByRole("list", { name: "Server checks" });
    await servers.getByText(/Expired fixture.*HTTP 410.*text\/plain/).waitFor();
    await servers.getByText(/HTML fixture.*HTTP 200.*text\/html.*Invalid streaming manifest/).waitFor();
    rejectSources = false;
  }
  await page.getByRole("button", { name: "Watch Now" }).click();
  const video = page.locator("video").last();
  const waitPlayback = (ref, time) => page.waitForFunction(({ ref, time }) => [...document.querySelectorAll("video")].some(
    (item) => item.currentSrc.endsWith(ref) && item.videoWidth > 0 && item.currentTime >= time), { ref, time }, { timeout: 20_000 });
  await waitPlayback("season1-1080-ep1", 0.3);
  await video.evaluate((element) => { element.currentTime = 4; });
  await waitPlayback("season1-1080-ep1", 3.8);
  const playedAt = await video.evaluate((element) => element.currentTime);
  await page.getByRole("button", { name: "Quality", exact: true }).click();
  const playerPicker = page.getByLabel("Title quality");
  assert.deepEqual(await playerPicker.locator("option").allTextContents(), ["Season 1 · 720p", "Season 1 · 1080p"]);
  await playerPicker.selectOption("0");
  await waitPlayback("season1-720-ep1", 3.8);
  const resumed = await video.evaluate((element) => element.currentTime);
  await page.getByRole("button", { name: "Servers", exact: true }).click();
  await page.getByRole("button", { name: "Fixture server · MP4" }).waitFor();
  await page.getByRole("button", { name: "Close panel" }).click();
  await page.getByRole("button", { name: "Next episode" }).click();
  await waitPlayback("season1-720-ep2", 0.3);
  assert.deepEqual(requests.map(({ ref }) => ref), ["season1-1080-ep1", "season1-720-ep1", "season1-720-ep2"]);
  assert.ok(mediaRequests.includes("dropped-after-probe"));
  assert.ok(resumed >= 3.8);
  let cancellation;
  if (movie) {
    await page.getByRole("button", { name: "Close player", exact: true }).click();
    await page.getByRole("link", { name: "Home", exact: true }).first().click();
    await page.waitForURL("/");
    cancellation = await Promise.race([slowStopped.promise, new Promise((resolve) => setTimeout(resolve, 5000))]);
    releaseSlow.resolve();
    assert.match(cancellation ?? "", /abort/i);
  } else {
    rejectSources = true;
    await page.goto("/settings/providers/diagnostics");
    await page.getByRole("button", { name: "Run diagnostics" }).click();
    const servers = page.getByRole("list", { name: "Server checks" });
    await servers.getByText(/Expired fixture.*HTTP 410.*text\/plain/).waitFor();
    await servers.getByText(/HTML fixture.*HTTP 200.*text\/html.*Invalid streaming manifest/).waitFor();
  }
  await writeFile(output, JSON.stringify({
    browser: browser.version(), mode, tmdbTitle: movie?.title, cancellation, failedProviderDidNotBlockPlayback: !!movie, serverDiagnostics: !movie,
    flow: "Detail → 1080p → server fallback → 720p → Episode 2",
    requests, playedAt, resumed, serverFallback: true, seasonsFiltered: true,
  }, null, 2) + "\n");
} finally {
  await browser?.close();
  await rm(tmp, { recursive: true, force: true });
}
