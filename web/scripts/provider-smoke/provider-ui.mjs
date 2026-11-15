import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

const [output, dependencyRoot, executablePath] = process.argv.slice(2);
if (!output || !dependencyRoot) throw new Error("Usage: node scripts/provider-smoke/provider-ui.mjs OUTPUT.json PLAYWRIGHT_ROOT [CHROME_EXE]");
const { chromium } = createRequire(join(dependencyRoot, "package.json"))("playwright");
const baseURL = process.env.K45_SMOKE_SITE_URL || "http://127.0.0.1:3193";
const browser = await chromium.launch({ executablePath });
try {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  const catalogCalls = [];
  const issue = {
    provider: "fixture", operation: "catalog", stage: "verification", upstreamStatus: 403,
    message: "Fixture requested interactive verification.",
  };
  await page.route("**/api/proxy/providers?*", (route) => {
    const params = new URL(route.request().url()).searchParams;
    if (params.get("op") === "manifest") return route.fulfill({ json: [
      { id: "vega", name: "Vega" }, { id: "fixture", name: "Fixture Provider" },
    ] });
    if (params.get("op") === "health") return route.fulfill({ json: catalogCalls.length > 0 ? {
      fixture: { state: "needs verification", checkedAt: Date.now(), issue },
    } : {} });
    catalogCalls.push(params.get("id"));
    return route.fulfill({ status: 503, json: { error: issue.message, details: issue } });
  });
  await page.goto("/providers");
  const installed = page.locator("section").filter({ has: page.getByRole("heading", { name: "Installed", exact: true }) });
  const row = installed.locator("li").filter({ hasText: "Fixture Provider" });
  await row.waitFor();
  const installedByDefault = await installed.locator("strong").allTextContents();
  assert.deepEqual(installedByDefault, ["Vega", "Fixture Provider"]);
  await row.getByRole("button", { name: "Activate", exact: true }).click();
  await row.getByText("Active", { exact: true }).waitFor();
  assert.equal(catalogCalls.length, 0);
  await row.getByRole("button", { name: "Check catalog" }).click();
  await row.getByText("needs verification", { exact: true }).waitFor();
  await row.getByText(issue.message, { exact: true }).waitFor();
  assert.deepEqual(catalogCalls, ["fixture"]);
  page.once("dialog", (dialog) => dialog.accept());
  await row.getByRole("button", { name: "Remove Fixture Provider" }).click();
  await row.waitFor({ state: "detached" });
  await page.reload();
  const available = page.locator("section").filter({ has: page.getByRole("heading", { name: "Available", exact: true }) });
  await available.getByText("Fixture Provider", { exact: true }).waitFor();
  await context.close();

  const live = await browser.newPage({ baseURL });
  await live.goto("/settings/providers/diagnostics");
  await live.getByRole("combobox").selectOption("dvdplay");
  await live.getByRole("button", { name: "Run diagnostics" }).click();
  const search = live.locator("ol li").filter({ has: live.getByText("Search", { exact: true }) });
  await search.getByText(/Search is unavailable/).waitFor({ timeout: 35_000 });
  const diagnostics = await search.innerText();
  assert.match(diagnostics, /dvdplay · search · runtime/);
  await writeFile(output, JSON.stringify({
    browser: browser.version(),
    fixture: { installedByDefault, activatedWithoutCatalog: true, catalogCalls, health: "needs verification", error: issue.message, uninstallPersisted: true },
    live: { diagnostics },
  }, null, 2) + "\n");
} finally {
  await browser.close();
}
