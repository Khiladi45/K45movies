// Audio-language detection and sorting for the Movie Based layout.
//
// Languages are collected from three places, cheapest first:
//   1. free text — release/quality titles such as "Hindi + Tamil 1080p"
//   2. provider stream metadata — fields like `language`, `audio`, `audioTracks`
//   3. HLS master playlists — `#EXT-X-MEDIA:TYPE=AUDIO,LANGUAGE="ta"` entries
// Everything is normalised to ISO 639-1 codes ("ta", "hi", "en", ...).

import {
  TEXT_LANGUAGE_ABBREVIATIONS,
  TEXT_LANGUAGE_NAMES,
  normalizeLangCode,
} from "./languages";
import type { PlayableStream } from "./streams";
import { pickPreferredIndex } from "./streamRanking";

const NAME_RE = new RegExp(
  `\\b(${Object.keys(TEXT_LANGUAGE_NAMES).join("|")})\\b`,
  "gi",
);
const GROUP_RE = /[\[(]([^\[\]()]{2,40})[\])]/g;
const FILLER = new Set(["dual", "audio", "multi", "dubbed", "dub", "org", "line"]);
// "English Subs", "Multi Subtitles", "ESub" describe subtitles, not audio.
const SUBTITLE_RE =
  /\b(?:[a-z]+\s+)?(?:subs?|subtitles?|esubs?|msubs?|hardsub|softsub)\b/gi;

export const hasMultiAudioHint = (text?: string | null): boolean =>
  !!text && /\b(?:multi|dual|tri|triple)[\s-]*audio\b/i.test(text);

const unique = (codes: string[]): string[] => Array.from(new Set(codes));

/** Languages mentioned in a title / label, as ISO 639-1 codes. */
export function detectLanguagesFromText(text?: string | null): string[] {
  if (!text) return [];
  const clean = String(text).replace(SUBTITLE_RE, " ");
  const found: string[] = [];

  clean.replace(NAME_RE, (match) => {
    const code = TEXT_LANGUAGE_NAMES[match.toLowerCase()];
    if (code) found.push(code);
    return match;
  });

  // Abbreviations ("Hin", "Tam") are only trusted inside a [..] / (..) group
  // where every token looks like a language, e.g. "[Hin-Tam-Eng]".
  let group: RegExpExecArray | null;
  GROUP_RE.lastIndex = 0;
  while ((group = GROUP_RE.exec(clean))) {
    const tokens = group[1]
      .split(/[\s+&,/|\-]+/)
      .map((token) => token.toLowerCase())
      .filter(Boolean);
    if (tokens.length === 0) continue;
    const allLanguageLike = tokens.every(
      (token) =>
        TEXT_LANGUAGE_ABBREVIATIONS[token] ||
        TEXT_LANGUAGE_NAMES[token] ||
        FILLER.has(token),
    );
    if (!allLanguageLike) continue;
    tokens.forEach((token) => {
      const code = TEXT_LANGUAGE_ABBREVIATIONS[token];
      if (code) found.push(code);
    });
  }

  return unique(found);
}

const valueToCodes = (value: any): string[] => {
  if (value == null) return [];
  if (Array.isArray(value)) return value.flatMap(valueToCodes);
  if (typeof value === "object") {
    return [value.language, value.lang, value.name, value.label, value.title]
      .flatMap(valueToCodes)
      .slice(0, 3);
  }
  const text = String(value).trim();
  if (!text) return [];
  const direct = normalizeLangCode(text);
  if (direct) return [direct];
  return detectLanguagesFromText(text);
};

const RAW_LANGUAGE_FIELDS = [
  "language",
  "languages",
  "lang",
  "audio",
  "audioLanguage",
  "audioLanguages",
  "audioLang",
  "audio_language",
  "audioTracks",
  "audio_tracks",
  "audios",
  "dub",
];
const RAW_TEXT_FIELDS = ["server", "name", "label", "title", "quality"];

/** Languages a provider declares (or hints at) on a raw stream object. */
export function detectLanguagesFromRawStream(raw: any): string[] {
  if (!raw || typeof raw !== "object") return [];
  const found: string[] = [];
  RAW_LANGUAGE_FIELDS.forEach((field) => found.push(...valueToCodes(raw[field])));
  RAW_TEXT_FIELDS.forEach((field) => {
    if (typeof raw[field] === "string") {
      found.push(...detectLanguagesFromText(raw[field]));
    }
  });
  return unique(found);
}

/** Audio groups declared in an HLS master playlist. */
export function parseHlsAudioLanguages(manifest: string): string[] {
  const found: string[] = [];
  manifest.split(/\r?\n/).forEach((line) => {
    if (!line.startsWith("#EXT-X-MEDIA:") || !/TYPE=AUDIO/i.test(line)) return;
    const lang = /LANGUAGE="([^"]+)"/i.exec(line)?.[1];
    const name = /NAME="([^"]+)"/i.exec(line)?.[1];
    const code =
      normalizeLangCode(lang) ||
      normalizeLangCode(name) ||
      detectLanguagesFromText(name)[0];
    if (code) found.push(code);
  });
  return unique(found);
}

const hlsCache = new Map<string, string[]>();

async function fetchHlsAudioLanguages(
  stream: PlayableStream,
  signal?: AbortSignal,
  timeoutMs = 4000,
): Promise<string[]> {
  const cached = hlsCache.get(stream.link);
  if (cached) return cached;

  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", onAbort, { once: true });
  }
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(stream.link, {
      headers: stream.headers,
      signal: controller.signal,
    });
    if (!response.ok) return [];
    const body = (await response.text()).slice(0, 262144);
    const codes = /#EXTM3U/i.test(body) ? parseHlsAudioLanguages(body) : [];
    hlsCache.set(stream.link, codes);
    return codes;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

/**
 * Audio languages of one resolved stream: provider metadata first, then — for
 * HLS — the master playlist's audio groups.
 */
export async function detectStreamLanguages(
  stream: PlayableStream,
  options?: { signal?: AbortSignal; skipManifest?: boolean },
): Promise<string[]> {
  const fromMeta = detectLanguagesFromRawStream(stream.raw);
  if (options?.skipManifest || stream.format !== "hls") return fromMeta;
  const fromManifest = await fetchHlsAudioLanguages(stream, options?.signal);
  return unique([...fromMeta, ...fromManifest]);
}

/** Union of the languages across a set of streams (a row can offer several). */
export async function detectLanguagesFromStreams(
  streams: PlayableStream[],
  options?: { signal?: AbortSignal; maxManifests?: number },
): Promise<string[]> {
  const limit = options?.maxManifests ?? 3;
  let manifests = 0;
  const lists = await Promise.all(
    streams.map((stream) => {
      const allowManifest = stream.format === "hls" && manifests < limit;
      if (allowManifest) manifests += 1;
      return detectStreamLanguages(stream, {
        signal: options?.signal,
        skipManifest: !allowManifest,
      });
    }),
  );
  return unique(lists.flat());
}

/**
 * Index of the stream to start on for the preferred audio language, or -1.
 *
 * Uses what is already known first — provider metadata and the audio groups
 * the server check read from each HLS master (`probe.audioLanguages`) — so the
 * usual case needs no extra request. Only HLS streams that were not probed get
 * their manifest fetched, under one shared `budgetMs`. Among matches, the one
 * closest to 1080p wins; streams the probe found dead are skipped.
 */
export async function findPreferredStreamIndex(
  streams: PlayableStream[],
  preferred: string,
  signal?: AbortSignal,
  budgetMs = 1500,
): Promise<number> {
  const capped = streams.slice(0, 6);
  const known = capped.map((stream) =>
    unique([
      ...detectLanguagesFromRawStream(stream.raw),
      ...(stream.probe?.audioLanguages || []),
    ]),
  );

  const unprobed = capped
    .map((stream, i) => ({ stream, i }))
    .filter(
      ({ stream, i }) =>
        stream.format === "hls" &&
        !stream.probe?.audioLanguages &&
        stream.probe?.status !== "failed" &&
        !known[i].includes(preferred),
    )
    .slice(0, 3);

  if (unprobed.length > 0) {
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    if (signal) {
      if (signal.aborted) controller.abort();
      else signal.addEventListener("abort", onAbort, { once: true });
    }
    const timer = setTimeout(() => controller.abort(), budgetMs);
    try {
      const fetched = await Promise.all(
        unprobed.map(({ stream }) =>
          fetchHlsAudioLanguages(stream, controller.signal, budgetMs),
        ),
      );
      fetched.forEach((codes, n) => {
        const i = unprobed[n].i;
        known[i] = unique([...known[i], ...codes]);
      });
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  }

  return pickPreferredIndex(
    capped.map((stream, i) => ({
      languages: known[i],
      // An adaptive master with no fixed height plays at the best rendition
      // the connection allows, so it ranks like a 1080p file.
      height: stream.height ?? (stream.adaptive ? 1080 : null),
      failed: stream.probe?.status === "failed",
    })),
    preferred,
  );
}

/**
 * Stable sort that puts items matching `preferred` first. Everything else
 * keeps its original relative order.
 */
export function sortByPreferredLanguage<T>(
  items: T[],
  preferred: string | null,
  getLanguages: (item: T) => string[],
): T[] {
  if (!preferred) return items;
  const hits: T[] = [];
  const rest: T[] = [];
  items.forEach((item) => {
    (getLanguages(item).includes(preferred) ? hits : rest).push(item);
  });
  return hits.length === 0 ? items : [...hits, ...rest];
}

/**
 * Strict quality order: (1) rows whose audio matches the preferred language,
 * (2) multi-audio rows, (3) the rest. Stable inside each group.
 */
export function sortQualitiesStrict<
  T extends { languages: string[]; multiAudio: boolean },
>(items: T[], preferred: string | null): T[] {
  const rank = (item: T) =>
    preferred && item.languages.includes(preferred)
      ? 0
      : item.multiAudio || item.languages.length > 1
        ? 1
        : 2;
  return items
    .map((item, index) => ({ item, index, rank: rank(item) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.item);
}
