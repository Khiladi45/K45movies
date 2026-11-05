import { executeProvider, providerApi } from "@/lib/providerApi";
import { normalizeStreams, selectPlaybackStreams, type PlayableStream } from "@/lib/streams";
import type { YtCommentsPage, YtHomeTab, YtQuality, YtVideo, YtWatch } from "./types";

/** The bundled YouTube provider. It ships with the app, so it is always there. */
export const YT_PROVIDER = "youtube";

// Filters match K45movies-api/providers/youtube/catalog.ts. "#shorts" switches
// the provider into Shorts-only (9:16) results.
export const HOME_TABS: YtHomeTab[] = [
  { key: "home", label: "Home", filter: "trending", shortsFilter: "#shorts trending" },
  { key: "music", label: "Music", filter: "trending music", shortsFilter: "#shorts music" },
  { key: "live", label: "Live", filter: "live now", shortsFilter: "#shorts live" },
  { key: "gaming", label: "Gaming", filter: "trending gaming", shortsFilter: "#shorts gaming" },
];

export const DEFAULT_SHORTS_QUERY = HOME_TABS[0].shortsFilter;

const idFromLink = (link: string): string => {
  const match = String(link || "").match(
    /(?:v=|\/shorts\/|\/embed\/|youtu\.be\/)([A-Za-z0-9_-]{11})/,
  );
  return match ? match[1] : "";
};

/**
 * Maps one provider post to a YtVideo. Reads the structured fields the API now
 * returns; an older provider bundle that only sends `tag` ("Channel • 1M views")
 * still works through the fallback.
 */
export function toVideo(post: any): YtVideo | null {
  if (!post || typeof post.link !== "string" || !post.title) return null;
  const id = post.videoId || idFromLink(post.link);
  if (!id) return null;

  let channelName = post.channelName || "";
  let views = post.views || "";
  if (!channelName && typeof post.tag === "string") {
    const [channel, count] = post.tag.split(" • ");
    channelName = channel || "";
    views = views || count || "";
  }

  const isShort =
    typeof post.isShort === "boolean" ? post.isShort : /\/shorts\//.test(post.link);

  return {
    id,
    title: String(post.title),
    link: post.link,
    image: post.image || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    channelName,
    channelAvatar: post.channelAvatar || undefined,
    views,
    publishedTime: post.publishedTime || "",
    duration: post.duration || post.cornerTag || "",
    aspectRatio: Number(post.aspectRatio) || (isShort ? 9 / 16 : 16 / 9),
    isShort,
    isLive: !!post.isLive,
  };
}

const dedupe = (videos: (YtVideo | null)[]): YtVideo[] => {
  const seen = new Set<string>();
  const out: YtVideo[] = [];
  for (const video of videos) {
    if (!video || seen.has(video.id)) continue;
    seen.add(video.id);
    out.push(video);
  }
  return out;
};

async function fetchPosts(
  query: string,
  page: number,
  signal?: AbortSignal,
): Promise<YtVideo[]> {
  const raw = await providerApi.getPosts(YT_PROVIDER, query, page, signal);
  return dedupe((Array.isArray(raw) ? raw : []).map(toVideo));
}

/** Regular videos for a Home tab or a search (Shorts live in their own shelf). */
export async function fetchVideos(
  query: string,
  page = 1,
  signal?: AbortSignal,
): Promise<YtVideo[]> {
  return (await fetchPosts(query, page, signal)).filter((v) => !v.isShort);
}

export async function fetchShorts(
  query: string = DEFAULT_SHORTS_QUERY,
  page = 1,
  signal?: AbortSignal,
): Promise<YtVideo[]> {
  const q = /#shorts\b/i.test(query) ? query : `#shorts ${query}`;
  return (await fetchPosts(q, page, signal)).filter((v) => v.isShort);
}

/** Search results, Shorts included so a result can open the Shorts player. */
export async function fetchSearch(
  query: string,
  page = 1,
  signal?: AbortSignal,
): Promise<YtVideo[]> {
  return fetchPosts(query, page, signal);
}

/** Live suggestions while typing (YouTube's own autocomplete, via the API). */
export async function fetchSuggestions(
  query: string,
  signal?: AbortSignal,
): Promise<string[]> {
  const text = query.trim();
  if (!text) return [];
  const raw: any = await executeProvider(
    YT_PROVIDER,
    "posts",
    "getSuggestions",
    { query: text },
    signal,
  );
  return (Array.isArray(raw) ? raw : []).map((v) => String(v)).filter(Boolean).slice(0, 10);
}

/** One page of comments, or of replies when `continuation` is a reply token. */
export async function fetchComments(
  link: string,
  continuation?: string,
  signal?: AbortSignal,
): Promise<YtCommentsPage> {
  const raw: any = await executeProvider(
    YT_PROVIDER,
    "meta",
    "getComments",
    { link, continuation },
    signal,
  );
  return {
    comments: Array.isArray(raw?.comments) ? raw.comments : [],
    count: String(raw?.count || ""),
    continuation: raw?.continuation || undefined,
  };
}

export async function fetchWatch(
  video: YtVideo | undefined,
  link: string,
  signal?: AbortSignal,
): Promise<YtWatch> {
  const meta: any = await providerApi.getMeta(YT_PROVIDER, link, signal);
  const base: YtVideo =
    toVideo({
      title: meta?.title || video?.title || "YouTube video",
      link,
      image: meta?.image || video?.image,
      videoId: meta?.videoId || video?.id,
      channelName: meta?.channelName || video?.channelName,
      channelAvatar: meta?.channelAvatar || video?.channelAvatar,
      views: meta?.views || video?.views,
      publishedTime: meta?.publishedTime || video?.publishedTime,
      duration: meta?.duration || video?.duration,
      isShort: meta?.isShort ?? video?.isShort,
      aspectRatio: meta?.aspectRatio ?? video?.aspectRatio,
    }) ??
    (video as YtVideo);

  const related = dedupe(
    (Array.isArray(meta?.related) ? meta.related : []).map(toVideo),
  ).filter((v) => v.id !== base.id);

  return {
    video: base,
    description: String(meta?.synopsis || ""),
    likes: String(meta?.likes || ""),
    related,
  };
}

/** Resolves playable streams for a video and picks the best candidate first. */
export async function fetchPlayback(link: string, signal?: AbortSignal) {
  const all = await fetchStreamList(link, signal);
  // Per-height HLS renditions are for the quality picker (they may lack audio);
  // playback uses the master playlist or the muxed MP4s.
  const candidates = all.filter((s) => !(s.format === "hls" && s.height));
  return selectPlaybackStreams(candidates.length ? candidates : all, {
    preference: "auto",
    signal,
  });
}

const STREAM_TTL = 1000 * 60 * 10;
const streamCache = new Map<string, { at: number; promise: Promise<PlayableStream[]> }>();

/** All streams of a video, normalised. Shared by playback, gear menu and downloads. */
export function fetchStreamList(
  link: string,
  signal?: AbortSignal,
): Promise<PlayableStream[]> {
  const hit = streamCache.get(link);
  if (hit && Date.now() - hit.at < STREAM_TTL) return hit.promise;
  const promise = (async () => {
    const raw: any = await providerApi.getStream(YT_PROVIDER, link, "movie", signal);
    const list = Array.isArray(raw) ? raw : Array.isArray(raw?.streams) ? raw.streams : [];
    return normalizeStreams(list);
  })();
  streamCache.set(link, { at: Date.now(), promise });
  promise.catch(() => streamCache.delete(link));
  return promise;
}

const isMuxedStream = (s: PlayableStream) =>
  !/video only/i.test(String(s.raw?.tag || ""));

/**
 * Qualities for the gear menu: every height the API listed (highest first).
 * `muxed` is false for HLS renditions whose audio is a separate track; those
 * play fine through the master playlist but can't be saved as one file.
 */
export function qualitiesOf(streams: PlayableStream[]): YtQuality[] {
  const byHeight = new Map<number, YtQuality>();
  for (const s of streams) {
    const h = s.height || 0;
    if (!h) continue;
    const muxed = isMuxedStream(s) && (s.format === "mp4" || s.format === "hls");
    const prev = byHeight.get(h);
    if (!prev) byHeight.set(h, { height: h, label: `${h}p`, muxed });
    else if (muxed) prev.muxed = true;
  }
  return [...byHeight.values()].sort((a, b) => b.height - a.height);
}

/** Streams that can be downloaded as a single file, best first, one per height. */
export function downloadableStreams(streams: PlayableStream[]): PlayableStream[] {
  const picked = new Map<number, PlayableStream>();
  for (const s of streams) {
    const h = s.height || 0;
    if (!h || !isMuxedStream(s)) continue;
    const prev = picked.get(h);
    // Prefer an MP4 (one file) over an HLS rendition at the same height.
    if (!prev || (prev.format !== "mp4" && s.format === "mp4")) picked.set(h, s);
  }
  return [...picked.values()].sort((a, b) => (b.height || 0) - (a.height || 0));
}

/** The master adaptive playlist (Auto), when the provider returned one. */
export const masterStream = (streams: PlayableStream[]): PlayableStream | undefined =>
  streams.find((s) => s.format === "hls" && !s.height);
