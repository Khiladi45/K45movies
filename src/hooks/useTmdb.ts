import { useQuery } from "@tanstack/react-query";
import {
  getDetails,
  getSeason,
  searchTmdb,
  type TmdbItem,
  type TmdbMediaType,
} from "../lib/tmdbApi";

const TEN_MINUTES = 1000 * 60 * 10;

/** One horizontal row on the Movie Based Home screen. */
export const useTmdbRow = (
  key: string,
  fetcher: (signal?: AbortSignal) => Promise<TmdbItem[]>,
  enabled = true,
) =>
  useQuery({
    queryKey: ["tmdb", "row", key],
    queryFn: ({ signal }) => fetcher(signal),
    enabled,
    staleTime: TEN_MINUTES,
    retry: 1,
  });

export const useTmdbSearch = (query: string) =>
  useQuery({
    queryKey: ["tmdb", "search", query.trim().toLowerCase()],
    queryFn: ({ signal }) => searchTmdb(query, signal),
    enabled: query.trim().length > 1,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

export const useTmdbDetails = (type: TmdbMediaType, id: number) =>
  useQuery({
    queryKey: ["tmdb", "details", type, id],
    queryFn: ({ signal }) => getDetails(type, id, signal),
    enabled: !!id,
    staleTime: TEN_MINUTES,
    retry: 1,
  });

export const useTmdbSeason = (id: number, season: number | null) =>
  useQuery({
    queryKey: ["tmdb", "season", id, season],
    queryFn: ({ signal }) => getSeason(id, season as number, signal),
    enabled: !!id && season != null,
    staleTime: TEN_MINUTES,
    retry: 1,
  });
