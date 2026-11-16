import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homeResponse, seedHome } from "./home-fixture.mjs";

const [output, dependencies, executablePath, fixturePath] = process.argv.slice(2);
if (!output || !dependencies || !executablePath || !fixturePath) throw Error("Pass output, Playwright dependencies, Chrome and fixture JSON.");
const require = createRequire(join(dependencies, "package.json"));
const site = new URL(process.env.K45_SMOKE_SITE_URL || "http://127.0.0.1:3200");
const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
await mkdir(output, { recursive: true });
const browser = await require("playwright").chromium.launch({ executablePath });
const summaries = [];
try {
  for (const mode of ["provider", "movie", "youtube"]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, baseURL: site.origin });
    await context.addInitScript(seedHome, { mode, origin: site.origin });
    const page = await context.newPage();
    await page.route("**/api/proxy/**", (route) => {
      const url = new URL(route.request().url());
      const params = url.searchParams;
      const video = params.get("id") === "youtube" && params.get("op") === "title" ?
        Object.values(fixture.rows.youtube).flat().find(({ ref }) => ref === params.get("ref")) : undefined;
      const value = video ?? homeResponse(fixture, url);
      return value === undefined ? route.continue() : route.fulfill({ json: value });
    });
    await page.goto("/");
    const title = page.locator(".home-hero h2");
    await title.waitFor({ timeout: 15_000 });
    await page.mouse.move(2, 2);
    await page.evaluate(async () => {
      await document.fonts.ready;
      const lead = document.querySelector('.home-hero-frame[data-active="true"] img');
      if (lead) await Promise.race([lead.decode().catch(() => undefined), new Promise((done) => setTimeout(done, 1700))]);
    });
    await page.evaluate(() => {
      window.homeLongFrames = [];
      if (!PerformanceObserver.supportedEntryTypes.includes("long-animation-frame")) throw Error("Chrome Long Animation Frame API unavailable");
      new PerformanceObserver((list) => list.getEntries().forEach(({ startTime, duration, blockingDuration }) =>
        window.homeLongFrames.push({ startTime, duration, blockingDuration }))).observe({ type: "long-animation-frame" });
    });
    const cdp = await context.newCDPSession(page);
    const trace = new Promise((resolve) => cdp.once("Tracing.tracingComplete", resolve));
    await cdp.send("Tracing.start", { categories: "devtools.timeline,disabled-by-default-devtools.timeline.frame,blink.user_timing",
      transferMode: "ReturnAsStream", streamFormat: "json", streamCompression: "gzip" });

    const before = await title.textContent();
    await page.evaluate(() => performance.mark("home-rotation-start"));
    await page.waitForFunction((heading) => document.querySelector(".home-hero h2")?.textContent !== heading, before, { timeout: 12_000 });
    const after = await title.textContent();
    await page.evaluate(() => performance.mark("home-rotation-end"));
    const rail = page.locator(".home-rail-view").first();
    await rail.scrollIntoViewIfNeeded();
    await rail.hover();
    await page.evaluate(() => performance.mark("home-rail-start"));
    await rail.getByRole("button", { name: "Scroll titles forward" }).click();
    await page.waitForFunction(() => document.querySelector(".home-rail-view .poster-rail").scrollLeft >= 100);
    await page.waitForTimeout(550);
    await page.evaluate(() => performance.mark("home-rail-end"));
    await cdp.send("Tracing.end");
    const { stream } = await trace;
    const chunks = [];
    for (;;) {
      const { data, eof, base64Encoded } = await cdp.send("IO.read", { handle: stream });
      if (data) chunks.push(Buffer.from(data, base64Encoded ? "base64" : "utf8"));
      if (eof) break;
    }
    await cdp.send("IO.close", { handle: stream });
    await writeFile(join(output, mode + ".trace.json.gz"), Buffer.concat(chunks));
    const details = await page.evaluate(() => ({
      longFrames: window.homeLongFrames,
      scrollLeft: document.querySelector(".home-rail-view .poster-rail").scrollLeft,
      marks: Object.fromEntries(performance.getEntriesByType("mark").filter(({name}) => name.startsWith("home-"))
        .map(({name,startTime}) => [name,startTime])),
    }));
    assert.notEqual(before, after);
    let youtubePlay;
    if (mode === "youtube") {
      await page.route("https://www.youtube.com/embed/**", (route) => route.fulfill({ status: 200, body: "" }));
      await page.locator(".home-hero").getByRole("link", { name: "Play", exact: true }).click();
      const player = page.locator('.youtube-player iframe[src*="autoplay=1"]');
      await player.waitFor({ timeout: 15_000 });
      youtubePlay = true;
    }
    summaries.push({ mode, before, after, youtubePlay, ...details,
      actionLongFrames: details.longFrames.filter(({startTime,duration}) => ["rotation","rail"].some((action) =>
        startTime + duration >= details.marks["home-" + action + "-start"] && startTime < details.marks["home-" + action + "-end"])) });
    await writeFile(join(output,"trace-summary.json"), JSON.stringify({ browser: browser.version(), summaries }, null, 2) + "\n");
    console.log(mode, details.scrollLeft, summaries.at(-1).actionLongFrames.length);
    await context.close();
  }
} finally { await browser.close(); }
