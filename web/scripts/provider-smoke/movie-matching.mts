import { writeFile } from "node:fs/promises";
import { matchProvider, choicesFor } from "../../src/lib/title-bridge";

const [output, titleId = "414906"] = process.argv.slice(2);
if (!output) throw new Error("Usage: node --import tsx scripts/provider-smoke/movie-matching.mts OUTPUT.json [TMDB_MOVIE_ID]");
const site = new URL(process.env.K45_SMOKE_SITE_URL || "http://127.0.0.1:3192");
const original = globalThis.fetch;
globalThis.fetch = (value, options) => original(
  typeof value === "string" && value.startsWith("/") ? new URL(value, site) : value, options,
);
async function load(path) {
  const response = await fetch(path, { signal: AbortSignal.timeout(15_000) });
  const data = await response.json();
  if (!response.ok) throw Error(path.split("?")[0] + ": " + (data.error ?? response.status));
  return data;
}
const [search, title, manifest] = await Promise.all([
  load("/api/proxy/tmdb?op=search&q=Batman&page=1"),
  load("/api/proxy/tmdb?op=title&type=movie&id=" + encodeURIComponent(titleId)),
  load("/api/proxy/providers?op=manifest"),
]);
const matches = [];
let cursor = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  for (;;) {
    const index = cursor++;
    const provider = manifest[index];
    if (!provider) return;
    const signal = AbortSignal.timeout(125_000);
    const started = performance.now();
    let result;
    try {
      const found = await matchProvider(provider.id, title, signal);
      const choices = await choicesFor(provider.id, found, 0, 0, 0, signal);
      result = { state: choices.length ? "available" : "no match", matches: found.length, choices: choices.length };
    } catch (error) {
      result = { state: "failed", error: error.message, http: error.status, details: error.details };
    }
    matches[index] = { provider: provider.id, ms: Math.round(performance.now() - started), ...result };
    console.log(provider.id, result.state);
  }
}));
await writeFile(output, JSON.stringify({
  search: { term: "Batman", count: search.items.length },
  title: { id: title.id, title: title.title, year: title.year }, matches,
}, null, 2) + "\n");
