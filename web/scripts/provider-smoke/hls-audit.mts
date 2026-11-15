import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { mediaTarget } from "../../src/server/media-token";
import { streamUpstream } from "../../src/server/provider-network";

const [output, dependencies, executablePath] = process.argv.slice(2);
if (!output || !dependencies) throw Error("Pass the output and Playwright installation paths.");
const { chromium } = createRequire(join(dependencies, "package.json"))("playwright");
const site = new URL(process.env.K45_SMOKE_SITE_URL || "http://127.0.0.1:3197");
const baseline = JSON.parse(await readFile("docs/web-phase-3/browser-playback.json", "utf8"));
const ids = process.env.K45_HLS_AUDIT_IDS?.split(",");
const cases = baseline.rows.filter(({ provider }) => !ids || ids.includes(provider)).flatMap(({ provider, titles }) => titles.flatMap(({ title, group, samples }) =>
  samples.filter((sample) => sample.format === "hls" && Object.values(sample.browsers).some(({ failure }) => failure === "fragLoadError"))
    .map(({ server }) => ({ provider, title, group, server }))));
const browser = await chromium.launch({ executablePath, args: ["--autoplay-policy=no-user-gesture-required"] });
const clean = (value) => value.toLowerCase().replace(/[^a-z\d]/g, "");
const originOf = (url) => URL.parse(url)?.host;
async function call(id, op, params = {}) {
  const u = new URL("/api/proxy/providers", site);
  u.search = new URLSearchParams({ id, op, ...params });
  const r = await fetch(u, { signal: AbortSignal.timeout(40_000) });
  if (!r.ok) throw Error(op + " HTTP " + r.status);
  return r.json();
}
async function selected(test) {
  const filter = (items) => items.find(({ title }) => clean(title) === clean(test.title)) ??
    items.find(({ title }) => clean(title).includes(clean(test.title)));
  const categories = await call(test.provider, "catalog");
  const posts = await call(test.provider, "posts", { filter: categories[0].filter, page: "1" }).catch(() => []);
  const found = filter(posts) ?? filter(await call(test.provider, "search", { q: test.title }));
  if (!found) throw Error("The original title no longer appeared in the sampled catalog or title search.");
  const meta = await call(test.provider, "title", { ref: found.ref });
  const group = meta.groups.find(({ title }) => title === test.group) ?? meta.groups[0];
  if (!group) throw Error("No group returned.");
  const episodes = group.episodesRef ? await call(test.provider, "episodes", { ref: group.episodesRef }) : [];
  const entry = episodes[0] ?? group.directLinks[0];
  if (!entry) throw Error("No episode or stream reference returned.");
  const sources = await call(test.provider, "sources", {
    ref: entry.ref, type: /series|tv|show/i.test(meta.type ?? "") ? "series" : "movie",
  });
  const source = sources.find(({ hls, server }) => hls && server === test.server) ?? sources.find(({ hls }) => hls);
  if (!source) throw Error("The source no longer passed the server manifest probe.");
  return { source, group: group.title, match: source.server === test.server && group.title === test.group };
}
async function checkedUpstream(target, method, range, withoutContext) {
  const headers = new Headers(target.headers);
  headers.set("accept-encoding", "identity");
  if (range) headers.set("range", range);
  if (withoutContext) for (const name of ["referer", "origin", "authorization", "cookie"]) headers.delete(name);
  try {
    const { response, url } = await streamUpstream(target.url, method, headers, AbortSignal.timeout(9000));
    const reader = response.body?.getReader();
    const prefix = (await reader?.read())?.value.slice(0, 640) ?? new Uint8Array();
    void reader?.cancel().catch(() => undefined);
    return { status: response.status, contentType: response.headers.get("content-type"), finalHost: url.host,
      range: response.headers.get("content-range"), signature: prefix[0] === 71 && prefix[188] === 71 && prefix[376] === 71 ? "MPEG-TS sync at 0/188/376" :
        new TextDecoder().decode(prefix).trimStart().match(/^(?:#EXTM3U|<!doctype|<html|[{[])/i)?.[0] };
  } catch (error) { return { error: error.name, cause: error.cause?.code }; }
}
async function inspect(test) {
  const row = { ...test, requests: [] };
  let page;
  try {
    const { source, group, match } = await selected(test);
    Object.assign(row, { currentGroup: group, currentServer: source.server, sameSelection: match });
    page = await browser.newPage();
    const probePage = new URL("/__hls_audit", site).href;
    await page.route(probePage, (route) => route.fulfill({ contentType: "text/html", body: "<video muted playsinline></video>" }));
    await page.goto(probePage);
    await page.addScriptTag({ path: resolve("node_modules/hls.js/dist/hls.min.js") });
    const captured = [];
    page.on("response", (response) => {
      const url = new URL(response.url());
      if (url.origin === site.origin && url.pathname.startsWith("/api/proxy/media/")) {
        captured.push({ url, status: response.status(), contentType: response.headers()["content-type"], range: response.request().headers().range });
      }
    });
    const outcome = await page.evaluate(async (media) => {
      const player = document.querySelector("video");
      const engine = new window.Hls({ enableWorker: true, fragLoadingMaxRetry: 1 });
      const failure = [];
      let lastFailed;
      engine.on(window.Hls.Events.ERROR, (_, error) => {
        if (error.details === "fragLoadError") lastFailed = error.frag?.url;
        failure.push({ details: error.details, code: error.response?.code, fatal: error.fatal });
      });
      engine.loadSource(media);
      engine.attachMedia(player);
      void player.play().catch(() => {});
      const end = performance.now() + 13000;
      while (performance.now() < end && player.currentTime < 0.5 && !failure.some(({ fatal }) => fatal)) {
        await new Promise((done) => setTimeout(done, 100));
      }
      const played = player.currentTime >= 0.5 && player.videoWidth > 0;
      engine.destroy();
      return { played, failures: failure.slice(-8), lastFailed };
    }, new URL(source.url, site).href);
    row.played = outcome.played;
    row.failures = outcome.failures;
    const confirmed = captured.findLast(({ url }) => url.href === outcome.lastFailed) ?? captured.findLast(({ status }) => status >= 400);
    for (const { url, status, contentType, range } of captured.slice(0, 12)) {
      const leaf = url.pathname.split("/").at(-1);
      try {
        const token = mediaTarget(leaf);
        row.requests.push({ status, contentType, range, upstreamHost: originOf(token.url), kind: token.kind });
      } catch (error) {
        row.requests.push({ status, contentType, range, invalidToken: error.message, tokenLength: leaf.length, suffix: leaf.match(/\.[a-z0-9]{2,8}$/i)?.[0] });
      }
    }
    const untyped = captured.find(({ status, contentType }) => status === 200 && contentType === "application/octet-stream");
    if (untyped) {
      const parent = mediaTarget(untyped.url.pathname.split("/").at(-1));
      row.untypedResponse = { upstreamHost: originOf(parent.url), ...await checkedUpstream(parent, "GET", untyped.range, false) };
    }
    if (confirmed) {
      const leaf = confirmed.url.pathname.split("/").at(-1);
      let token;
      try { token = mediaTarget(leaf); } catch (error) {
        row.failedRequest = { proxyHttp: confirmed.status, pathnameSegments: confirmed.url.pathname.split("/").length, tokenLength: leaf.length,
          suffix: leaf.match(/\.[a-z0-9]{2,8}$/i)?.[0], message: error.message };
        return row;
      }
      const [withHeaders, withoutContext] = await Promise.all([
        checkedUpstream(token, "GET", confirmed.range, false), checkedUpstream(token, "GET", confirmed.range, true),
      ]);
      row.failedRequest = { proxyHttp: confirmed.status, upstreamHost: originOf(token.url), range: confirmed.range,
        headerNames: Object.keys(token.headers ?? {}), withHeaders, withoutContext };
    }
  } catch (error) { row.error = error.message.split("\n")[0]; }
  finally { await page?.close(); }
  return row;
}
try {
  const rows = [];
  let cursor = 0;
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (cursor < cases.length) {
      const index = cursor++;
      rows[index] = await inspect(cases[index]);
      console.log(rows[index].provider, rows[index].title, rows[index].played ?? rows[index].error, rows[index].failedRequest?.withHeaders);
    }
  }));
  await writeFile(output, JSON.stringify({ browser: browser.version(), rows }, null, 2) + "\n");
} finally { await browser.close(); }
