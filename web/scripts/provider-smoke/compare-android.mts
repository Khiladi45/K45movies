// Phase 2 comparison. Uses Android bundle code with the website's guarded
// Node transport. An Android WebView or React Native transport is not emulated.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, writeFileSync } from "node:fs";
import * as cheerio from "cheerio";
import { providerNetwork } from "../../src/server/provider-network";

const require = createRequire(import.meta.url);
const [output, ...ids] = process.argv.slice(2);
if (!output) throw new Error("Usage: node --conditions=react-server --import tsx scripts/provider-smoke/compare-android.mts OUTPUT.json");
const baseline = require("../../docs/web-phase-0/provider-smoke.json");
const ref = "a77aa81c9ae068e747d3c8b7b40809e895db0188";
const apiRef = "02f2b0e96ea822cc68b2d18609418501534283ca";
const urls = JSON.parse(execFileSync("git", ["-C", "../../K45movies-api", "show", apiRef + ":urls.json"], { encoding: "utf8" }));
const ua = "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
const checkerUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const targetRows = baseline.rows.filter((row) => ids.length ? ids.includes(row.id) : Object.values(row.results).some((op) => ["fail", "empty"].includes(op.state)));
const safe = (message) => String(message).split(" | {")[0]
  .replace(/https?:\/\/[^\s"'<>]+/gi, "[url]").slice(0, 180);
const log = console.log.bind(console);
for (const method of ["log", "debug", "info", "warn", "error"]) console[method] = () => {};

async function invoke(bundle, values, id, op, args) {
  const start = performance.now();
  const abort = new AbortController();
  const deadline = setTimeout(() => abort.abort(), 30000);
  const { http } = providerNetwork(abort.signal);
  const events = [];
  http.interceptors.response.use((response) => {
    const player = typeof response.data === "object" && response.data !== null &&
      new URL(response.request.responseURL).pathname.endsWith("/player.php") ?
      { videoLink: typeof response.data.video_link === "string", playerReady: response.data.status === "ok" } : undefined;
    events.push({ host: new URL(response.request.responseURL).hostname, status: response.status, player });
    return response;
  }, (error) => {
    const code = error.cause?.code || error.code || error.name;
    let host;
    try { host = new URL(error.config?.url).hostname; } catch { /* No absolute URL. */ }
    events.push({ host, code, status: error.response?.status });
    throw error;
  });
  const providerContext = {
    axios: http, cheerio, commonHeaders: { "User-Agent": ua },
    Aes: { sha1: async (value) => createHash("sha1").update(String(value)).digest("hex") },
    openWebView: async (url) => {
      events.push({ code: "android-webview-called", host: URL.canParse(url) ? new URL(url).hostname : undefined });
      throw new Error("Android WebView unavailable in this probe");
    },
    kvStore: {
      async get(key) { return values.get(key); },
      async set(key, value) { values.set(key, value); },
      async delete(key) { values.delete(key); return true; },
      async keys() { return [...values.keys()]; },
      async clear() { values.clear(); },
    },
  };
  let onAbort;
  try {
    const method = bundle[op];
    if (method === undefined) return { state: "unsupported" };
    const timeout = new Promise((_, reject) => {
      onAbort = () => reject(new Error("30 s reference deadline"));
      abort.signal.addEventListener("abort", onAbort, { once: true });
    });
    const value = await Promise.race([
      typeof method === "function" ? method({ provider: id, providerValue: id, signal: abort.signal, providerContext, ...args }) : method,
      timeout,
    ]);
    const count = Array.isArray(value) ? value.length : value?.title ? 1 : 0;
    return { value, state: count ? "pass" : "empty", count, ms: Math.round(performance.now() - start), events };
  } catch (error) {
    return { state: "fail", error: safe(error.message), ms: Math.round(performance.now() - start), events };
  } finally {
    clearTimeout(deadline);
    if (onAbort) abort.signal.removeEventListener("abort", onAbort);
    abort.abort();
  }
}

async function probe(row) {
  const { id } = row;
  const path = "../../vendor/android/src/providers/bundles/" + id + ".js";
  if (!existsSync(new URL(path, import.meta.url))) return { id, state: "no standalone Android bundle" };
  const bundle = require(path);
  const values = new Map();
  const call = (op, args = {}) => invoke(bundle, values, id, op, args);
  const catalog = await call("catalog");
  const [posts, search] = await Promise.all([
    catalog.value?.length ? call("getPosts", { filter: catalog.value[0].filter ?? catalog.value[0].id, page: 1 }) : { state: "skipped" },
    call("getSearchPosts", { searchQuery: "Batman", page: 1 }),
  ]);
  const items = [...posts.value ?? [], ...search.value ?? []];
  const first = items.find(({ title }) => title === row.title) ?? items.find(({ type }) => /series|tv|show/i.test(type ?? "")) ?? items[0];
  const result = { id, title: first?.title, operations: {} };
  if (first && (ids.length || ["meta", "episodes", "stream"].some((op) => ["fail", "empty"].includes(row.results[op].state)))) {
    const meta = await call("getMeta", { link: first.link });
    const group = meta.value?.linkList?.find(({ episodesLink }) => episodesLink) ?? meta.value?.linkList?.[0];
    const episodes = group?.episodesLink ? await call("getEpisodes", { url: group.episodesLink }) : { state: "skipped" };
    const source = episodes.value?.[0] ?? group?.directLinks?.[0] ?? meta.value?.linkList?.find(({ directLinks }) => directLinks?.length)?.directLinks[0];
    const stream = source ? await call("getStream", { link: source.link, type: group?.episodesLink ? "series" : (meta.value.type || "movie") }) : { state: "skipped" };
    const records = Array.isArray(stream.value) ? stream.value : stream.value ? [stream.value] : [];
    result.sourceRecords = { total: records.length, http: records.filter(({ link }) => /^https?:\/\//i.test(link ?? "")).length };
    Object.assign(result.operations, { meta, episodes, stream });
  }
  Object.assign(result.operations, { catalog, posts, search });
  for (const entry of Object.values(result.operations)) delete entry.value;
  return result;
}

const lookup = new Set([...targetRows.map(({ id }) => id.toLowerCase()), "nfmirror", "uhdmovies"]);
const urlChecker = Object.entries(urls).filter(([id]) => lookup.has(id.toLowerCase()));
const results = [];
let cursor = 0;
const health = new Map();
for (let index = 0; index < urlChecker.length; index += 4) {
  await Promise.all(urlChecker.slice(index, index + 4).map(async ([id, { url }]) => {
    const { request } = providerNetwork(AbortSignal.timeout(10000));
    const start = performance.now();
    try {
      const response = await request(url, { headers: { "User-Agent": checkerUA, Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" } });
      health.set(id, { host: new URL(url).hostname, finalHost: new URL(response.url).hostname, status: response.status, ms: Math.round(performance.now() - start) });
    } catch (error) {
      health.set(id, { host: new URL(url).hostname, error: error.cause?.code ?? error.name, ms: Math.round(performance.now() - start) });
    }
  }));
}
await Promise.all(Array.from({ length: 4 }, async () => {
  for (;;) {
    const index = cursor++;
    if (index >= targetRows.length) return;
    const result = await probe(targetRows[index]);
    results[index] = result;
    log(result.id, Object.entries(result.operations ?? {}).map(([op, entry]) => op + "=" + entry.state).join(" ") || result.state);
  }
}));
writeFileSync(output, JSON.stringify({ ref, apiRef, urlChecks: Object.fromEntries(health), results }, null, 2) + "\n");
