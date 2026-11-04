import { useQuery } from "@tanstack/react-query";
import {
  fetchPlayback,
  fetchSearch,
  fetchShorts,
  fetchVideos,
  fetchWatch,
} from "./api";
import type { YtVideo } from "./types";

const FIVE_MIN = 1000 * 60 * 5;

export const useYtFeed = (filter: string) =>
  useQuery({
    queryKey: ["yt", "feed", filter],
    queryFn: ({ signal }) => fetchVideos(filter, 1, signal),
    staleTime: FIVE_MIN,
    retry: 1,
  });

export const useYtShorts = (query: string) =>
  useQuery({
    queryKey: ["yt", "shorts", query],
    queryFn: ({ signal }) => fetchShorts(query, 1, signal),
    staleTime: FIVE_MIN,
    retry: 1,
  });

export const useYtSearch = (query: string) =>
  useQuery({
    queryKey: ["yt", "search", query],
    queryFn: ({ signal }) => fetchSearch(query, signal),
    enabled: query.trim().length > 0,
    staleTime: FIVE_MIN,
    retry: 1,
  });

export const useYtWatch = (video: YtVideo | undefined, link: string, enabled = true) =>
  useQuery({
    queryKey: ["yt", "watch", link],
    queryFn: ({ signal }) => fetchWatch(video, link, signal),
    enabled: enabled && !!link,
    staleTime: FIVE_MIN,
    retry: 1,
  });

export const useYtPlayback = (link: string, enabled = true) =>
  useQuery({
    queryKey: ["yt", "playback", link],
    queryFn: ({ signal }) => fetchPlayback(link, signal),
    enabled: enabled && !!link,
    // Stream URLs are signed and expire, so keep them only briefly.
    staleTime: 1000 * 60 * 10,
    retry: 1,
  });
