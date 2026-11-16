import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const [output, dependencies, executablePath] = process.argv.slice(2);
if (!output || !dependencies) throw Error("Pass OUTPUT_DIR and the Playwright/Axe installation root.");
const require = createRequire(join(dependencies, "package.json"));
const { chromium } = require("playwright");
const AxeBuilder = require("@axe-core/playwright").default;
const site = new URL(process.env.K45_SMOKE_SITE_URL || "http://127.0.0.1:3200");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath, args: ["--autoplay-policy=no-user-gesture-required"] });
const installed = ["vega", "animeworld", "dvdplay", "movieBoxWeb"];

async function get(path) {
  const response = await fetch(new URL(path, site), { signal: AbortSignal.timeout(38_000) });
  const data = await response.json();
  if (!response.ok) throw Error(data.error ?? String(response.status));
  return data;
}
const provider = (id, op, extra = {}) => get("/api/proxy/providers?" + new URLSearchParams({ id, op, ...extra }));
const titlePath = (id, ref) => "/provider/" + id + "/title/" + encodeURIComponent(ref);
const widths = process.env.K45_DESIGN_WIDTHS?.split(",").map(Number) ?? [1920, 1440, 1280, 1024, 768, 390];
const rows = [];
let detail;

try {
  const [categories, movies] = await Promise.all([provider("vega", "catalog"), get("/api/proxy/tmdb?op=search&q=Batman&page=1")]);
  const posts = await provider("vega", "posts", { filter: categories[0].filter, page: "1" });
  for (const post of posts.slice(0, 6)) {
    const current = await provider("vega", "title", { ref: post.ref });
    const entry = current.groups[0]?.directLinks[0];
    if (!entry || !/movie/i.test(current.type ?? "")) continue;
    const result = await provider("vega", "sources", { ref: entry.ref, type: "movie" }).catch(() => []);
    const playable = result.find((item) => item.format === "mp4") ?? result[0];
    if (playable) { detail = { title: current.title, ref: current.ref, metadata: current, path: titlePath("vega", post.ref), entry, sources: result }; break; }
  }
  if (!detail) throw Error("Could not prepare a live Vega movie for Detail and Player.");
  await provider("dvdplay", "search", { q: "Batman" }).catch(() => null);
  const saved = movies.items.slice(0, 6).map(({ mediaType, id, title, image, year }) => ({
    href: "/title/" + mediaType + "/" + id, layout: "movie", title, image, note: year,
  }));
  const [series] = await provider("animeworld", "search", { q: "Arifureta" }).catch(() => []);
  const episodePath = series ? titlePath("animeworld", series.ref) : undefined;

  for (const width of widths) {
    const context = await browser.newContext({ baseURL: site.origin, viewport: { width, height: width === 390 ? 844 : 960 } });
    const page = await context.newPage();
    await context.addInitScript(({ installed, saved, origin }) => {
      if (window.top !== window || location.origin !== origin) return;
      if (!localStorage.getItem("k45-web-library")) localStorage.setItem("k45-web-library", JSON.stringify({ version: 0, state: {
        installed, activeProvider: "vega", providersInitialized: true, watchlist: saved,
      } }));
    }, { installed, saved, origin: site.origin });
    await page.route("**/api/proxy/providers?*", (route) => {
      const { searchParams } = new URL(route.request().url());
      if (searchParams.get("op") === "sources" && searchParams.get("ref") === detail.entry.ref) return route.fulfill({ json: detail.sources });
      if (searchParams.get("op") === "title" && searchParams.get("ref") === detail.ref) {
        return route.fulfill({ json: detail.metadata });
      }
      return route.continue();
    });
    const row = { width, views: {} };
    rows.push(row);

    async function measure(name, capture = true, axe = true) {
      const screen = await page.evaluate(async () => {
        await document.fonts.ready;
        await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
        const images = [...document.images].filter((image) => image.getBoundingClientRect().top < innerHeight).slice(0, 10);
        await Promise.race([Promise.allSettled(images.map((image) => image.decode())), new Promise((done) => setTimeout(done, 1300))]);
        const title = document.querySelector("h1")?.textContent;
        const over = document.documentElement.scrollWidth - innerWidth;
        const offenders = over > 0 ? [...document.querySelectorAll("main *")].filter((node) => {
          const rect = node.getBoundingClientRect();
          return rect.right > innerWidth + 1 && !node.closest(".poster-rail,.topic-rail,.artwork");
        }).slice(0, 10).map((node) => typeof node.className === "string" ? node.tagName + "." + node.className : node.tagName) : [];
        return { title, viewport: innerWidth, pageWidth: document.documentElement.scrollWidth, offenders };
      });
      if (axe && (width === 1440 || width === 390)) {
        const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
        screen.axe = scan.violations.map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.map(({ target }) => target) }));
      }
      row.views[name] = screen;
      if (capture) await page.screenshot({ path: join(output, name + "-" + width + ".jpg"), quality: 84, animations: "disabled" });
      assert.equal(screen.pageWidth, screen.viewport, name + " overflow at " + width + " " + JSON.stringify(screen.offenders));
    }

    try {
      await page.goto("/");
      await page.locator(".hero-copy h2").waitFor({ timeout: 25_000 });
      await measure("home");
      await page.getByRole("button", { name: "Movie Based", exact: true }).click();
      await page.locator(".hero-copy h2").waitFor({ timeout: 15_000 });
      await measure("movie-home", [1440, 390].includes(width));
      await page.getByRole("button", { name: "YouTube", exact: true }).click();
      await page.locator('a[href^="/youtube/"]').first().waitFor({ timeout: 25_000 });
      await measure("youtube-home", [1440, 390].includes(width));
      if (width === 390) {
        await page.locator('a[href^="/youtube/"]').first().click();
        await page.getByRole("button", { name: "Play video" }).click();
        const iframe = page.locator("iframe[src^='https://www.youtube.com/embed/']");
        await iframe.waitFor();
        row.youtubeEmbed = await iframe.getAttribute("src").then((value) => /^https:\/\/www.youtube.com\/embed\/[\w-]{11}\?autoplay=1$/.test(value));
        await measure("youtube-video", true, false);
      }
      await page.goto("/search?q=Batman");
      await page.getByRole("button", { name: "Movie Based", exact: true }).click();
      await page.locator(".poster-grid .poster-card").first().waitFor({ timeout: 25_000 });
      await measure("search");
      await page.goto("/watchlist");
      await page.locator(".watchlist-grid .list-row").first().waitFor();
      await measure("watchlist");
      await page.goto("/providers");
      await page.locator("[data-health='healthy']").first().waitFor({ timeout: 15_000 });
      await measure("providers");
      await page.goto("/settings");
      await page.getByRole("radio", { name: /YouTube/ }).waitFor();
      await measure("settings");
      await page.goto(detail.path);
      await page.getByRole("heading", { name: detail.title, exact: true }).waitFor({ timeout: 15_000 });
      await page.locator(".playback-form select").waitFor();
      await measure("detail");
      await page.getByRole("button", { name: "Watch Now", exact: true }).click();
      await page.waitForFunction(() => [...document.querySelectorAll("video")].some((v) => v.videoWidth && v.currentTime > 0.2), undefined, { timeout: 22_000 });
      const video = page.locator("video").last();
      await page.waitForFunction(() => [...document.querySelectorAll("video")].some((item) => item.currentTime > 3),
        undefined, { timeout: 6500 }).catch(() => undefined);
      if (width === 390) {
        await page.waitForFunction(() => document.querySelector(".player-controls")?.getAttribute("data-visible") === "false",
          undefined, { timeout: 14_000 });
      } else await video.hover();
      const settings = page.getByRole("button", { name: "Playback settings", exact: true });
      const panel = page.getByRole("complementary", { name: "Playback settings" });
      await settings.click();
      await panel.waitFor();
      await measure("player");
      if (width === 390) {
        await page.getByRole("button", { name: "Close panel" }).click();
        for (let i = 0; i < 30 && !await settings.evaluate((button) => button === document.activeElement); i++) await page.keyboard.press("Tab");
        assert.ok(await settings.evaluate((button) => button === document.activeElement));
        await page.keyboard.press("Enter");
        await panel.waitFor();
        row.mobileControls = { pointerAfterAutoHide: true, keyboardTabAndEnter: true };
      }
      if (episodePath && [1440, 390].includes(width)) {
        await page.goto(episodePath);
        await page.locator(".episode-grid li").first().waitFor({ timeout: 18000 });
        await measure("episodes", true, false);
      }
      console.log(width, "passed", Object.keys(row.views).join(", "));
    } catch (error) {
      row.error = error.message.split("\n")[0];
      console.log(width, row.error);
    } finally { await context.close(); }
  }
} finally {
  await writeFile(join(output, "results.json"), JSON.stringify({ browser: browser.version(), detail: detail?.title, rows }, null, 2) + "\n");
  await browser.close();
}
if (rows.some(({ error }) => error)) process.exitCode = 1;
