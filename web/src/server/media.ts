import "server-only";
import { HttpError } from "./http";
import { mediaUrl, type MediaTarget } from "./media-token";

function publicMediaUrl(value: string, base?: string) {
  try {
    const url = new URL(value, base);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.href.length > 5500) return;
    return url;
  } catch { return undefined; }
}

export function createMediaLink(value: string, rawHeaders: unknown, kind: MediaTarget["kind"] = "media", base?: string) {
  const url = publicMediaUrl(value, base);
  if (!url) return undefined;
  const headers: Record<string, string> = {};
  if (rawHeaders && typeof rawHeaders === "object") {
    for (const [key, value] of Object.entries(rawHeaders)) {
      const name = key.toLowerCase();
      if (["user-agent", "referer", "origin", "cookie", "authorization", "accept", "accept-language"].includes(name) &&
          typeof value === "string" && value.length < 3000 && !/[\r\n]/.test(value)) headers[name] = value;
    }
  }
  if (base && publicMediaUrl(base)?.origin !== url.origin) {
    delete headers.cookie;
    delete headers.authorization;
  }
  return mediaUrl({ url: url.href, kind, origin: url.origin, headers, expires: Date.now() + 6 * 60 * 60_000 });
}

export function rewritePlaylist(body: string, finalUrl: string, target: MediaTarget) {
  const replacement = (value: string, kind: MediaTarget["kind"]) => {
    const url = publicMediaUrl(value, finalUrl);
    if (!url) throw new HttpError(502, "The stream contains an unsupported playlist reference.");
    const headers = url.origin === target.origin ? target.headers : Object.fromEntries(
      Object.entries(target.headers ?? {}).filter(([name]) => name !== "cookie" && name !== "authorization"),
    );
    return mediaUrl({ ...target, url: url.href, kind, headers });
  };
  return body.split(/\r?\n/).map((line) => {
    const value = line.trim();
    if (!value) return line;
    if (!value.startsWith("#")) return replacement(value, "media");
    const kind = /^#EXT-X-(?:SESSION-)?KEY:/.test(value) ? "key" : "media";
    if (!value.startsWith("#EXT-X-")) return line;
    return line.replace(/\b(URI|SERVER-URI)="([^"]+)"/g, (_, name: string, uri: string) => name + '="' + replacement(uri, kind) + '"');
  }).join("\n");
}

export async function limitedText(response: Response, max = 2 * 1024 * 1024) {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let body = "";
  let bytes = 0;
  if (!reader) return body;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return body + decoder.decode();
      bytes += value.byteLength;
      if (bytes > max) throw new HttpError(502, "Media metadata is too large.");
      body += decoder.decode(value, { stream: true });
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

function clock(milliseconds: string) {
  return milliseconds.replace(",", ".");
}

export function toWebVtt(body: string) {
  const text = body.replace(/^\uFEFF/, "").trimStart();
  if (text.startsWith("WEBVTT")) return text;
  if (text.includes("-->")) return "WEBVTT\n\n" + text.replace(/\d{2}:\d{2}:\d{2},\d{3}/g, clock);
  throw new HttpError(502, "Unsupported subtitle format.");
}
