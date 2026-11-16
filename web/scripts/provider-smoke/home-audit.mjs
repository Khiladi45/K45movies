import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homeResponse, seedHome } from "./home-fixture.mjs";

const [directory, deps, executablePath, fixturePath, stage = "before"] = process.argv.slice(2);
if (!directory || !deps || !fixturePath) throw new Error("Pass output folder, deps, Chrome, fixture JSON and stage.");
const require = createRequire(join(deps, "package.json"));
const { chromium } = require("playwright");
const AxeBuilder = require("@axe-core/playwright").default;
const site = new URL(process.env.K45_SMOKE_SITE_URL || "http://127.0.0.1:3200");
const providerPath = "/api/proxy/providers";
const tmdbPath = "/api/proxy/tmdb";
let cookie;
async function api(path, params) {
  const response = await fetch(new URL(path + "?" + new URLSearchParams(params), site), {
    signal: AbortSignal.timeout(45_000), headers: cookie ? { Cookie: cookie } : undefined,
  });
  cookie ??= response.headers.getSetCookie()[0]?.split(";")[0];
  const body = await response.json();
  assert.ok(response.ok, body.error);
  return body;
}
let fixture;
try { fixture = JSON.parse(await readFile(fixturePath, "utf8")); }
catch (error) {
  if (error.code !== "ENOENT") throw error;
  const manifest = await api(providerPath, { op: "manifest" });
  const vega = (await api(providerPath, { id: "vega", op: "catalog" })).slice(0, 6);
  const youtube = (await api(providerPath, { id: "youtube", op: "catalog" })).slice(0, 4);
  const rows = {};
  for (const [id, categories] of [["vega", vega], ["youtube", youtube]]) {
    rows[id] = {};
    for (const { filter } of categories) {
      try { rows[id][filter] = await api(providerPath, { id, op: "posts", filter, page: 1 }); }
      catch { rows[id][filter] = []; }
    }
  }
  const movie = await api(tmdbPath, { op: "row", row: "trending", type: "movie", page: 1 });
  const tv = await api(tmdbPath, { op: "row", row: "trending", type: "tv", page: 1 });
  fixture = { manifest, vega, youtube, rows, movie, tv };
  await writeFile(fixturePath, JSON.stringify(fixture));
}
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ executablePath });
const results = [];
try {
  for (const mode of ["provider", "movie", "youtube"]) for (const width of [1920, 1440, 1024, 390]) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 960 }, baseURL: site.origin, reducedMotion: "reduce" });
    await context.addInitScript(seedHome, { mode, origin: site.origin });
    await context.addInitScript(() => {
      window.homeShifts = [];
      if (PerformanceObserver.supportedEntryTypes.includes("layout-shift")) {
        new PerformanceObserver((batch) => {
          for (const entry of batch.getEntries()) if (!entry.hadRecentInput) window.homeShifts.push({
            value: entry.value, time: entry.startTime,
            nodes: entry.sources.map(({ node }) => node?.className).filter((value) => typeof value === "string"),
          });
        }).observe({ type: "layout-shift", buffered: true });
      }
    });
    const page = await context.newPage();
    await page.route("**/api/proxy/**", (route) => {
      const value = homeResponse(fixture, new URL(route.request().url()));
      return value === undefined ? route.continue() : route.fulfill({ json: value });
    });
    await page.goto("/");
    if (mode === "youtube" && !fixture.rows.youtube[fixture.youtube[0]?.filter]?.length) {
      const fallback = fixture.youtube.find(({ filter }) => fixture.rows.youtube[filter]?.length);
      if (fallback) await page.getByRole("button", { name: fallback.title, exact: true }).click();
    }
    await page.locator(".poster-card").first().waitFor({ timeout: 20_000 });
    await page.evaluate(async () => {
      await document.fonts.ready;
      const images = [...document.images].filter((image) => image.getBoundingClientRect().top < innerHeight).slice(0, 12);
      await Promise.race([Promise.allSettled(images.map((image) => image.decode())), new Promise((resolve) => setTimeout(resolve, 2500))]);
    });
    await page.screenshot({ path: join(directory, mode + "-" + width + ".png"), animations: "disabled" });
    const scene = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - innerWidth,
      shifts: window.homeShifts,
      hero: document.querySelector(".catalog-hero h2")?.textContent,
      loadedImages: [...document.images].filter((image) => image.complete && image.naturalWidth > 0).length,
    }));
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    results.push({ mode, width, ...scene, axe: axe.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) })) });
    console.log(mode, width, "overflow", scene.overflow, "axe", axe.violations.length);
    await context.close();
  }
  await writeFile(join(directory, "audit.json"), JSON.stringify({ stage, browser: browser.version(), results }, null, 2) + "\n");
} finally { await browser.close(); }
