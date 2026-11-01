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

/** Index of the first stream whose audio matches `preferred`, or -1. */
export async function findPreferredStreamIndex(
  streams: PlayableStream[],
  preferred: string,
  signal?: AbortSignal,
): Promise<number> {
  const capped = streams.slice(0, 6);
  const languages = await Promise.all(
    capped.map((stream, i) =>
      detectStreamLanguages(stream, {
        signal,
        // Only look inside the first few manifests; the rest use metadata.
        skipManifest: i >= 4,
      }),
    ),
  );
  const hit = languages.findIndex((codes) => codes.includes(preferred));
  return hit >= 0 ? hit : -1;
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
