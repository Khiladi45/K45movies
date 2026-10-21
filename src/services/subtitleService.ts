import { Directory, File, Paths } from "expo-file-system";
import { DEFAULT_UA } from "@/services/SandboxManager";
import { parseVttCues, SubtitleCue } from "@/lib/subtitles";

export type PreparedSubtitle = {
  id: string;
  /** Unique title handed to react-native-video; also used for selection. */
  title: string;
  /** Human readable label for the player's subtitle menu. */
  label: string;
  language?: string;
  languageCode: string;
  uri: string;
  /** Parsed cues power the fully styled external subtitle overlay. */
  cues: SubtitleCue[];
};

export type PrepareSubtitlesResult = {
  tracks: PreparedSubtitle[];
  failed: number;
};

type RawSubtitle = {
  uri: string;
  title?: string;
  language?: string;
  type?: string;
};

const LANGUAGE_CODES: Record<string, string> = {
  english: "en",
  tamil: "ta",
  telugu: "te",
  hindi: "hi",
  malayalam: "ml",
  kannada: "kn",
  bengali: "bn",
  marathi: "mr",
  gujarati: "gu",
  punjabi: "pa",
  urdu: "ur",
  spanish: "es",
  french: "fr",
  german: "de",
  italian: "it",
  portuguese: "pt",
  russian: "ru",
  japanese: "ja",
  korean: "ko",
  chinese: "zh",
  arabic: "ar",
  turkish: "tr",
  dutch: "nl",
  polish: "pl",
  thai: "th",
  indonesian: "id",
  vietnamese: "vi",
  ukrainian: "uk",
  greek: "el",
  hebrew: "he",
  romanian: "ro",
  czech: "cs",
  swedish: "sv",
  danish: "da",
  norwegian: "no",
  finnish: "fi",
  hungarian: "hu",
  filipino: "fil",
  malay: "ms",
};

export const languageCodeFor = (value?: string): string => {
  if (!value) return "und";
  const raw = value.trim().toLowerCase();
  if (!raw) return "und";
  if (/^[a-z]{2,3}$/.test(raw)) return raw;
  const word = raw.split(/[^a-z]+/).find((part) => LANGUAGE_CODES[part]);
  return (word && LANGUAGE_CODES[word]) || "und";
};

const hash = (value: string): string => {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${h.toString(16)}${value.length.toString(16)}`;
};

const withUa = (headers?: Record<string, string>): Record<string, string> => {
  const copy: Record<string, string> = {};
  if (headers) {
    for (const [key, value] of Object.entries(headers)) {
      if (value == null) continue;
      const lower = key.toLowerCase();
      if (lower === "host" || lower === "content-length") continue;
      copy[key] = String(value);
    }
  }
  if (!Object.keys(copy).some((key) => key.toLowerCase() === "user-agent")) {
    copy["User-Agent"] = DEFAULT_UA;
  }
  return copy;
};

export const resolveSubtitleUrl = (base: string, relative: string): string => {
  if (/^(https?:|data:)/i.test(relative)) return relative;
  try {
    return new URL(relative, base).toString();
  } catch {
    const origin = base.match(/^(https?:\/\/[^/]+)/i)?.[1];
    if (origin && relative.startsWith("/")) return origin + relative;
    const dir = base.slice(0, base.lastIndexOf("/") + 1);
    return dir + relative;
  }
};

const subtitleEntries = (raw: any): RawSubtitle[] => {
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const out: RawSubtitle[] = [];
  for (const item of list) {
    if (!item) continue;
    if (typeof item === "string") {
      out.push({ uri: item });
      continue;
    }
    const uri = item.uri || item.url || item.file || item.link || item.src;
    if (typeof uri !== "string" || !uri) continue;
    out.push({
      uri,
      title: item.title || item.label || item.name,
      language: item.language || item.lang || item.languageCode || item.srclang,
      type: item.type || item.mimeType || item.format,
    });
  }
  return out;
};

const decodeDataUri = (uri: string): string | null => {
  const match = uri.match(/^data:([^;,]*)(;base64)?,([\s\S]*)$/i);
  if (!match) return null;
  try {
    if (match[2]) {
      const atobFn = (
        globalThis as unknown as { atob?: (value: string) => string }
      ).atob;
      if (!atobFn) return null;
      const binary = atobFn(match[3]);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      let encoded = "";
      for (let i = 0; i < bytes.length; i++) {
        encoded += `%${bytes[i].toString(16).padStart(2, "0")}`;
      }
      return decodeURIComponent(encoded);
    }
    return decodeURIComponent(match[3]);
  } catch {
    return null;
  }
};

const fetchText = async (
  url: string,
  headers: Record<string, string>,
): Promise<string> => {
  const data = decodeDataUri(url);
  if (data != null) return data;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, {
      headers,
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Subtitle request failed (${response.status})`);
    }
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
};

const srtToVtt = (source: string): string => {
  const body = source
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2")
    .replace(/^\s*WEBVTT[^\n]*\n+/i, "");
  return `WEBVTT\n\n${body}`.trimEnd() + "\n";
};

const normalizeVtt = (text: string): string | null => {
  const clean = text.replace(/^\uFEFF/, "").trimStart();
  if (/^WEBVTT/i.test(clean)) return clean;
  if (/\d{2}:\d{2}:\d{2},\d{3}\s*-->/.test(clean) || /^\s*\d+\s*\n\d{2}:\d{2}:\d{2}/.test(clean)) {
    return srtToVtt(clean);
  }
  return null;
};

const cacheDirectory = (): Directory => {
  const dir = new Directory(Paths.cache, "k45-subtitles");
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
};

const prepareOne = async (
  raw: RawSubtitle,
  baseUrl: string,
  headers: Record<string, string>,
): Promise<PreparedSubtitle | null> => {
  const url = resolveSubtitleUrl(baseUrl, raw.uri);
  const hinted = (raw.type || "").toLowerCase();
  if (/ttml|ass|ssa|vtt|subrip|srt|text\//.test(hinted)) {
    if (/ttml|ass|ssa/.test(hinted)) return null;
  }
  if (/\.(ttml|ass|ssa)($|\?)/i.test(url) || url.startsWith("data:application/ttml")) {
    return null;
  }

  const cacheKey = hash(url);
  const cached = new File(cacheDirectory(), `${cacheKey}.vtt`);
  let body: string;
  if (cached.exists && cached.size > 1) {
    body = await cached.text();
  } else {
    const remote = await fetchText(url, headers);
    const normalized = normalizeVtt(remote);
    if (!normalized) return null;
    cached.write(normalized);
    body = normalized;
  }
  if (!body.trim()) return null;

  const cues = parseVttCues(body);
  if (cues.length === 0) return null;

  const language = raw.language || raw.title;
  return {
    id: `external:${cacheKey}`,
    title: "",
    label: "",
    language,
    languageCode: languageCodeFor(language),
    uri: cached.uri,
    cues,
  };
};

/**
 * Downloads external subtitle files, converts SRT to VTT, caches the result,
 * and returns tracks that can be passed to react-native-video. Failures are
 * reported as a count so the player can surface an honest warning instead of
 * pretending the subtitles were loaded.
 */
export async function prepareSubtitles(
  raw: any,
  baseUrl: string,
  headers?: Record<string, string>,
): Promise<PrepareSubtitlesResult> {
  const entries = subtitleEntries(raw);
  if (entries.length === 0) return { tracks: [], failed: 0 };

  const seen = new Set<string>();
  const unique = entries.filter((entry) => {
    if (seen.has(entry.uri)) return false;
    seen.add(entry.uri);
    return true;
  });

  const settled = await Promise.allSettled(
    unique.map((entry) => prepareOne(entry, baseUrl, withUa(headers))),
  );

  const tracks: PreparedSubtitle[] = [];
  const usedTitles = new Set<string>();
  let failed = 0;

  settled.forEach((result, index) => {
    if (result.status !== "fulfilled" || !result.value) {
      failed += 1;
      return;
    }
    const rawEntry = unique[index];
    const label =
      rawEntry.title || rawEntry.language || `Subtitle ${tracks.length + 1}`;
    let title = `External · ${label}`;
    let suffix = 2;
    while (usedTitles.has(title)) {
      title = `External · ${label} (${suffix++})`;
    }
    usedTitles.add(title);
    tracks.push({ ...result.value, title, label });
  });

  return { tracks, failed: Math.max(0, failed) };
}
