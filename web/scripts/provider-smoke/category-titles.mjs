import { writeFile } from "node:fs/promises";

const [out, base = "http://127.0.0.1:3200"] = process.argv.slice(2);
const ids = ["1tamilblasters","animesub","drive","Joya9tv","kmMovies","hdmovieslife","moviesda","luxMovies","uniquestream","animesalt"];
if (!out) throw new Error("Pass the result path.");
let cookie;
async function call(id, op, fields = {}) {
  const start = performance.now();
  try {
    const url = new URL("/api/proxy/providers", base);
    url.search = new URLSearchParams({ id, op, ...fields });
    const response = await fetch(url, { signal: AbortSignal.timeout(110_000), headers: cookie ? { Cookie: cookie } : undefined });
    cookie ??= response.headers.getSetCookie()[0]?.split(";")[0];
    const data = await response.json();
    const outcome = { http: response.status, ms: Math.round(performance.now() - start) };
    return response.ok ? { ...outcome, data } : { ...outcome, error: data.error, details: data.details };
  } catch (error) { return { ms: Math.round(performance.now() - start), error: error?.cause?.code ?? error.message }; }
}
function result({ data, ...rest }) {
  return { ...rest, state: rest.error ? "fail" : Array.isArray(data) && !data.length ? "empty" : "pass",
    count: Array.isArray(data) ? data.length : undefined };
}
async function sample(id) {
  const catalog = await call(id,"catalog");
  const titles = [];
  const used = new Set();
  const gaps = [];
  for (const category of (catalog.data ?? []).slice(0, 10)) {
    const posts = await call(id,"posts",{ filter: category.filter, page: "1" });
    const item = posts.data?.find((post) => !used.has(post.title.toLowerCase()));
    if (!item) { gaps.push({ category: category.title, ...result(posts) }); continue; }
    used.add(item.title.toLowerCase());
    const search = await call(id,"search",{ q: item.title.slice(0, 120) });
    const meta = await call(id,"title",{ ref: item.ref });
    const group = meta.data?.groups?.find((g) => g.episodesRef || g.directLinks?.length);
    const episodes = group?.episodesRef ? await call(id,"episodes",{ ref: group.episodesRef }) : undefined;
    const entry = episodes?.data?.[0] ?? group?.directLinks?.[0];
    const stream = entry ? await call(id,"sources",{ ref: entry.ref, type: group.episodesRef || /series|tv|show/i.test(meta.data.type ?? "") ? "series" : "movie", diagnostics: "1" }) : undefined;
    titles.push({ category: category.title, title: item.title, search: result(search), meta: result(meta),
      episodes: episodes && result(episodes), stream: stream ? { ...result({ ...stream, data: stream.data?.sources ?? [] }),
        issue: stream.data?.issue, attempts: stream.data?.attempts } : { state: "skipped", error: "No source reference" } });
    if (titles.length === 3) break;
  }
  const alternativeSearches = [];
  if (titles.length < 3) for (const q of ["One Piece","The Avengers","Naruto"].slice(0, 3 - titles.length)) {
    alternativeSearches.push({ q, ...result(await call(id, "search", { q })) });
  }
  return { id, catalog: result(catalog), titles, gaps, alternativeSearches };
}
await call("", "manifest");
const rows = [];
for (let i = 0; i < ids.length; i += 3) {
  const batch = await Promise.all(ids.slice(i, i + 3).map(sample));
  rows.push(...batch);
  await writeFile(out, JSON.stringify({ measuredAt: new Date().toISOString(), rows }, null, 2) + "\n");
}
