import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";
import { homeResponse, seedHome } from "./home-fixture.mjs";

const [output, dependencies, executablePath, fixturePath] = process.argv.slice(2);
if (!output || !dependencies || !executablePath || !fixturePath) throw Error("Pass output, Lighthouse dependencies, Chrome and fixture JSON.");
const require = createRequire(join(dependencies, "package.json"));
const { startFlow } = await import(pathToFileURL(require.resolve("lighthouse")).href);
const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
const site = new URL(process.env.K45_SMOKE_SITE_URL || "http://127.0.0.1:3200");
const browser = await require("puppeteer-core").launch({ headless: true, executablePath });
const rows = [];
try {
  for (const mode of ["provider", "movie", "youtube"]) for (const width of [1440, 390]) {
    const mobile = width === 390;
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    await page.evaluateOnNewDocument(seedHome, { mode, origin: site.origin });
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      const url = new URL(request.url());
      const value = url.origin === site.origin && url.pathname.startsWith("/api/proxy/") ? homeResponse(fixture, url) : undefined;
      const action = value === undefined ? request.continue() :
        request.respond({ status: 200, contentType: "application/json", body: JSON.stringify(value) });
      void action.catch(() => undefined);
    });
    const name = mode + " " + width;
    const flow = await startFlow(page, { name, config: { extends: "lighthouse:default", settings: {
      formFactor: mobile ? "mobile" : "desktop", throttlingMethod: "provided", disableStorageReset: true,
      screenEmulation: { mobile, width, height: mobile ? 844 : 960, deviceScaleFactor: 1, disabled: false },
      onlyCategories: ["performance", "accessibility"],
    } } });
    await flow.navigate(site.href, { name });
    const { steps: [{ lhr }] } = await flow.createFlowResult();
    const read = (key) => lhr.audits[key]?.numericValue;
    const titles = await page.$eval(".home-hero h2", (node) => node.textContent).catch(() => undefined);
    const data = { mode, width, cls: read("cumulative-layout-shift"), lcpMs: read("largest-contentful-paint"),
      tbtMs: read("total-blocking-time"), performance: lhr.categories.performance?.score, accessibility: lhr.categories.accessibility?.score,
      featuredTitle: titles, runtimeError: lhr.runtimeError?.code };
    console.log(data);
    rows.push(data);
    await writeFile(output, JSON.stringify({ lighthouse: require("lighthouse/package.json").version, fixture: basename(fixturePath), rows }, null, 2) + "\n");
    await context.close();
  }
} finally { await browser.close(); }
