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

export function mediaHeaders(rawHeaders: unknown) {
  const headers: Record<string, string> = {};
  if (rawHeaders && typeof rawHeaders === "object") {
    for (const [key, value] of Object.entries(rawHeaders)) {
      const name = key.toLowerCase();
      if (["user-agent", "referer", "origin", "cookie", "authorization", "accept", "accept-language"].includes(name) &&
          typeof value === "string" && value.length < 3000 && !/[\r\n]/.test(value)) headers[name] = value;
    }
  }
  return headers;
}

export function createMediaLink(value: string, rawHeaders: unknown, kind: MediaTarget["kind"] = "media", base?: string, format?: MediaTarget["format"]) {
  const url = publicMediaUrl(value, base);
  if (!url) return undefined;
  const headers = mediaHeaders(rawHeaders);
  if (base && publicMediaUrl(base)?.origin !== url.origin) {
    delete headers.cookie;
    delete headers.authorization;
  }
  return mediaUrl({ url: url.href, kind, origin: url.origin, headers, format, expires: Date.now() + 6 * 60 * 60_000 });
}

export function rewritePlaylist(body: string, finalUrl: string, target: MediaTarget) {
  const replacement = (value: string, kind: MediaTarget["kind"], format?: MediaTarget["format"]) => {
    const url = publicMediaUrl(value, finalUrl);
    if (!url) throw new HttpError(502, "The stream contains an unsupported playlist reference.");
    const headers = url.origin === target.origin ? target.headers : Object.fromEntries(
      Object.entries(target.headers ?? {}).filter(([name]) => name !== "cookie" && name !== "authorization"),
    );
    return mediaUrl({ ...target, url: url.href, kind, headers, format });
  };
  let variant = false;
  return body.split(/\r?\n/).map((line) => {
    const value = line.trim();
    if (!value) return line;
    if (!value.startsWith("#")) {
      const playlist = variant;
      variant = false;
      return replacement(value, playlist ? "media" : "segment", playlist ? "hls" : undefined);
    }
    if (value.startsWith("#EXT-X-STREAM-INF:")) variant = true;
    if (!value.startsWith("#EXT-X-")) return line;
    const key = /^#EXT-X-(?:SESSION-)?KEY:/.test(value);
    const playlist = /^#EXT-X-(?:MEDIA|I-FRAME-STREAM-INF|RENDITION-REPORT):/.test(value);
    const segment = /^#EXT-X-(?:MAP|PART|PRELOAD-HINT):/.test(value);
    return line.replace(/\b(URI|SERVER-URI)="([^"]+)"/g, (_, name: string, uri: string) =>
      name + '="' + replacement(uri, key ? "key" : segment ? "segment" : "media", playlist ? "hls" : undefined) + '"');
  }).join("\n");
}

export async function sniffHlsSegment(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const head = new Uint8Array(564);
  const buffered: Uint8Array[] = [];
  let length = 0;
  let complete = false;
  try {
    while (length < head.length) {
      const { done, value } = await reader.read();
      if (done) { complete = true; break; }
      buffered.push(value);
      const piece = value.subarray(0, head.length - length);
      head.set(piece, length);
      length += piece.length;
    }
    const box = new TextDecoder().decode(head.subarray(4, 8));
    const type = length >= 377 && head[0] === 0x47 && head[188] === 0x47 && head[376] === 0x47 ? "video/mp2t" :
      length >= 8 && /^(?:ftyp|styp|moof|moov)$/.test(box) ? "video/mp4" : undefined;
    if (!type) {
      await reader.cancel().catch(() => undefined);
      reader.releaseLock();
      return;
    }
    return { type, body: new ReadableStream<Uint8Array>({
      async pull(controller) {
        const chunk = buffered.shift();
        if (chunk) { controller.enqueue(chunk); return; }
        try {
          const next = complete ? { done: true as const } : await reader.read();
          if (next.done) { controller.close(); reader.releaseLock(); }
          else controller.enqueue(next.value);
        } catch (error) { controller.error(error); reader.releaseLock(); }
      },
      async cancel(reason) {
        try { await reader.cancel(reason); }
        finally { reader.releaseLock(); }
      },
    }) };
  } catch (error) {
    reader.releaseLock();
    throw error;
  }
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
