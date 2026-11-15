import type { StreamFormat, StreamProbe } from "./catalog-types";
import { streamFormat } from "./streams";

type ProbeRequest = (method: "HEAD" | "GET", signal: AbortSignal) => Promise<Response>;

function mediaInfo(bytes: Uint8Array, type: string, hint: StreamFormat) {
  const text = new TextDecoder().decode(bytes);
  const format = text.startsWith("#EXTM3U") ? "hls" :
    /^\s*(?:<\?xml[^>]*>\s*)?<MPD[\s>]/i.test(text) ? "dash" :
    text.slice(4, 8) === "ftyp" ? "mp4" :
    bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3
      ? text.includes("webm") ? "webm" : "mkv" : streamFormat(type);
  const hls = format === "hls" ? text.match(/CODECS="([^"]+)"/)?.[1].split(",").map((codec) => codec.trim()) : undefined;
  const videoCodec: StreamProbe["videoCodec"] = /V_MPEGH\/ISO\/HEVC|hvc1|hev1/.test(text) ? "hevc" :
    /V_MPEG4\/ISO\/AVC|avc1/.test(text) ? "h264" : undefined;
  const audioCodec: StreamProbe["audioCodec"] = /A_EAC3|ec-3/.test(text) ? "eac3" : /A_AC3|ac-3/.test(text) ? "ac3" : undefined;
  return { text, format: format === "other" ? hint : format, measuredFormat: format, hls, videoCodec, audioCodec };
}

async function prefix(response: Response) {
  const reader = response.body?.getReader();
  const bytes = new Uint8Array(8192);
  if (!reader) return bytes.subarray(0, 0);
  let length = 0;
  try {
    while (length < bytes.length) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value.subarray(0, bytes.length - length);
      bytes.set(chunk, length);
      length += chunk.length;
    }
    return bytes.subarray(0, length);
  } finally {
    void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

const nonMedia = /^(?:text\/html|application\/(?:json|xml))/i;
const adaptive = (format: StreamFormat) => format === "hls" || format === "dash";

export async function probePlayback(request: ProbeRequest, hint: StreamFormat, signal: AbortSignal): Promise<StreamProbe> {
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(4500)]);
  try {
    if (!adaptive(hint)) {
      const head = await request("HEAD", deadline);
      const type = head.headers.get("content-type") ?? "";
      if (nonMedia.test(type) && head.ok) return { status: "failed", httpStatus: head.status, reason: "Server returned a web page or API response." };
      if ([401, 404, 410].includes(head.status)) return { status: "failed", httpStatus: head.status, reason: "HTTP " + head.status };
    }
    const response = await request("GET", deadline);
    const type = response.headers.get("content-type") ?? "";
    if (!response.ok) {
      void response.body?.cancel().catch(() => undefined);
      return { status: "failed", httpStatus: response.status, reason: "HTTP " + response.status };
    }
    const bytes = await prefix(response);
    const info = mediaInfo(bytes, type, hint);
    if (adaptive(info.format) || adaptive(hint)) {
      const manifest = info.format === "hls"
        ? /^\uFEFF?#EXTM3U(?:\r?\n|$)/.test(info.text) && /#EXT(?:INF:|-X-(?:STREAM-INF|TARGETDURATION|MEDIA:))/.test(info.text)
        : /^\s*(?:<\?xml[^>]*>\s*)?<MPD[\s>]/i.test(info.text);
      if (!manifest) return { status: "failed", httpStatus: response.status, reason: "Invalid streaming manifest." };
    } else if (!bytes.length || nonMedia.test(type) || /^\s*(?:<!doctype|<html|<head|<body|[\[{])/i.test(info.text) ||
        (!/^video\//i.test(type) && info.measuredFormat === "other")) {
      return { status: "failed", httpStatus: response.status, reason: "The response did not contain recognized video." };
    }
    return { status: "ok", httpStatus: response.status, contentType: type, format: info.format,
      codecs: info.hls, videoCodec: info.videoCodec, audioCodec: info.audioCodec };
  } catch {
    return { status: "unknown", reason: deadline.aborted ? "Stream probe timed out." : "Stream connection failed." };
  }
}

export async function probeCandidates<T, U>(items: T[], probe: (item: T, signal: AbortSignal) => Promise<U | undefined>, signal: AbortSignal) {
  const candidates = items.slice(0, 12);
  const checked: (U | undefined)[] = [];
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(6500)]);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(4, candidates.length) }, async () => {
    while (cursor < candidates.length && !deadline.aborted) {
      const index = cursor++;
      checked[index] = await probe(candidates[index], deadline);
    }
  }));
  signal.throwIfAborted();
  return checked.filter((value): value is U => value !== undefined);
}
