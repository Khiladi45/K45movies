import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const [output, dependencies, executablePath] = process.argv.slice(2);
if (!output || !dependencies || !executablePath) throw Error("Pass output, Lighthouse installation root and Chromium executable.");
const require = createRequire(join(dependencies, "package.json"));
const { startFlow } = await import(pathToFileURL(require.resolve("lighthouse")).href);
const puppeteer = require("puppeteer-core");
const site = process.env.K45_SMOKE_SITE_URL || "http://127.0.0.1:3200";
const get = async (path, params) => {
  const response = await fetch(site + path + "?" + new URLSearchParams(params), { signal: AbortSignal.timeout(25_000) });
  if (!response.ok) throw Error(path + " HTTP " + response.status);
  return response.json();
};
const api = (op, params) => get("/api/proxy/providers", { id: "vega", op, ...params });
const [catalog, tmdb] = await Promise.all([api("catalog"), get("/api/proxy/tmdb", { op: "search", q: "Batman", page: "1" })]);
const [title] = await api("posts", { filter: catalog[0].filter, page: "1" });
const detailPath = "/provider/vega/title/" + encodeURIComponent(title.ref);
const saved = tmdb.items.slice(0, 6).map(({ id, mediaType, title, image, year }) => ({
  href: "/title/" + mediaType + "/" + id, layout: "movie", title, image, note: year,
}));
const chrome = await puppeteer.launch({ headless: true, executablePath, args: ["--autoplay-policy=no-user-gesture-required"] });
const metrics = [];
try {
  const routes = [["Home", "/"], ["Detail", detailPath], ["Search", "/search?q=Batman"], ["Watchlist", "/watchlist"],
    ["Providers", "/providers"], ["Settings", "/settings"]];
  for (const [name, path] of routes) {
    const page = await chrome.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await page.evaluateOnNewDocument(({ saved, origin }) => {
      if (window.top !== window || location.origin !== origin) return;
      if (!localStorage.getItem("k45-web-library")) {
        localStorage.setItem("k45-web-library", JSON.stringify({ version: 0,
          state: { installed: ["vega", "dvdplay", "animeworld", "movieBoxWeb"], activeProvider: "vega", providersInitialized: true, watchlist: saved } }));
        const layout = /^\/(search|watchlist)/.test(location.pathname) ? "movie" : "provider";
        localStorage.setItem("k45-web-appearance", JSON.stringify({ version: 0, state: { layout } }));
      }
    }, { saved, origin: new URL(site).origin });
    const flow = await startFlow(page, {
      name,
      config: { extends: "lighthouse:default", settings: {
        formFactor: "desktop", throttlingMethod: "provided", disableStorageReset: true,
        screenEmulation: { mobile: false, width: 1440, height: 900, deviceScaleFactor: 1, disabled: false },
        onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
      } },
    });
    await flow.navigate(site + path, { name });
    if (name === "Detail") {
      try {
        await page.waitForSelector(".playback-form .primary-button:enabled", { timeout: 15000 });
        await page.click(".playback-form .primary-button");
        await page.waitForSelector(".browser-player", { timeout: 30000 });
        await flow.snapshot({ name: "Player" });
      } catch (error) { metrics.push({ name: "Player", error: error.message.split("\n")[0] }); }
    }
    const { steps } = await flow.createFlowResult();
    for (const { name: step, lhr } of steps) {
      const metric = (id) => lhr.audits[id]?.numericValue;
      metrics.push({
        name: step, mode: lhr.gatherMode, scores: Object.fromEntries(Object.entries(lhr.categories)
          .filter(([id, category]) => category.score !== null && (lhr.gatherMode !== "snapshot" || ["accessibility", "best-practices"].includes(id))).map(([id, category]) => [id, Math.round(category.score * 100)])),
        lcpMs: metric("largest-contentful-paint"), tbtMs: metric("total-blocking-time"), cls: metric("cumulative-layout-shift"),
        auditFailures: Object.values(lhr.audits).filter(({ score, scoreDisplayMode }) => score === 0 &&
          scoreDisplayMode === "binary").map(({ id }) => id),
        runtimeError: lhr.runtimeError?.code,
      });
    }
    console.log(name, metrics.filter((record) => record.name === name).at(-1)?.scores);
    await writeFile(output, JSON.stringify({ lighthouse: require("lighthouse/package.json").version, desktop: true, metrics }, null, 2) + "\n");
    await page.close();
  }
} finally { await chrome.close(); }
