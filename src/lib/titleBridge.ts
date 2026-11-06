// Bridges a TMDB title (movie or series) to the app's existing installed
// providers. It only *uses* providerApi / loadEpisodes / normalizeStreams — it
// never changes how providers work.
//
//   1. search every installed provider by title (a few at a time, results are
//      reported the moment each provider finishes)
//   2. score the posts each provider returns against the TMDB title/year
//   3. read the best posts' links (getMeta) and turn them into SourceOptions:
//      one playable row per quality (movies) or per episode quality (series)

import { queryClient } from "@/lib/queryClient";
import { providerApi } from "@/lib/providerApi";
import { loadEpisodes } from "@/lib/playerSwitch";
import {
  findSameEpisode,
  parseSeasonNumber,
  toPlayerEpisodes,
} from "@/lib/episodes";
import { normalizeStreams } from "@/lib/streams";
import {
  detectLanguagesFromStreams,
  detectLanguagesFromText,
  hasMultiAudioHint,
} from "@/lib/audioLanguages";
import { TEXT_LANGUAGE_NAMES } from "@/lib/languages";
import { fuzzyTitleScore, searchVariants } from "@/lib/fuzzy";
import type { LinkItem, DirectLink } from "@/components/SeasonList";
import { usePlayerStore, type PlayerEpisode } from "@/store/usePlayerStore";
import type { TmdbMediaType } from "@/lib/tmdbApi";

export const PROVIDER_CONCURRENCY = 3;
export const MAX_LANGUAGE_PROBES = 8;

export type BridgeMedia = {
  mediaType: TmdbMediaType;
  title: string;
  originalTitle: string;
  year: string;
  numberOfSeasons?: number;
};

export type ProviderPost = {
  title: string;
  link: string;
  image?: string;
  type?: string;
};

export type ProviderMatch = {
  providerId: string;
  post: ProviderPost;
  score: number;
  meta: any;
  linkList: LinkItem[];
};

export type ProviderState =
  | { providerId: string; status: "searching" }
  | { providerId: string; status: "done"; matches: ProviderMatch[] }
  | { providerId: string; status: "empty" }
  | { providerId: string; status: "error"; message: string };

/** One playable row in the sources list. */
export type SourceOption = {
  id: string;
  providerId: string;
  matchTitle: string;
  label: string;
  detail?: string;
  height: number | null;
  sizeText?: string;
  languages: string[];
  multiAudio: boolean;
  languageChecked: boolean;
  link: string;
  type: string;
  // Position of this row inside the provider's own lists; the player uses
  // them for quality switching and "next episode".
  linkIndex: number;
  itemIndex: number;
  items: PlayerEpisode[];
  linkList: LinkItem[];
};

// ---- pause gate ------------------------------------------------------------
// While the player (or mini-player) is open, no NEW provider work starts: the
// provider search, episode lookups and audio probes wait here and continue
// once the player is fully closed. Requests already in flight finish normally.

let checksPaused = false;
let pauseWaiters: (() => void)[] = [];

export function setSourceChecksPaused(paused: boolean) {
  checksPaused = paused;
  if (!paused) {
    const waiting = pauseWaiters;
    pauseWaiters = [];
    waiting.forEach((resume) => resume());
  }
}

export function waitIfPaused(signal?: AbortSignal): Promise<void> {
  if (!checksPaused || signal?.aborted) return Promise.resolve();
  return new Promise<void>((resolve) => {
    pauseWaiters.push(resolve);
    signal?.addEventListener("abort", () => resolve(), { once: true });
  });
}

// Language probes running in the background when playback starts. They are
// interrupted so they do not compete with the stream that is starting; the
// caller is told and re-queues them for after the player closes.
const backgroundProbes = new Set<AbortController>();

usePlayerStore.subscribe((state) => {
  const paused = !!state.currentVideoUrl;
  if (paused && !checksPaused) {
    backgroundProbes.forEach((controller) => controller.abort());
  }
  setSourceChecksPaused(paused);
});
setSourceChecksPaused(!!usePlayerStore.getState().currentVideoUrl);

// ---- helpers ---------------------------------------------------------------

async function runPool<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
  signal?: AbortSignal,
) {
  let next = 0;
  const lane = async () => {
    while (next < items.length) {
      if (signal?.aborted) return;
      await waitIfPaused(signal);
      if (signal?.aborted || next >= items.length) return;
      const item = items[next++];
      try {
        await worker(item);
      } catch {
        // each worker reports its own failures
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => lane()),
  );
}

const NOISE = new Set([
  "the", "a", "an", "of", "and", "movie", "film", "series", "web", "show",
  "season", "seasons", "complete", "full", "episode", "episodes", "ep", "part",
  "download", "watch", "online", "free", "hd", "fhd", "uhd", "4k", "bd", "rip",
  "web", "dl", "webdl", "webrip", "hdrip", "bluray", "brrip", "dvdrip", "hdtv",
  "hdcam", "cam", "x264", "x265", "hevc", "h264", "h265", "10bit", "esub",
  "esubs", "sub", "subs", "subtitle", "subtitles", "dual", "audio", "multi",
  "dubbed", "dub", "org", "line", "clean", "proper", "extended", "uncut",
  "remastered", "imax", "amzn", "nf", "dsnp", "hmax", "hbo", "zee5", "hotstar",
  "jio", "sony", "prime", "netflix", "aac", "ddp", "dd", "atmos", "hdr", "dv",
  "all", "eps", "official", "original",
]);

const tokenize = (text: string): string[] =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean);

const isNoiseToken = (token: string) =>
  NOISE.has(token) ||
  !!TEXT_LANGUAGE_NAMES[token] ||
  /^(?:19|20)\d{2}$/.test(token) ||
  /^s\d{1,2}(?:e\d{1,3})?$/.test(token) ||
  /^\d{3,4}p$/.test(token) ||
  /^\d+(?:gb|mb)$/.test(token) ||
  /^e\d{1,3}$/.test(token);

const coreTokens = (text: string) =>
  tokenize(text).filter((token) => !isNoiseToken(token));

const yearsIn = (text: string): number[] =>
  (text.match(/\b(?:19|20)\d{2}\b/g) || []).map(Number);

/** 0..1 similarity between a TMDB title and a provider post title. */
export function scoreTitle(
  media: BridgeMedia,
  postTitle: string,
): number {
  const candidates = [media.title, media.originalTitle].filter(
    (value, index, list) => !!value && list.indexOf(value) === index,
  );
  const postCore = coreTokens(postTitle).join(" ");
  if (!postCore) return 0;

  // Fuzzy: tolerant of "&" vs "and", spelling variants, years and quality
  // tags in the post title (see lib/fuzzy.ts).
  let best = 0;
  for (const candidate of candidates) {
    best = Math.max(best, fuzzyTitleScore(candidate, postCore));
  }

  // Movies: a different release year is almost always a different film.
  if (media.mediaType === "movie" && media.year) {
    const years = yearsIn(postTitle);
    if (years.length > 0) {
      const wanted = Number(media.year);
      if (!years.some((year) => Math.abs(year - wanted) <= 1)) best *= 0.5;
    }
  }
  return best;
}

const MIN_SCORE: Record<TmdbMediaType, number> = { movie: 0.6, tv: 0.55 };
const MAX_MATCHES: Record<TmdbMediaType, number> = { movie: 2, tv: 4 };

// True when every character is Latin script (so providers can search for it).
const isLatin = (text: string) => !/[^\u0000-ɏ]/.test(text);

function searchQueries(media: BridgeMedia): string[] {
  const queries = searchVariants(media.title).slice(0, 4);
  if (
    media.originalTitle &&
    media.originalTitle !== media.title &&
    isLatin(media.originalTitle)
  ) {
    queries.push(...searchVariants(media.originalTitle).slice(0, 2));
  }
  const seen = new Set<string>();
  return queries.filter((query) => {
    const key = query.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * queryClient.fetchQuery that is cancelled (so the provider request is
 * aborted) when the caller's signal fires, e.g. the title screen closed.
 */
async function fetchCancellable<T>(
  queryKey: unknown[],
  queryFn: (signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  if (signal?.aborted) throw new Error("canceled");
  const onAbort = () => {
    void queryClient.cancelQueries({ queryKey, exact: true });
  };
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    return await queryClient.fetchQuery({
      queryKey,
      queryFn: ({ signal: querySignal }) => queryFn(querySignal),
      staleTime: 1000 * 60 * 5,
    });
  } finally {
    signal?.removeEventListener("abort", onAbort);
  }
}

async function searchProvider(
  providerId: string,
  query: string,
  signal?: AbortSignal,
): Promise<ProviderPost[]> {
  const results = await fetchCancellable(
    ["bridge-search", providerId, query.toLowerCase()],
    (querySignal) => providerApi.search(query, [providerId], querySignal),
    signal,
  );
  return (Array.isArray(results) ? results : [])
    .filter((item: any) => item && item.title && item.link)
    .map((item: any) => ({
      title: String(item.title),
      link: String(item.link),
      image: item.image,
      type: item.type,
    }));
}

const loadMeta = (providerId: string, link: string, signal?: AbortSignal) =>
  fetchCancellable(
    ["meta", providerId, link],
    (querySignal) => providerApi.getMeta(providerId, link, querySignal),
    signal,
  );

async function buildMatches(
  providerId: string,
  media: BridgeMedia,
  posts: ProviderPost[],
  limit: number,
  skipLinks: Set<string> = new Set(),
  signal?: AbortSignal,
): Promise<ProviderMatch[]> {
  const seen = new Set<string>(skipLinks);
  const ranked = posts
    .map((post) => ({ post, score: scoreTitle(media, post.title) }))
    .filter(
      (entry) =>
        entry.score >= MIN_SCORE[media.mediaType] && !seen.has(entry.post.link),
    )
    .sort((a, b) => b.score - a.score)
    .filter((entry) => {
      if (seen.has(entry.post.link)) return false;
      seen.add(entry.post.link);
      return true;
    })
    .slice(0, limit);

  const matches: ProviderMatch[] = [];
  await Promise.all(
    ranked.map(async ({ post, score }) => {
      try {
        const meta = await loadMeta(providerId, post.link, signal);
        matches.push({
          providerId,
          post,
          score,
          meta,
          linkList: Array.isArray(meta?.linkList) ? meta.linkList : [],
        });
      } catch {
        // an unreadable post just isn't a candidate
      }
    }),
  );
  return matches.sort((a, b) => b.score - a.score);
}

async function matchProvider(
  providerId: string,
  media: BridgeMedia,
  signal?: AbortSignal,
): Promise<ProviderMatch[]> {
  for (const query of searchQueries(media)) {
    await waitIfPaused(signal);
    if (signal?.aborted) return [];
    const posts = await searchProvider(providerId, query, signal);
    const matches = await buildMatches(
      providerId,
      media,
      posts,
      MAX_MATCHES[media.mediaType],
      new Set(),
      signal,
    );
    if (matches.length > 0) return matches;
  }
  return [];
}

/**
 * Searches every provider (PROVIDER_CONCURRENCY at a time) and calls
 * `onUpdate` as soon as each one finishes, so fast providers show up first.
 */
export async function matchProviders(
  media: BridgeMedia,
  providerIds: string[],
  onUpdate: (state: ProviderState) => void,
  signal?: AbortSignal,
): Promise<void> {
  await runPool(
    providerIds,
    PROVIDER_CONCURRENCY,
    async (providerId) => {
      try {
        const matches = await matchProvider(providerId, media, signal);
        if (signal?.aborted) return;
        onUpdate(
          matches.length > 0
            ? { providerId, status: "done", matches }
            : { providerId, status: "empty" },
        );
      } catch (error: any) {
        if (signal?.aborted) return;
        onUpdate({
          providerId,
          status: "error",
          message: error?.message || "Provider failed",
        });
      }
    },
    signal,
  );
}

// ---- turning provider data into rows --------------------------------------

const qualityHeight = (text: string): number | null => {
  const numeric = /(?:^|[^0-9])(2160|1440|1080|720|576|540|480|360|240)p?(?:[^0-9]|$)/i.exec(
    text,
  );
  if (numeric) return Number(numeric[1]);
  const lower = text.toLowerCase();
  if (/\b4k\b|uhd/.test(lower)) return 2160;
  if (/fhd|full[\s-]*hd/.test(lower)) return 1080;
  if (/\bhd\b/.test(lower)) return 720;
  if (/\bsd\b/.test(lower)) return 480;
  return null;
};

const sizeOf = (text: string): string | undefined => {
  const hit = /(\d+(?:\.\d+)?)\s?(GB|MB)/i.exec(text);
  return hit ? `${hit[1]} ${hit[2].toUpperCase()}` : undefined;
};

const entryLabel = (entry: LinkItem, fallback = "Stream") =>
  (entry.title || entry.quality || "").trim() || fallback;

function languagesFor(entryText: string, postTitle: string) {
  const fromEntry = detectLanguagesFromText(entryText);
  const languages = fromEntry.length > 0 ? fromEntry : detectLanguagesFromText(postTitle);
  return {
    languages,
    multiAudio: hasMultiAudioHint(entryText) || hasMultiAudioHint(postTitle),
  };
}

/** Movie rows: one per playable link of every quality entry. */
export function buildMovieOptions(match: ProviderMatch): SourceOption[] {
  const { providerId, post, linkList, meta } = match;
  const options: SourceOption[] = [];
  const seen = new Set<string>();

  linkList.forEach((entry, linkIndex) => {
    const links: DirectLink[] = (entry.directLinks || []).filter(
      (item) => item && item.link,
    );
    links.forEach((item, itemIndex) => {
      if (seen.has(item.link)) return;
      seen.add(item.link);
      const label = entryLabel(entry, item.title || "Stream");
      const detail =
        links.length > 1 && item.title && item.title !== label
          ? item.title
          : undefined;
      const text = [entry.title, entry.quality, item.title, item.description]
        .filter(Boolean)
        .join(" ");
      const lang = languagesFor(text, post.title);
      options.push({
        id: `${providerId}|${item.link}`,
        providerId,
        matchTitle: post.title,
        label,
        detail,
        height: qualityHeight(text),
        sizeText: sizeOf(text),
        languages: lang.languages,
        multiAudio: lang.multiAudio,
        languageChecked: false,
        link: item.link,
        type: item.type || meta?.type || "movie",
        linkIndex,
        itemIndex,
        items: toPlayerEpisodes(links),
        linkList,
      });
    });
  });

  if (options.length === 0) {
    // The existing detail page falls back to the post link itself.
    const lang = languagesFor(post.title, post.title);
    options.push({
      id: `${providerId}|${post.link}`,
      providerId,
      matchTitle: post.title,
      label: "Default",
      height: qualityHeight(post.title),
      sizeText: sizeOf(post.title),
      languages: lang.languages,
      multiAudio: lang.multiAudio,
      languageChecked: false,
      link: post.link,
      type: meta?.type || "movie",
      linkIndex: 0,
      itemIndex: 0,
      items: [],
      linkList: [],
    });
  }
  return options;
}

/** Season numbers mentioned in a post title: "S02", "Season 1-3", "S01 to S03". */
function seasonsInTitle(title: string): Set<number> {
  const found = new Set<number>();
  const range = /\bseasons?\s*0*(\d{1,2})\s*(?:-|to|&|and)\s*0*(\d{1,2})\b/i.exec(
    title,
  );
  if (range) {
    const from = Number(range[1]);
    const to = Number(range[2]);
    for (let n = Math.min(from, to); n <= Math.max(from, to) && n < 40; n += 1) {
      found.add(n);
    }
  }
  const sRange = /\bs0*(\d{1,2})\s*(?:-|to)\s*s?0*(\d{1,2})\b/i.exec(title);
  if (sRange) {
    const from = Number(sRange[1]);
    const to = Number(sRange[2]);
    for (let n = Math.min(from, to); n <= Math.max(from, to) && n < 40; n += 1) {
      found.add(n);
    }
  }
  const single = parseSeasonNumber(title);
  if (single != null) found.add(single);
  return found;
}

/** Quality entries of one match that belong to `season`. */
function entriesForSeason(
  match: ProviderMatch,
  season: number,
  numberOfSeasons: number,
): { entry: LinkItem; linkIndex: number }[] {
  const postSeasons = seasonsInTitle(match.post.title);
  const result: { entry: LinkItem; linkIndex: number }[] = [];
  match.linkList.forEach((entry, linkIndex) => {
    const entrySeason = parseSeasonNumber(entry.title);
    let include: boolean;
    if (entrySeason != null) include = entrySeason === season;
    else if (postSeasons.size > 0) include = postSeasons.has(season);
    else include = season === 1 || numberOfSeasons <= 1;
    if (include && (entry.episodesLink || (entry.directLinks || []).length > 0)) {
      result.push({ entry, linkIndex });
    }
  });
  return result;
}

async function episodesOf(
  providerId: string,
  entry: LinkItem,
): Promise<PlayerEpisode[]> {
  if (entry.episodesLink) return loadEpisodes(providerId, entry.episodesLink);
  return toPlayerEpisodes(entry.directLinks);
}

async function episodeOptionsForMatch(
  match: ProviderMatch,
  season: number,
  episode: number,
  numberOfSeasons: number,
  onOptions: (options: SourceOption[]) => void,
  signal?: AbortSignal,
): Promise<number> {
  const entries = entriesForSeason(match, season, numberOfSeasons);
  let produced = 0;
  await runPool(
    entries,
    2,
    async ({ entry, linkIndex }) => {
      const items = await episodesOf(match.providerId, entry);
      if (signal?.aborted || items.length === 0) return;
      // A "season pack" with no numbering and fewer rows than the episode we
      // want cannot contain it; do not guess by position in that case.
      const numbered = items.some((item) => item.number != null);
      if (!numbered && items.length < episode) return;
      const target = findSameEpisode(items, episode, episode - 1);
      if (!target) return;
      const itemIndex = items.findIndex((item) => item.link === target.link);
      const label = entryLabel(entry, "Stream");
      const text = `${entry.title || ""} ${target.title || ""}`;
      const lang = languagesFor(text, match.post.title);
      produced += 1;
      onOptions([
        {
          id: `${match.providerId}|${target.link}`,
          providerId: match.providerId,
          matchTitle: match.post.title,
          label,
          height: qualityHeight(text),
          sizeText: sizeOf(text),
          languages: lang.languages,
          multiAudio: lang.multiAudio,
          languageChecked: false,
          link: target.link,
          type: target.type || "series",
          linkIndex,
          itemIndex: Math.max(0, itemIndex),
          items,
          linkList: match.linkList,
        },
      ]);
    },
    signal,
  );
  return produced;
}

/**
 * Qualities for one episode across all matched providers. `onOptions` fires as
 * rows are found. If a provider has no row for the season, one extra targeted
 * search ("<title> season N") is tried before giving up on it.
 */
export async function resolveEpisodeOptions(
  media: BridgeMedia,
  matches: ProviderMatch[],
  season: number,
  episode: number,
  onOptions: (providerId: string, options: SourceOption[]) => void,
  signal?: AbortSignal,
): Promise<void> {
  const byProvider = new Map<string, ProviderMatch[]>();
  matches.forEach((match) => {
    const list = byProvider.get(match.providerId) || [];
    list.push(match);
    byProvider.set(match.providerId, list);
  });
  const numberOfSeasons = media.numberOfSeasons ?? 1;

  await runPool(
    Array.from(byProvider.entries()),
    PROVIDER_CONCURRENCY,
    async ([providerId, providerMatches]) => {
      let produced = 0;
      for (const match of providerMatches) {
        if (signal?.aborted) return;
        produced += await episodeOptionsForMatch(
          match,
          season,
          episode,
          numberOfSeasons,
          (options) => onOptions(providerId, options),
          signal,
        );
      }
      if (produced > 0 || signal?.aborted) return;

      // Fallback: a provider that files each season as its own post.
      try {
        const posts = await searchProvider(
          providerId,
          `${media.title} season ${season}`,
          signal,
        );
        const known = new Set(providerMatches.map((m) => m.post.link));
        const extra = await buildMatches(providerId, media, posts, 2, known, signal);
        for (const match of extra) {
          if (signal?.aborted) return;
          await episodeOptionsForMatch(
            match,
            season,
            episode,
            numberOfSeasons,
            (options) => onOptions(providerId, options),
            signal,
          );
        }
      } catch {
        // nothing more to try for this provider
      }
    },
    signal,
  );
}

// ---- resolved streams (shared) ---------------------------------------------
// A row's getStream result is reused for a few minutes, so the language probe
// and the play button never scrape the same row twice. Concurrent callers
// share one request; it is only aborted when every caller has given up.

const STREAM_TTL_MS = 4 * 60 * 1000;

type StreamEntry = {
  at: number;
  promise: Promise<any[]>;
  controller: AbortController;
  waiters: number;
  settled: boolean;
};

const streamCache = new Map<string, StreamEntry>();
const streamKey = (providerId: string, link: string) => `${providerId}|${link}`;

/** Raw provider streams for a row (array, possibly empty). */
export function resolveStreams(
  providerId: string,
  link: string,
  type: string,
  signal?: AbortSignal,
): Promise<any[]> {
  if (signal?.aborted) return Promise.reject(new Error("canceled"));
  const key = streamKey(providerId, link);
  let entry = streamCache.get(key);
  if (!entry || Date.now() - entry.at > STREAM_TTL_MS) {
    const controller = new AbortController();
    const created: StreamEntry = {
      at: Date.now(),
      controller,
      waiters: 0,
      settled: false,
      promise: providerApi
        .getStream(providerId, link, type, controller.signal)
        .then((raw: any) => (Array.isArray(raw) ? raw : raw ? [raw] : [])),
    };
    created.promise.then(
      (list) => {
        created.settled = true;
        // Nothing playable is not worth remembering.
        if (list.length === 0 && streamCache.get(key) === created) {
          streamCache.delete(key);
        }
      },
      () => {
        created.settled = true;
        if (streamCache.get(key) === created) streamCache.delete(key);
      },
    );
    streamCache.set(key, created);
    entry = created;
  }

  const shared = entry;
  shared.waiters += 1;
  return new Promise<any[]>((resolve, reject) => {
    let done = false;
    const leave = () => {
      if (done) return false;
      done = true;
      shared.waiters -= 1;
      signal?.removeEventListener("abort", onAbort);
      return true;
    };
    function onAbort() {
      if (!leave()) return;
      if (shared.waiters <= 0 && !shared.settled) {
        shared.controller.abort();
        if (streamCache.get(key) === shared) streamCache.delete(key);
      }
      reject(new Error("canceled"));
    }
    signal?.addEventListener("abort", onAbort, { once: true });
    shared.promise.then(
      (list) => {
        if (leave()) resolve(list);
      },
      (error) => {
        if (leave()) reject(error);
      },
    );
  });
}

/** Drops a row's cached streams (e.g. they turned out to be dead). */
export function forgetStreams(providerId: string, link: string) {
  streamCache.delete(streamKey(providerId, link));
}

// ---- language enrichment ---------------------------------------------------

const probeCache = new Map<string, string[]>();

/**
 * Looks inside rows whose language is unknown (or "multi audio") by resolving
 * their streams and reading provider metadata / HLS audio groups. Bounded to
 * MAX_LANGUAGE_PROBES rows and two at a time. A probe cut short because
 * playback started is reported through `onInterrupted` so it can be retried.
 */
export async function enrichLanguages(
  options: SourceOption[],
  onResolved: (id: string, languages: string[]) => void,
  signal?: AbortSignal,
  onInterrupted?: (id: string) => void,
): Promise<void> {
  const targets = options
    .filter(
      (option) =>
        !option.languageChecked &&
        (option.languages.length === 0 || option.multiAudio),
    )
    .slice(0, MAX_LANGUAGE_PROBES);

  await runPool(
    targets,
    2,
    async (option) => {
      const cached = probeCache.get(option.link);
      if (cached) {
        onResolved(option.id, cached);
        return;
      }
      const item = new AbortController();
      const onAbort = () => item.abort();
      if (signal?.aborted) return;
      signal?.addEventListener("abort", onAbort, { once: true });
      backgroundProbes.add(item);
      try {
        const raw = await resolveStreams(
          option.providerId,
          option.link,
          option.type,
          item.signal,
        );
        const streams = normalizeStreams(raw);
        const codes = await detectLanguagesFromStreams(streams, {
          signal: item.signal,
        });
        if (item.signal.aborted) throw new Error("canceled");
        probeCache.set(option.link, codes);
        if (!signal?.aborted) onResolved(option.id, codes);
      } catch (error) {
        if (item.signal.aborted && !signal?.aborted) {
          onInterrupted?.(option.id);
          return;
        }
        throw error;
      } finally {
        backgroundProbes.delete(item);
        signal?.removeEventListener("abort", onAbort);
      }
    },
    signal,
  );
}
