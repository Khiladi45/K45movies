import "server-only";
import { z } from "zod";
import type { MediaType, Title, TitleDetail, TitleEpisode } from "@/lib/catalog-types";
import { HttpError } from "./http";

const media = z.enum(["movie", "tv"]);
const id = z.coerce.number().int().min(1).max(99_999_999);
const row = z.enum(["trending", "popular", "top", "now", "air", "discover", "language"]);
export const tmdbRequest = z.discriminatedUnion("op", [
  z.object({ op: z.literal("row"), row, type: media.default("movie"),
    page: z.coerce.number().int().min(1).max(100).default(1),
    language: z.string().regex(/^[a-z]{2}$/).optional() }),
  z.object({ op: z.literal("search"), q: z.string().trim().min(2).max(120),
    page: z.coerce.number().int().min(1).max(100).default(1) }),
  z.object({ op: z.literal("title"), type: media, id }),
  z.object({ op: z.literal("season"), id, season: z.coerce.number().int().min(0).max(999) }),
]);

const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === "string" ? value : "";
const number = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : undefined;
const list = (value: unknown) => Array.isArray(value) ? (value as unknown[]).map(record) : [];

function art(value: unknown, size = "w342") {
  return typeof value === "string" && /^\/[\w.-]+$/.test(value) ? "https://image.tmdb.org/t/p/" + size + value : undefined;
}

function title(value: Record<string, unknown>, fallback?: MediaType): Title | undefined {
  const type = value.media_type === undefined ? fallback : media.safeParse(value.media_type).data;
  const id = number(value.id);
  const name = text(value.title || value.name);
  if (!id || !name || !type) return undefined;
  return {
    id, mediaType: type, title: name, originalTitle: text(value.original_title || value.original_name) || name,
    year: text(value.release_date || value.first_air_date).slice(0, 4),
    image: art(value.poster_path), backdrop: art(value.backdrop_path, "w1280"),
    synopsis: text(value.overview), rating: number(value.vote_average),
  };
}

async function request(path: string, params: Record<string, string>, signal: AbortSignal) {
  const key = (process.env.TMDB_API_KEY || process.env.NEXT_PUBLIC_TMDB_KEY || "").trim();
  if (!key) throw new HttpError(503, "Movie Based needs a TMDB API key on the server.");
  const url = new URL("https://api.themoviedb.org/3" + path);
  url.search = new URLSearchParams({ language: "en-US", ...params }).toString();
  const headers = new Headers({ accept: "application/json" });
  if (key.startsWith("eyJ")) headers.set("Authorization", "Bearer " + key);
  else url.searchParams.set("api_key", key);
  const response = await fetch(url, {
    headers, signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
    redirect: "error", next: { revalidate: 300 },
  });
  if (response.status === 404) throw new HttpError(404, "This title was not found.");
  if (response.status === 401 || response.status === 403) throw new HttpError(503, "TMDB credentials were rejected.");
  if (!response.ok) throw new HttpError(502, "TMDB is unavailable. Try again.");
  return record(await response.json());
}

export async function runTmdb(input: z.infer<typeof tmdbRequest>, signal: AbortSignal) {
  if (input.op === "search") {
    const data = await request("/search/multi", { query: input.q, page: String(input.page), include_adult: "false" }, signal);
    return { items: list(data.results).map((value) => title(value)).filter(Boolean), more: input.page < Math.min(number(data.total_pages) ?? 0, 100) };
  }
  if (input.op === "season") {
    const data = await request("/tv/" + input.id + "/season/" + input.season, {}, signal);
    return list(data.episodes).flatMap((episode): TitleEpisode[] => {
      const n = number(episode.episode_number);
      return n === undefined ? [] : [{ number: n, name: text(episode.name) || "Episode " + n, overview: text(episode.overview), image: art(episode.still_path) }];
    });
  }
  const type = input.type;
  if (input.op === "row") {
    const paths = { trending: "/trending/all/week", popular: "/" + type + "/popular",
      top: "/" + type + "/top_rated", now: "/movie/now_playing", air: "/tv/on_the_air",
      discover: "/discover/" + type, language: "/discover/" + type };
    const params: Record<string, string> = { page: String(input.page), include_adult: "false" };
    if (input.row === "discover" || input.row === "language") {
      params.sort_by = "popularity.desc";
      params["vote_count.gte"] = input.row === "language" ? "20" : "200";
      if (input.row === "language" && input.language) params.with_original_language = input.language;
    }
    const data = await request(paths[input.row], params, signal);
    const fallback = input.row === "trending" ? undefined : input.row === "air" ? "tv" : input.row === "now" ? "movie" : type;
    return { items: list(data.results).map((value) => title(value, fallback)).filter(Boolean), more: input.page < Math.min(number(data.total_pages) ?? 0, 100) };
  }
  const appended = type === "movie" ? "release_dates" : "content_ratings";
  const data = await request("/" + type + "/" + input.id, { append_to_response: "credits,videos,similar," + appended }, signal);
  const main = title(data, type);
  if (!main) throw new HttpError(404, "This title was not found.");
  const trailer = text(list(record(data.videos).results).find(({ site, type, key }) => site === "YouTube" && type === "Trailer" && /^[\w-]{11}$/.test(text(key)))?.key);
  const release = list(record(data.release_dates).results).find((item) => item.iso_3166_1 === "US");
  const rating = list(record(data.content_ratings).results).find((item) => item.iso_3166_1 === "US");
  const details: TitleDetail = {
    ...main, runtime: number(data.runtime) ?? number(Array.isArray(data.episode_run_time) ? data.episode_run_time[0] : undefined),
    tagline: text(data.tagline), certification: text(rating?.rating ?? list(release?.release_dates).find((item) => item.certification)?.certification),
    genres: list(data.genres).map(({ name }) => text(name)).filter(Boolean),
    cast: list(record(data.credits).cast).slice(0, 20).map((person) => ({
      name: text(person.name), character: text(person.character), image: art(person.profile_path, "w185"),
    })),
    seasons: list(data.seasons).flatMap((season) => {
      const n = number(season.season_number);
      return n && n > 0 ? [{ number: n, name: text(season.name) || "Season " + n }] : [];
    }),
    similar: list(record(data.similar).results).flatMap((value) => title(value, type) ?? []),
    trailer: trailer ? "https://www.youtube.com/watch?v=" + trailer : undefined,
  };
  return details;
}
