const api = "https://raw.githubusercontent.com/Khiladi45/K45movies-api/main/";
export const animeOrigin = "https://kaa.lt";

export type RegistryEntry = { id: string; name: string };
type Registry = { providers: RegistryEntry[] };
type Origins = Record<string, { url?: string }>;
type Anime = {
  slug: string; title: string; title_en?: string; synopsis?: string; year?: number; type?: string;
  poster?: { hq?: string; sm?: string }; banner?: { hq?: string; sm?: string };
};
type Episode = { slug: string; episode_string: string; title?: string };
type Page<T> = { result: T[] };

export async function json<T>(url: URL | string, signal: AbortSignal, request?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...request, credentials: "omit", redirect: "error",
      signal: AbortSignal.any([signal, AbortSignal.timeout(12_000)]),
    });
  } catch (error) {
    signal.throwIfAborted();
    if (error instanceof DOMException && error.name === "TimeoutError") throw new Error("The provider did not respond within 12 seconds.");
    throw new Error("Could not reach this provider from the browser.");
  }
  if (!response.ok) throw new Error("The provider returned HTTP " + response.status + ".");
  return response.json();
}

export async function registry(signal: AbortSignal) {
  const [manifest, urls] = await Promise.all([
    json<Registry>(api + "manifest.json", signal),
    json<Origins>(api + "urls.json", signal),
  ]);
  const anime = URL.parse(urls.kickAssAnime?.url ?? "")?.origin === animeOrigin;
  return { providers: manifest.providers, anime };
}

const showId = /^[a-z\d-]{1,100}$/i;
export const videoId = /^[a-z\d_-]{11}$/i;
export const safeArtwork = (raw?: string) => raw && URL.parse(raw)?.protocol === "https:" ? raw : undefined;

export function adaptAnime(show: Anime) {
  const art = (kind: "poster" | "banner", id?: string) =>
    id && /^[a-z\d_/-]+$/i.test(id) ? animeOrigin + "/image/" + kind + "/" + id + ".webp" : undefined;
  return {
    id: show.slug, title: show.title_en || show.title, synopsis: show.synopsis, type: show.type, year: show.year,
    image: art("poster", show.poster?.hq ?? show.poster?.sm),
    backdrop: art("banner", show.banner?.hq ?? show.banner?.sm),
  };
}
export type AnimeTitle = ReturnType<typeof adaptAnime>;

export const collections = [
  { title: "Trending anime", path: "/api/show/trending?page=1" },
  { title: "Popular anime", path: "/api/show/popular?page=1" },
  { title: "Recently added", path: "/api/show/recent?type=sub&page=1" },
];

export async function animeCollection(path: string, signal: AbortSignal) {
  const data = await json<Page<Anime>>(animeOrigin + path, signal);
  return data.result.filter((show) => showId.test(show.slug) && (show.title_en || show.title)).map(adaptAnime);
}

export async function animeSearch(query: string, signal: AbortSignal) {
  const data = await json<Page<Anime>>(animeOrigin + "/api/fsearch", signal, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ page: 1, query }),
  });
  return data.result.filter((show) => showId.test(show.slug) && (show.title_en || show.title)).map(adaptAnime);
}

export async function animeDetail(slug: string, signal: AbortSignal) {
  if (!showId.test(slug)) throw new Error("The anime link is invalid.");
  const path = animeOrigin + "/api/show/" + slug;
  const [details, episodes] = await Promise.all([
    json<Anime>(path, signal),
    json<Page<Episode>>(path + "/episodes?page=1&lang=ja-JP", signal),
  ]);
  return {
    show: adaptAnime({ ...details, slug }), external: animeOrigin + "/" + slug,
    episodes: episodes.result.filter((episode) => showId.test(episode.slug) && showId.test(episode.episode_string)),
  };
}
