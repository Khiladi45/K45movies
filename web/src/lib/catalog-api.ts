import type { Category, Episode, MediaType, Post, Provider, ProviderDetail, Source, Title, TitleDetail, TitleEpisode } from "./catalog-types";

export class CatalogError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function get<T>(service: "providers" | "tmdb", params: Record<string, string>, signal?: AbortSignal): Promise<T> {
  const res = await fetch("/api/proxy/" + service + "?" + new URLSearchParams(params), { signal });
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new CatalogError(res.status, payload?.error || "Catalog request failed.");
  }
  return res.json();
}

export const providers = {
  manifest: (signal?: AbortSignal) => get<Provider[]>("providers", { op: "manifest" }, signal),
  catalog: (id: string, signal?: AbortSignal) => get<Category[]>("providers", { op: "catalog", id }, signal),
  posts: (id: string, filter: string, page: number, signal?: AbortSignal) =>
    get<Post[]>("providers", { op: "posts", id, filter, page: String(page) }, signal),
  search: (id: string, q: string, signal?: AbortSignal) => get<Post[]>("providers", { op: "search", id, q }, signal),
  title: (id: string, ref: string, signal?: AbortSignal) => get<ProviderDetail>("providers", { op: "title", id, ref }, signal),
  episodes: (id: string, ref: string, signal?: AbortSignal) => get<Episode[]>("providers", { op: "episodes", id, ref }, signal),
  sources: (id: string, ref: string, type: "movie" | "series", signal?: AbortSignal) =>
    get<Source[]>("providers", { op: "sources", id, ref, type }, signal),
};

export type MovieRow = "trending" | "popular" | "top" | "now" | "air" | "discover" | "language";
type TitlePage = { items: Title[]; more: boolean };
export const tmdb = {
  row: (row: MovieRow, type: MediaType, page: number, language?: string, signal?: AbortSignal) =>
    get<TitlePage>("tmdb", { op: "row", row, type, page: String(page), ...(language ? { language } : {}) }, signal),
  search: (q: string, page: number, signal?: AbortSignal) => get<TitlePage>("tmdb", { op: "search", q, page: String(page) }, signal),
  title: (type: MediaType, id: number, signal?: AbortSignal) => get<TitleDetail>("tmdb", { op: "title", type, id: String(id) }, signal),
  season: (id: number, season: number, signal?: AbortSignal) =>
    get<TitleEpisode[]>("tmdb", { op: "season", id: String(id), season: String(season) }, signal),
};
