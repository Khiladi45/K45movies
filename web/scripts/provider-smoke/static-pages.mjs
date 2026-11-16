import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const [out, dependencies, executablePath] = process.argv.slice(2);
if (!out || !dependencies) throw new Error("Pass an output folder, Playwright dependencies and optional Chrome path.");
const require = createRequire(join(dependencies, "package.json"));
const { chromium } = require("playwright");
const AxeBuilder = require("@axe-core/playwright").default;
const origin = "https://khiladi45.github.io";
const base = origin + "/K45movies/";
const assets = new Map(await Promise.all([
  ["index.html", "text/html"], ["styles.css", "text/css"], ["app.js", "text/javascript"], ["brand.png", "image/png"],
].map(async ([name, type]) => [base + (name === "index.html" ? "" : name), { type, body: await readFile(".pages/" + name) }])));
const browser = await chromium.launch({ executablePath, args: ["--autoplay-policy=no-user-gesture-required"] });
await mkdir(out, { recursive: true });
const results = [];
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 960 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    const requests = [];
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.origin === origin && url.pathname.startsWith("/K45movies/api/")) requests.push(url.pathname);
    });
    await page.route(base + "**", (route) => {
      const file = assets.get(route.request().url());
      return file ? route.fulfill({ body: file.body, contentType: file.type }) : route.fulfill({ status: 404 });
    });
    await page.goto(base);
    const capture = async (layout) => {
      await page.locator(".home-hero h2").waitFor({ timeout: 25_000 });
      await page.evaluate(async () => {
        const image = document.querySelector(".home-hero-frame[data-active=true] img");
        if (image) await Promise.race([image.decode().catch(() => undefined), new Promise((done) => setTimeout(done, 2500))]);
      });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
      const design = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      await page.screenshot({ path: join(out, layout + "-" + width + ".png") });
      return design.violations.map(({ id }) => id);
    };
    await page.getByRole("heading", { name: "Trending anime", exact: true }).waitFor();
    const featured = page.locator(".home-hero h2");
    await featured.waitFor({ timeout: 25_000 });
    const firstTitle = await featured.textContent();
    assert.ok(firstTitle);
    const providerAxe = await capture("provider");
    await page.getByRole("link", { name: "More Info" }).first().click();
    await page.getByRole("heading", { name: "Episodes", exact: true }).waitFor();
    const episodeCount = await page.locator(".episode-grid li").count();
    assert.ok(episodeCount > 0);
    const sourcePage = await page.getByRole("link", { name: "Open on provider" }).getAttribute("href");
    assert.equal(new URL(sourcePage).origin, "https://kaa.lt");
    await page.getByRole("searchbox", { name: "Search titles" }).fill("Bungo");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page.locator(".poster-card").first().waitFor();
    const animeSearchCount = await page.locator(".poster-card").count();
    await page.getByRole("link", { name: "Movie Based", exact: true }).click();
    await page.getByRole("heading", { name: "Featured movies", exact: true }).waitFor();
    const movieAxe = await capture("movie");
    await page.getByRole("link", { name: "More Info" }).first().click();
    await page.getByRole("link", { name: "View on TMDB" }).waitFor();
    await page.getByRole("link", { name: "Home", exact: true }).click();
    await page.getByRole("link", { name: "YouTube", exact: true }).click();
    const youtubeAxe = await capture("youtube");
    await page.getByRole("link", { name: /Big Buck Bunny/ }).first().click();
    await page.getByRole("link", { name: "Play video" }).click();
    const frame = page.frameLocator(".youtube-player iframe");
    const video = frame.locator("video");
    await video.first().waitFor({ state: "attached", timeout: 25_000 });
    let elapsed;
    for (let i = 0; i < 18; i++) {
      elapsed = await video.first().evaluate((node) => node.currentTime);
      if (elapsed > 0.5) break;
      if (i === 4) await frame.locator(".ytp-large-play-button").first().click({ timeout: 1000 }).catch(() => undefined);
      await page.waitForTimeout(700);
    }
    assert.ok(elapsed > 0.5, "YouTube sample played past half a second");
    await page.getByRole("link", { name: "Providers", exact: true }).click();
    await page.getByText("Browse and search · play on provider").waitFor();
    const unavailable = await page.getByText("Unavailable in this preview").count();
    assert.ok(unavailable > 0);
    assert.deepEqual(requests, []);
    assert.deepEqual(errors, []);
    assert.deepEqual([...providerAxe, ...movieAxe, ...youtubeAxe], []);
    results.push({ width, firstTitle, episodeCount, animeSearchCount, youtubeSeconds: elapsed, unavailable,
      axe: { provider: providerAxe, movie: movieAxe, youtube: youtubeAxe }, providerApiCallsToPages: requests.length });
    console.log(results.at(-1));
    await writeFile(join(out, "browser-audit.json"), JSON.stringify({ browser: browser.version(), origin, results }, null, 2) + "\n");
    await context.close();
  }
} finally { await browser.close(); }
