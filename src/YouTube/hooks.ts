import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  downloadableStreams,
  fetchComments,
  fetchPlayback,
  fetchSearch,
  fetchShorts,
  fetchStreamList,
  fetchSuggestions,
  fetchVideos,
  fetchWatch,
  masterStream,
  qualitiesOf,
} from "./api";
import type { YtVideo } from "./types";

const FIVE_MIN = 1000 * 60 * 5;

/**
 * Pages of a feed. The provider repeats its last page once it runs out, so a
 * page with nothing new ends the list instead of looping forever.
 */
function usePagedVideos(
  key: unknown[],
  load: (page: number, signal?: AbortSignal) => Promise<YtVideo[]>,
  enabled = true,
) {
  return useInfiniteQuery({
    queryKey: key,
    enabled,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => load(pageParam as number, signal),
    getNextPageParam: (last, all) => {
      if (last.length === 0 || all.length >= 30) return undefined;
      const seen = new Set(all.slice(0, -1).flat().map((v) => v.id));
      return last.some((v) => !seen.has(v.id)) ? all.length + 1 : undefined;
    },
    select: (data) => {
      const seen = new Set<string>();
      const items: YtVideo[] = [];
      for (const page of data.pages)
        for (const v of page)
          if (!seen.has(v.id)) {
            seen.add(v.id);
            items.push(v);
          }
      return items;
    },
    staleTime: FIVE_MIN,
    retry: 1,
  });
}

export const useYtFeed = (filter: string) =>
  usePagedVideos(["yt", "feed", filter], (page, signal) => fetchVideos(filter, page, signal));

export const useYtShorts = (query: string) =>
  usePagedVideos(["yt", "shorts", query], (page, signal) => fetchShorts(query, page, signal));

export const useYtSearch = (query: string) =>
  usePagedVideos(
    ["yt", "search", query],
    (page, signal) => fetchSearch(query, page, signal),
    query.trim().length > 0,
  );

export const useYtSuggestions = (query: string) =>
  useQuery({
    queryKey: ["yt", "suggest", query.trim().toLowerCase()],
    queryFn: ({ signal }) => fetchSuggestions(query, signal),
    enabled: query.trim().length > 0,
    staleTime: FIVE_MIN,
    retry: 0,
  });

export const useYtWatch = (video: YtVideo | undefined, link: string, enabled = true) =>
  useQuery({
    queryKey: ["yt", "watch", link],
    queryFn: ({ signal }) => fetchWatch(video, link, signal),
    enabled: enabled && !!link,
    staleTime: FIVE_MIN,
    retry: 1,
  });

/** Comments (continuation = null) or the replies of one comment. */
export const useYtComments = (link: string, replyToken?: string, enabled = true) =>
  useInfiniteQuery({
    queryKey: ["yt", "comments", link, replyToken ?? ""],
    enabled: enabled && !!link,
    initialPageParam: replyToken as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      fetchComments(link, (pageParam as string | undefined) || undefined, signal),
    getNextPageParam: (last) => last.continuation,
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

/** Every rendition of a video: gear-menu heights, the master, downloadable files. */
export const useYtStreamInfo = (link: string, enabled = true) =>
  useQuery({
    queryKey: ["yt", "streaminfo", link],
    queryFn: async ({ signal }) => {
      const streams = await fetchStreamList(link, signal);
      return {
        qualities: qualitiesOf(streams),
        master: masterStream(streams),
        downloads: downloadableStreams(streams),
      };
    },
    enabled: enabled && !!link,
    staleTime: 1000 * 60 * 10,
    retry: 1,
  });
