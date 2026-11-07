import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  downloadOptions,
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

export const useYtFeed = (filter: string, enabled = true) =>
  usePagedVideos(["yt", "feed", filter], (page, signal) => fetchVideos(filter, page, signal), enabled);

const TOPICS_PER_PAGE = 3;
const MAX_MIXED_PAGES = 400;

/** One video from each list in turn, so no topic dominates a page. */
function interleave(lists: YtVideo[][]): YtVideo[] {
  const out: YtVideo[] = [];
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest; i++) for (const l of lists) if (l[i]) out.push(l[i]);
  return out;
}

/**
 * Endless mixed feed. Page n fetches three topics (cycling through the list,
 * going one result page deeper each time round) and interleaves them.
 */
export const useYtMixedFeed = (topics: string[], enabled = true) =>
  useInfiniteQuery({
    queryKey: ["yt", "mixed", topics.join("|")],
    enabled: enabled && topics.length > 0,
    initialPageParam: 0,
    queryFn: async ({ pageParam, signal }) => {
      const n = topics.length;
      const picks = Array.from({ length: TOPICS_PER_PAGE }, (_, k) => {
        const idx = (pageParam as number) * TOPICS_PER_PAGE + k;
        return { topic: topics[idx % n], page: Math.floor(idx / n) + 1 };
      });
      const lists = await Promise.all(
        picks.map((p) => fetchVideos(p.topic, p.page, signal).catch(() => [] as YtVideo[])),
      );
      return interleave(lists);
    },
    getNextPageParam: (last, all, param) => {
      // Stop only if two pages in a row came back empty (network down, etc.).
      if (last.length === 0 && all.length > 1 && all[all.length - 2].length === 0) return undefined;
      return (param as number) < MAX_MIXED_PAGES ? (param as number) + 1 : undefined;
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
        downloads: downloadOptions(streams),
      };
    },
    enabled: enabled && !!link,
    staleTime: 1000 * 60 * 10,
    retry: 1,
  });
