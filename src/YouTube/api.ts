import { executeProvider, providerApi } from "@/lib/providerApi";
import { normalizeStreams, type PlayableStream } from "@/lib/streams";
import type { YtCommentsPage, YtDownloadOption, YtHomeTab, YtQuality, YtVideo, YtWatch } from "./types";

/** The bundled YouTube provider. It ships with the app, so it is always there. */
export const YT_PROVIDER = "youtube";

// Filters match K45movies-api/providers/youtube/catalog.ts. "#shorts" switches
// the provider into Shorts-only (9:16) results.
export const HOME_TABS: YtHomeTab[] = [
  {
    key: "home",
    label: "Home",
    filter: "trending",
    shortsFilter: "#shorts trending",
    // Home mixes many topics, round-robin, so it never runs dry.
    topics: [
      "new movie trailers",
      "tamil new songs",
      "tamil latest news",
      "tech news",
      "telugu new songs",
      "movie reviews",
      "malayalam new songs",
      "cricket highlights",
      "gadget reviews",
      "hindi new songs",
      "comedy scenes",
      "kannada new songs",
      "korean drama clips",
      "gaming highlights",
      "science facts",
      "food recipes",
      "motivation speech",
      "bike reviews",
    ],
  },
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

/**
 * Playable streams, best first. Deliberately no probing: probing every URL
 * before playing cost seconds; the player falls back on error instead.
 * Per-height HLS renditions (may lack audio) and single-track files are for the
 * gear menu and downloads, never for playback.
 */
export async function fetchPlayback(link: string, signal?: AbortSignal) {
  // Start-up path: no per-height playlist request (see the API's `fast`).
  // A full list already in the cache is reused.
  const all = await fetchFastStreams(link, signal);
  const playable = all.filter((s) => !s.raw?.kind && !(s.format === "hls" && s.height));
  const streams = (playable.length ? playable : all).slice().sort((a, b) => {
    const rank = (s: PlayableStream) => (s.format === "hls" ? 0 : 1);
    return rank(a) - rank(b);
  });
  return { streams, startIndex: 0 };
}

/** Starts resolving a video's streams so playback begins sooner. Never throws. */
export function prefetchStreams(link: string) {
  if (link) fetchFastStreams(link).catch(() => {});
}

const fastCache = new Map<string, { at: number; promise: Promise<PlayableStream[]> }>();

/**
 * The cached stream requests are shared by every caller (prefetch, player,
 * gear menu, downloads), so they run without any one caller's signal. Each
 * caller only stops waiting when its own signal fires.
 */
function waitFor<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(new Error("canceled"));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new Error("canceled"));
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

/** Master playlist + muxed MP4s only: the quickest answer for starting playback. */
function fetchFastStreams(link: string, signal?: AbortSignal): Promise<PlayableStream[]> {
  const full = streamCache.get(link);
  if (full && Date.now() - full.at < STREAM_TTL) return waitFor(full.promise, signal);
  const hit = fastCache.get(link);
  if (hit && Date.now() - hit.at < STREAM_TTL) return waitFor(hit.promise, signal);
  const promise = (async () => {
    const raw: any = await executeProvider(
      YT_PROVIDER,
      "stream",
      "getStream",
      { link, type: "movie", provider: YT_PROVIDER, fast: true },
    );
    const list = Array.isArray(raw) ? raw : Array.isArray(raw?.streams) ? raw.streams : [];
    return normalizeStreams(list);
  })();
  fastCache.set(link, { at: Date.now(), promise });
  promise.catch(() => fastCache.delete(link));
  return waitFor(promise, signal);
}

const STREAM_TTL = 1000 * 60 * 10;
const streamCache = new Map<string, { at: number; promise: Promise<PlayableStream[]> }>();

/** All streams of a video, normalised. Shared by playback, gear menu and downloads. */
export function fetchStreamList(
  link: string,
  signal?: AbortSignal,
): Promise<PlayableStream[]> {
  const hit = streamCache.get(link);
  if (hit && Date.now() - hit.at < STREAM_TTL) return waitFor(hit.promise, signal);
  const promise = (async () => {
    const raw: any = await providerApi.getStream(YT_PROVIDER, link, "movie");
    const list = Array.isArray(raw) ? raw : Array.isArray(raw?.streams) ? raw.streams : [];
    return normalizeStreams(list);
  })();
  streamCache.set(link, { at: Date.now(), promise });
  promise.catch(() => streamCache.delete(link));
  return waitFor(promise, signal);
}

const isMuxedStream = (s: PlayableStream) =>
  !s.raw?.kind && !/video only/i.test(String(s.raw?.tag || ""));

/**
 * Qualities for the gear menu: heights the player can switch between on the
 * adaptive playlist (highest first). Single-track files are not included.
 */
export function qualitiesOf(streams: PlayableStream[]): YtQuality[] {
  const byHeight = new Map<number, YtQuality>();
  for (const s of streams) {
    const h = s.height || 0;
    if (!h || s.raw?.kind) continue;
    const muxed = isMuxedStream(s);
    const prev = byHeight.get(h);
    if (!prev) byHeight.set(h, { height: h, label: qualityName(h), muxed });
    else if (muxed) prev.muxed = true;
  }
  return [...byHeight.values()].sort((a, b) => b.height - a.height);
}

export const qualityName = (h: number) =>
  h >= 4320 ? "4320p · 8K" : h >= 2160 ? "2160p · 4K" : h >= 1440 ? "1440p · 2K" : `${h}p`;

const formatSize = (bytes: number) =>
  bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${Math.max(1, Math.round(bytes / 1e6))} MB`;

/**
 * Everything the download sheet can offer, tallest first, one row per height:
 * a single audio+video file when one exists, otherwise a video-only MP4 paired
 * with the best audio-only MP4 (joined by the app after download).
 */
export function downloadOptions(streams: PlayableStream[]): YtDownloadOption[] {
  const audios = streams
    .filter((s) => s.raw?.kind === "audio" && Number(s.raw?.size) > 0)
    .sort((a, b) => (Number(b.raw.bitrate) || 0) - (Number(a.raw.bitrate) || 0));
  const bestAudio = audios.find((s) => /mp4a/i.test(String(s.raw?.codec))) || audios[0];

  const rows = new Map<number, YtDownloadOption>();
  // Merged pairs first, then a muxed file replaces them at the same height.
  const videos = streams.filter((s) => s.raw?.kind === "video" && Number(s.raw?.size) > 0 && s.height);
  for (const v of videos) {
    if (!bestAudio) break;
    const h = v.height as number;
    const prev = rows.get(h);
    // H.264 plays everywhere; AV1 only when nothing else exists at that height.
    const codecRank = (x: PlayableStream) => (/avc1/i.test(String(x.raw?.codec)) ? 0 : 1);
    if (prev && codecRank(prev.video) <= codecRank(v)) continue;
    const bytes = Number(v.raw.size) + Number(bestAudio.raw.size);
    const codec = /av01/i.test(String(v.raw?.codec)) ? "AV1" : "MP4";
    rows.set(h, {
      height: h,
      label: qualityName(h),
      detail: `${codec} · ${formatSize(bytes)}`,
      video: v,
      audio: bestAudio,
    });
  }
  for (const s of streams) {
    if (!isMuxedStream(s) || !s.height || s.format === "dash") continue;
    // HLS with a separate audio group can't be saved; only muxed MP4 or muxed HLS.
    if (rows.has(s.height) && rows.get(s.height)!.audio) {
      // Prefer the real file over a merge only when it's an MP4 of equal height.
      if (s.format !== "mp4") continue;
    }
    if (rows.has(s.height) && !rows.get(s.height)!.audio) continue;
    rows.set(s.height, {
      height: s.height,
      label: qualityName(s.height),
      detail: s.format === "mp4" ? "MP4" : "HLS",
      video: s,
    });
  }
  return [...rows.values()].sort((a, b) => b.height - a.height);
}

/** The master adaptive playlist (Auto), when the provider returned one. */
export const masterStream = (streams: PlayableStream[]): PlayableStream | undefined =>
  streams.find((s) => s.format === "hls" && !s.height);
