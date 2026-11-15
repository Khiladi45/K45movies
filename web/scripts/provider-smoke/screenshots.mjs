import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const [output, dependencyRoot, executablePath] = process.argv.slice(2);
if (!output || !dependencyRoot) {
  throw new Error("Usage: node scripts/provider-smoke/screenshots.mjs OUTPUT_DIR PLAYWRIGHT_INSTALL_ROOT [CHROME_EXE]");
}
const { chromium } = createRequire(join(dependencyRoot, "package.json"))("playwright");
const base = process.env.K45_SMOKE_SITE_URL || "http://127.0.0.1:3187";
const customWidths = process.env.K45_SMOKE_WIDTHS;
const widths = customWidths?.split(",").map(Number) ?? [1440, 1024, 390];
const records = [];
await mkdir(output, { recursive: true });

async function provider(op, params) {
  const url = new URL("/api/proxy/providers", base);
  url.search = new URLSearchParams({ op, id: "vega", ...params });
  const response = await fetch(url, { signal: AbortSignal.timeout(40_000) });
  if (!response.ok) throw new Error(op + " returned HTTP " + response.status);
  return response.json();
}

const catalog = await provider("catalog");
const posts = await provider("posts", { filter: catalog[0].filter, page: 1 });
const post = posts.find(({ type }) => /series|tv|show/i.test(type ?? "")) ?? posts[0];
const detail = await provider("title", { ref: post.ref });
const titlePath = "/provider/vega/title/" + encodeURIComponent(post.ref);
const browser = await chromium.launch({ executablePath });
try {
  for (const width of widths) {
    const context = await browser.newContext({ baseURL: base, viewport: { width, height: width === 390 ? 844 : 900 } });
    const page = await context.newPage();
    const evidence = { width, title: detail.title, browser: browser.version(), screens: {}, events: [] };
    page.on("request", (request) => {
      if (request.url().startsWith(base + "/api/proxy/media/")) {
        evidence.events.push({ ms: Date.now(), event: "media request", method: request.method() });
      }
    });
    await page.exposeFunction("recordSmokeEvent", (event) => evidence.events.push({ ms: Date.now(), ...event }));
    async function capture(screen, fullPage = true) {
      const name = screen.toLowerCase() + "-" + width + ".png";
      await page.screenshot({ path: join(output, name), fullPage, animations: "disabled", timeout: 20_000 });
      evidence.screens[screen] = await page.evaluate(() => ({
        title: document.title, viewportWidth: innerWidth, pageWidth: document.documentElement.scrollWidth,
        pageHeight: document.documentElement.scrollHeight,
      }));
    }
    try {
      await page.goto("/");
      await page.locator('a[href^="/provider/vega/title/"]').first().waitFor({ timeout: 35_000 });
      await capture("Home", false);
      await page.goto(titlePath);
      await page.getByRole("heading", { name: detail.title, exact: true }).waitFor({ timeout: 35_000 });
      const groups = page.locator("select.field").first();
      await groups.waitFor();
      evidence.groups = await groups.locator("option").allTextContents();
      let selected = false;
      for (let group = 0; group < Math.min(4, evidence.groups.length); group++) {
        await groups.selectOption(String(group));
        const item = page.locator("button[aria-pressed].list-row").first();
        if (!await item.waitFor({ timeout: 14_000 }).then(() => true, () => false)) continue;
        evidence.entry = await item.textContent();
        await item.click();
        const server = page.getByRole("region", { name: "Available servers" }).getByRole("button", { name: /^Play / }).first();
        if (!await server.waitFor({ timeout: 35_000 }).then(() => true, () => false)) continue;
        evidence.servers = await page.getByRole("region", { name: "Available servers" }).getByRole("button", { name: /^Play / }).allTextContents();
        await capture("Detail");
        await page.evaluate(() => window.recordSmokeEvent({ event: "selected server clicked" }));
        await server.click();
        selected = true;
        break;
      }
      if (!selected) throw new Error("No selectable live server in the first four groups");
      const video = page.locator("video").last();
      await video.waitFor({ state: "attached", timeout: 20_000 });
      await page.waitForFunction(() => [...document.querySelectorAll("video")].some((element) => element.currentTime > 0.2),
        undefined, { timeout: 14_000 }).catch(() => {});
      evidence.media = await video.evaluate((element) => ({
        time: element.currentTime, readyState: element.readyState, error: element.error?.code,
        videoWidth: element.videoWidth, videoHeight: element.videoHeight,
      }));
      const controls = page.getByRole("button", { name: "Playback settings", exact: true });
      await video.hover({ timeout: 4000 }).catch(() => {});
      evidence.pointerSettings = await controls.click({ timeout: 2500 }).then(() => true, () => false);
      if (!evidence.pointerSettings) await controls.press("Enter");
      evidence.playerPickers = await page.locator("aside.player-panel select").evaluateAll((elements) =>
        elements.map((element) => element.getAttribute("aria-label") || element.parentElement?.childNodes[0]?.textContent));
      await capture("Player");
      await page.goto("/settings");
      await page.getByRole("heading", { name: "Settings", exact: true }).waitFor();
      await capture("Settings");
    } catch (error) {
      evidence.failure = error.message.split("\n")[0];
    } finally {
      records.push(evidence);
      console.log(width, Object.keys(evidence.screens).join(", "), evidence.media ?? evidence.failure);
      await context.close();
    }
  }
} finally {
  await browser.close();
  await writeFile(join(output, customWidths ? "screenshots-" + widths.join("-") + ".json" : "screenshots.json"), JSON.stringify(records, null, 2) + "\n");
}
if (records.some(({ failure }) => failure)) process.exitCode = 1;
