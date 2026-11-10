// TMDB client for the Movie Based layout. The key comes from
// EXPO_PUBLIC_TMDB_KEY and may be either a v3 API key or a v4 "API Read Access
// Token" (the long JWT) — both are supported.

const BASE = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p";

const RAW_KEY = (process.env.EXPO_PUBLIC_TMDB_KEY || "").trim();
const IS_BEARER = RAW_KEY.startsWith("eyJ") && RAW_KEY.length > 60;

export const tmdbConfigured = (): boolean => RAW_KEY.length > 0;

export type TmdbMediaType = "movie" | "tv";

export type TmdbItem = {
  id: number;
  mediaType: TmdbMediaType;
  title: string;
  originalTitle: string;
  overview: string;
  poster: string | null;
  backdrop: string | null;
  year: string;
  rating: number;
  originalLanguage: string;
};

export type TmdbCast = {
  id: number;
  name: string;
  character: string;
  photo: string | null;
};

export type TmdbSeasonSummary = {
  number: number;
  name: string;
  episodeCount: number;
  airYear: string;
  poster: string | null;
};

export type TmdbDetails = TmdbItem & {
  tagline: string;
  genres: string[];
  runtime: number | null;
  status: string;
  certification: string;
  cast: TmdbCast[];
  trailerKey: string | null;
  similar: TmdbItem[];
  spokenLanguages: string[];
  seasons: TmdbSeasonSummary[];
  numberOfSeasons: number;
  numberOfEpisodes: number;
};

export type TmdbEpisode = {
  number: number;
  name: string;
  overview: string;
  still: string | null;
  runtime: number | null;
  airDate: string;
  rating: number;
};

export type TmdbSeason = {
  number: number;
  name: string;
  overview: string;
  episodes: TmdbEpisode[];
};

export const tmdbImage = (
  path: string | null | undefined,
  size: "w185" | "w342" | "w500" | "w780" | "original" = "w342",
): string | null => (path ? `${IMG}/${size}${path}` : null);

async function request<T = any>(
  path: string,
  params: Record<string, string | number | boolean | undefined> = {},
  signal?: AbortSignal,
): Promise<T> {
  if (!RAW_KEY) {
    throw new Error(
      "TMDB key missing. Set EXPO_PUBLIC_TMDB_KEY in your .env and rebuild.",
    );
  }
  const query = new URLSearchParams();
  if (!IS_BEARER) query.set("api_key", RAW_KEY);
  query.set("language", "en-US");
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });

  const response = await fetch(`${BASE}${path}?${query.toString()}`, {
    signal,
    headers: IS_BEARER
      ? { Authorization: `Bearer ${RAW_KEY}`, accept: "application/json" }
      : { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(
      response.status === 401
        ? "TMDB rejected the API key (401). Check EXPO_PUBLIC_TMDB_KEY."
        : `TMDB request failed (${response.status})`,
    );
  }
  return (await response.json()) as T;
}

const yearOf = (date?: string | null) =>
  date && date.length >= 4 ? date.slice(0, 4) : "";

function toItem(raw: any, fallbackType?: TmdbMediaType): TmdbItem | null {
  const mediaType: TmdbMediaType | undefined =
    raw?.media_type === "movie" || raw?.media_type === "tv"
      ? raw.media_type
      : fallbackType;
  if (!mediaType || typeof raw?.id !== "number") return null;
  const title = raw.title || raw.name || "";
  if (!title) return null;
  return {
    id: raw.id,
    mediaType,
    title,
    originalTitle: raw.original_title || raw.original_name || title,
    overview: raw.overview || "",
    poster: raw.poster_path || null,
    backdrop: raw.backdrop_path || null,
    year: yearOf(raw.release_date || raw.first_air_date),
    rating: Number(raw.vote_average) || 0,
    originalLanguage: raw.original_language || "",
  };
}

import { bestRatedFirst, releaseWindow } from "./releaseWindow";

const toItems = (results: any[], fallbackType?: TmdbMediaType): TmdbItem[] =>
  (Array.isArray(results) ? results : [])
    .map((raw) => toItem(raw, fallbackType))
    .filter((item): item is TmdbItem => !!item);

// ---- Home rows -------------------------------------------------------------

export const getTrending = async (signal?: AbortSignal) =>
  toItems((await request("/trending/all/week", {}, signal)).results);

export const getPopular = async (type: TmdbMediaType, signal?: AbortSignal) =>
  toItems((await request(`/${type}/popular`, {}, signal)).results, type);

export const getTopRated = async (type: TmdbMediaType, signal?: AbortSignal) =>
  toItems((await request(`/${type}/top_rated`, {}, signal)).results, type);

export const getNowPlaying = async (signal?: AbortSignal) =>
  toItems((await request("/movie/now_playing", {}, signal)).results, "movie");

export const getOnTheAir = async (signal?: AbortSignal) =>
  toItems((await request("/tv/on_the_air", {}, signal)).results, "tv");

/** Popular titles whose original language matches the user's audio language. */
export const getPopularInLanguage = async (
  type: TmdbMediaType,
  language: string,
  signal?: AbortSignal,
) =>
  toItems(
    (
      await request(
        `/discover/${type}`,
        {
          with_original_language: language,
          sort_by: "popularity.desc",
          "vote_count.gte": 20,
          include_adult: false,
        },
        signal,
      )
    ).results,
    type,
  );

/**
 * Movies in a language released in the last `days` days, best rated first.
 * New releases often have few votes, so unrated ones follow by popularity
 * and the row is not empty.
 */
export const getNewReleasesInLanguage = async (
  language: string,
  days = 7,
  signal?: AbortSignal,
) => {
  const { from, to } = releaseWindow(new Date(), days);
  const base = {
    with_original_language: language,
    "primary_release_date.gte": from,
    "primary_release_date.lte": to,
    include_adult: false,
  };
  const [rated, popular] = await Promise.all([
    request(
      "/discover/movie",
      { ...base, sort_by: "vote_average.desc", "vote_count.gte": 1 },
      signal,
    ),
    request("/discover/movie", { ...base, sort_by: "popularity.desc" }, signal),
  ]);
  return bestRatedFirst(toItems(rated.results, "movie"), toItems(popular.results, "movie"));
};

/** A random page of popular titles, so Home feels different between launches. */
export const getDiscover = async (
  type: TmdbMediaType,
  page: number,
  signal?: AbortSignal,
) =>
  toItems(
    (
      await request(
        `/discover/${type}`,
        {
          sort_by: "popularity.desc",
          "vote_count.gte": 200,
          include_adult: false,
          page,
        },
        signal,
      )
    ).results,
    type,
  );

// ---- Search ----------------------------------------------------------------

export const searchTmdb = async (
  query: string,
  signal?: AbortSignal,
): Promise<TmdbItem[]> => {
  const data = await request(
    "/search/multi",
    { query: query.trim(), include_adult: false },
    signal,
  );
  return toItems(data.results).filter(
    (item) => item.mediaType === "movie" || item.mediaType === "tv",
  );
};

// ---- Details ---------------------------------------------------------------

const certificationOf = (type: TmdbMediaType, data: any): string => {
  if (type === "movie") {
    const results: any[] = data?.release_dates?.results || [];
    const pick =
      results.find((r) => r.iso_3166_1 === "IN") ||
      results.find((r) => r.iso_3166_1 === "US");
    return (
      pick?.release_dates?.find((r: any) => r.certification)?.certification ||
      ""
    );
  }
  const results: any[] = data?.content_ratings?.results || [];
  const pick =
    results.find((r) => r.iso_3166_1 === "IN") ||
    results.find((r) => r.iso_3166_1 === "US");
  return pick?.rating || "";
};

export const getDetails = async (
  type: TmdbMediaType,
  id: number,
  signal?: AbortSignal,
): Promise<TmdbDetails> => {
  const data = await request(
    `/${type}/${id}`,
    {
      append_to_response:
        type === "movie"
          ? "credits,videos,similar,release_dates"
          : "credits,videos,similar,content_ratings",
    },
    signal,
  );
  const base = toItem({ ...data, media_type: type }, type);
  if (!base) throw new Error("TMDB returned an unreadable title.");

  const trailer = (data.videos?.results || []).find(
    (video: any) => video.site === "YouTube" && video.type === "Trailer",
  );

  const runtime =
    type === "movie"
      ? Number(data.runtime) || null
      : Number((data.episode_run_time || [])[0]) || null;

  return {
    ...base,
    tagline: data.tagline || "",
    genres: (data.genres || []).map((genre: any) => genre.name),
    runtime,
    status: data.status || "",
    certification: certificationOf(type, data),
    cast: (data.credits?.cast || []).slice(0, 20).map((person: any) => ({
      id: person.id,
      name: person.name,
      character: person.character || "",
      photo: person.profile_path || null,
    })),
    trailerKey: trailer?.key || null,
    similar: toItems(data.similar?.results || [], type).slice(0, 15),
    spokenLanguages: (data.spoken_languages || [])
      .map((language: any) => language.iso_639_1)
      .filter(Boolean),
    seasons:
      type === "tv"
        ? (data.seasons || [])
            .filter((season: any) => season.season_number > 0)
            .map((season: any) => ({
              number: season.season_number,
              name: season.name || `Season ${season.season_number}`,
              episodeCount: season.episode_count || 0,
              airYear: yearOf(season.air_date),
              poster: season.poster_path || null,
            }))
        : [],
    numberOfSeasons: Number(data.number_of_seasons) || 0,
    numberOfEpisodes: Number(data.number_of_episodes) || 0,
  };
};

export const getSeason = async (
  id: number,
  seasonNumber: number,
  signal?: AbortSignal,
): Promise<TmdbSeason> => {
  const data = await request(`/tv/${id}/season/${seasonNumber}`, {}, signal);
  return {
    number: data.season_number ?? seasonNumber,
    name: data.name || `Season ${seasonNumber}`,
    overview: data.overview || "",
    episodes: (data.episodes || []).map((episode: any) => ({
      number: episode.episode_number,
      name: episode.name || `Episode ${episode.episode_number}`,
      overview: episode.overview || "",
      still: episode.still_path || null,
      runtime: Number(episode.runtime) || null,
      airDate: episode.air_date || "",
      rating: Number(episode.vote_average) || 0,
    })),
  };
};
