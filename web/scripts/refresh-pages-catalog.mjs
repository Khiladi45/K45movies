import { writeFile } from "node:fs/promises";

const [out] = process.argv.slice(2);
if (!out) throw Error("Pass the snapshot output path.");
const origin = process.env.K45_SNAPSHOT_ORIGIN || "http://127.0.0.1:3200";
let cookie;
async function get(path, params) {
  const req = await fetch(origin + "/api/proxy/" + path + "?" + new URLSearchParams(params), {
    headers: cookie ? { Cookie: cookie } : {}, signal: AbortSignal.timeout(20_000),
  });
  if (!req.ok) throw Error(path + " HTTP " + req.status);
  cookie ??= req.headers.getSetCookie()[0]?.split(";")[0];
  return req.json();
}
const movies = await Promise.all(["movie", "tv"].map(async (type) => {
  const { items } = await get("tmdb", { op: "row", row: "trending", type, page: 1 });
  return items.slice(0, 16).map(({ id, mediaType, title, image, backdrop, year, synopsis, rating }) => ({
    id, mediaType, title, image, backdrop, year, synopsis, rating,
  }));
}));
const categories = await get("providers", { op: "catalog", id: "youtube" });
const youtubeRows = [];
for (const { title, filter } of categories.filter(({ title }) => /music|gaming|trending/i.test(title))) {
  const posts = await get("providers", { op: "posts", id: "youtube", filter, page: 1 }).catch(() => []);
  const entries = posts.filter(({ videoId }) => /^[\w-]{11}$/.test(videoId ?? "")).slice(0, 10)
    .map(({ videoId, title, image, tag }) => ({ videoId, title, image, tag }));
  if (entries.length) youtubeRows.push({ title, entries });
}
youtubeRows.unshift({ title: "Blender open movies", entries: [{
  videoId: "aqz-KE-bpKQ", title: "Big Buck Bunny",
  image: "https://i.ytimg.com/vi/aqz-KE-bpKQ/hqdefault.jpg", tag: "Blender Foundation",
}] });
await writeFile(out, JSON.stringify({ captured: new Date().toISOString().slice(0, 10), movies: movies.flat(), youtubeRows }, null, 2) + "\n");
