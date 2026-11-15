import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

const [output, dependencyRoot, executablePath] = process.argv.slice(2);
if (!output || !dependencyRoot) {
  throw new Error("Usage: node scripts/provider-smoke/ui-observations.mjs OUTPUT.json PLAYWRIGHT_INSTALL_ROOT [CHROME_EXE]");
}
const { chromium } = createRequire(join(dependencyRoot, "package.json"))("playwright");
const baseURL = process.env.K45_SMOKE_SITE_URL || "http://127.0.0.1:3187";
const browser = await chromium.launch({ executablePath });
try {
  const page = await browser.newPage({ baseURL });
  const providerOps = [];
  await page.route("**/api/proxy/providers?*", async (route) => {
    const { searchParams } = new URL(route.request().url());
    const op = searchParams.get("op");
    if (op === "manifest") return route.fulfill({ json: [
      { id: "vega", name: "Vega" }, { id: "fixture", name: "Fixture Provider" },
    ] });
    providerOps.push([searchParams.get("id"), op]);
    return route.fulfill({ status: 403, json: { error: "Fixture upstream refused catalog access (403)." } });
  });
  await page.goto("/providers");
  const installed = page.locator("section").filter({ has: page.getByRole("heading", { name: "Installed", exact: true }) });
  await installed.getByText("Vega", { exact: true }).waitFor();
  assert.deepEqual(await installed.locator("strong").allTextContents(), ["Vega"]);
  await page.getByRole("button", { name: "Install", exact: true }).click();
  const notice = page.getByText("Could not activate Fixture Provider. Try again.", { exact: true });
  await notice.waitFor();
  const activation = { installed: ["Vega"], providerOps, notice: await notice.textContent() };
  assert.deepEqual(providerOps, [["fixture", "catalog"]]);

  const formats = await page.evaluate(() => {
    const video = document.createElement("video");
    const types = [
      'video/mp4; codecs="avc1.640028,mp4a.40.2"',
      'video/mp4; codecs="hvc1.1.6.L120.B0"',
      'audio/mp4; codecs="ac-3"',
      'audio/mp4; codecs="ec-3"',
      'video/x-matroska; codecs="avc1.640028,mp4a.40.2"',
    ];
    return types.map((type) => ({ type, canPlayType: video.canPlayType(type), mse: MediaSource.isTypeSupported(type) }));
  });
  const tmdb = await fetch(new URL("/api/proxy/tmdb?op=row&row=trending&type=movie&page=1", baseURL));
  await writeFile(output, JSON.stringify({
    browser: browser.version(), activation, formats,
    movieBasedBaseline: { status: tmdb.status, ...(tmdb.ok ? {} : await tmdb.json()) },
  }, null, 2) + "\n");
} finally {
  await browser.close();
}
