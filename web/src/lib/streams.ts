import type { QualityPreference, StreamFormat } from "./catalog-types";

export function ensureHttpUrl(input: string) {
  const value = input.trim();
  if (value.startsWith("//")) return "https:" + value;
  if (!value || value.startsWith("/") || /^[a-z][a-z\d+.-]*:\/\//i.test(value) || /^(?:data|blob|magnet):/i.test(value)) return value;
  return "https://" + value;
}

export function parseQuality(value: unknown) {
  const text = typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
  const height = Number(text.match(/\d{3,4}/)?.[0]);
  if (height >= 144 && height <= 4320) return height;
  if (/4k|uhd/i.test(text)) return 2160;
  if (/2k|qhd/i.test(text)) return 1440;
  if (/fhd|full[\s-]*hd/i.test(text)) return 1080;
  if (/\bhd\b/i.test(text)) return 720;
  if (/\bsd\b/i.test(text)) return 480;
  return undefined;
}

export function inferQualityFromUrl(url: string) {
  let path = url;
  try { path = decodeURIComponent(url); } catch { /* Preserve malformed escape sequences. */ }
  const height = path.match(/(?:^|[^\d])(2160|1440|1080|720|576|540|480|360|240)p?(?:[^\d]|$)/i)?.[1];
  return height ? Number(height) : undefined;
}

export function streamFormat(type: string, url = ""): StreamFormat {
  if (/mpegurl|m3u8|\bhls\b/i.test(type) || /\.m3u8(?:[?#]|$)/i.test(url)) return "hls";
  if (/dash|\bmpd\b/i.test(type) || /\.mpd(?:[?#]|$)/i.test(url)) return "dash";
  if (/matroska|\bmkv\b/i.test(type) || /\.mkv(?:[?#]|$)/i.test(url)) return "mkv";
  if (/webm/i.test(type) || /\.webm(?:[?#]|$)/i.test(url)) return "webm";
  if (/mp4|m4v|quicktime/i.test(type) || /\.(mp4|m4v)(?:[?#]|$)/i.test(url)) return "mp4";
  if (/\bavi\b/i.test(type) || /\.avi(?:[?#]|$)/i.test(url)) return "avi";
  return "other";
}

const record = (value: unknown) => value && typeof value === "object" ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";

export function normalizeStreams(value: unknown) {
  const seen = new Set<string>();
  return (Array.isArray(value) ? value : [value]).flatMap((entry) => {
    const raw = record(entry);
    const url = URL.parse(ensureHttpUrl(text(raw.link)));
    const type = text(raw.type);
    const server = text(raw.server) || text(raw.name) || text(raw.label) || "Stream";
    const legacyEmbedDownload = type === "embed" && /^hdmovies(?:life)?\b/i.test(server) &&
      /(?:^|\.)(?:hdlinks\.online|fxshare\.org|fxdl\.site|fxcloud-as\.site|gdfiles-xyz\.workers\.dev)$/i.test(url?.hostname ?? "");
    if (!url || !["https:", "http:"].includes(url.protocol) || url.username || url.password ||
        raw.downloadOnly === true || /\bdownload[\s-]*only\b/i.test(server) || legacyEmbedDownload ||
        raw.kind === "audio" || raw.kind === "video" || seen.has(url.href)) return [];
    seen.add(url.href);
    const height = parseQuality(raw.quality) ?? inferQualityFromUrl(url.href);
    return [{
      raw, url: url.href, type, server, serverKey: server.toLowerCase(), height,
      quality: height ? height + "p" : text(raw.quality) || undefined,
      format: streamFormat(type, url.href),
    }];
  });
}

export function preferredStreams<T extends { serverKey: string; height?: number }>(streams: T[], preference: QualityPreference) {
  const groups = new Map<string, T[]>();
  for (const stream of streams) {
    const group = groups.get(stream.serverKey);
    if (group) group.push(stream);
    else groups.set(stream.serverKey, [stream]);
  }
  const sorted = [...groups.values()];
  if (preference !== "auto") {
    for (const group of sorted) group.sort((a, b) => {
      if (a.height === undefined || b.height === undefined) return Number(a.height === undefined) - Number(b.height === undefined);
      return preference === "highest" ? b.height - a.height : a.height - b.height;
    });
  }
  return [...sorted.map((group) => group[0]), ...sorted.flatMap((group) => group.slice(1))];
}
