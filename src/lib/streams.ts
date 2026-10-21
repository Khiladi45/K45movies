import { Platform } from "react-native";
import { DEFAULT_UA } from "@/services/SandboxManager";

export type StreamFormat =
  | "hls"
  | "dash"
  | "mp4"
  | "mkv"
  | "webm"
  | "avi"
  | "other";

export type PlayableStream = {
  __k45Stream: true;
  index: number;
  link: string;
  server: string;
  serverKey: string;
  qualityLabel: string;
  height: number | null;
  format: StreamFormat;
  formatLabel: string;
  adaptive: boolean;
  downloadOnly: boolean;
  headers: Record<string, string>;
  subtitles?: any;
  skip?: any;
  probe?: StreamProbe;
  raw: any;
};

export type StreamProbe = {
  status: "ok" | "failed" | "unknown";
  httpStatus?: number;
  contentType?: string;
  reason?: string;
  checkedAt: number;
};

export type StreamGroupEntry = {
  stream: PlayableStream;
  label: string;
};

export type StreamGroup = {
  key: string;
  label: string;
  entries: StreamGroupEntry[];
  adaptive: boolean;
  formats: string[];
};

export type QualityPreference = "auto" | "highest" | "lowest";

const BLOCKED_HEADERS = new Set([
  "host",
  "content-length",
  "connection",
  "transfer-encoding",
  "accept-encoding",
]);

export const sanitizeHeaders = (
  headers?: Record<string, any> | null,
): Record<string, string> => {
  const out: Record<string, string> = {};
  if (!headers || typeof headers !== "object") return out;
  for (const [key, value] of Object.entries(headers)) {
    if (value == null) continue;
    if (BLOCKED_HEADERS.has(key.toLowerCase())) continue;
    out[key] = String(value);
  }
  if (!Object.keys(out).some((key) => key.toLowerCase() === "user-agent")) {
    out["User-Agent"] = DEFAULT_UA;
  }
  return out;
};

const parseQuality = (
  value: any,
): { height: number | null; label: string } => {
  if (value == null) return { height: null, label: "" };
  const text = String(value).trim();
  if (!text) return { height: null, label: "" };

  const numeric = text.match(/(\d{3,4})/);
  if (numeric) {
    const height = Number(numeric[1]);
    if (height >= 144 && height <= 4320) {
      return { height, label: `${height}p` };
    }
  }

  const lower = text.toLowerCase();
  if (/4k|uhd|2160/.test(lower)) return { height: 2160, label: "2160p" };
  if (/2k|qhd|1440/.test(lower)) return { height: 1440, label: "1440p" };
  if (/fhd|full[\s-]*hd|1080/.test(lower)) {
    return { height: 1080, label: "1080p" };
  }
  if (/\bhd\b|720/.test(lower)) return { height: 720, label: "720p" };
  if (/\bsd\b|480/.test(lower)) return { height: 480, label: "480p" };
  if (/360/.test(lower)) return { height: 360, label: "360p" };
  return { height: null, label: text };
};

const inferQualityFromUrl = (link: string): { height: number | null; label: string } => {
  let decoded = link;
  try {
    decoded = decodeURIComponent(link);
  } catch {
    decoded = link;
  }
  const match = decoded.match(
    /(?:^|[^0-9])(2160|1440|1080|720|576|540|480|360|240)p?(?:[^0-9]|$)/i,
  );
  if (!match) return { height: null, label: "" };
  const height = Number(match[1]);
  return { height, label: `${height}p` };
};

const formatFromTypeAndLink = (
  type: any,
  link: string,
): { format: StreamFormat; formatLabel: string } => {
  const hinted = String(type || "").toLowerCase();
  const lower = link.toLowerCase();

  if (/mpegurl|m3u8|\bhls\b/.test(hinted) || /\.m3u8(?:$|[?#])/.test(lower)) {
    return { format: "hls", formatLabel: "HLS" };
  }
  if (/dash|\bmpd\b/.test(hinted) || /\.mpd(?:$|[?#])/.test(lower)) {
    return { format: "dash", formatLabel: "DASH" };
  }
  if (/matroska|\bmkv\b/.test(hinted) || /\.mkv(?:$|[?#])/.test(lower)) {
    return { format: "mkv", formatLabel: "MKV" };
  }
  if (/webm/.test(hinted) || /\.webm(?:$|[?#])/.test(lower)) {
    return { format: "webm", formatLabel: "WebM" };
  }
  if (/\bavi\b/.test(hinted) || /\.avi(?:$|[?#])/.test(lower)) {
    return { format: "avi", formatLabel: "AVI" };
  }
  if (/mp4|m4v|quicktime/.test(hinted) || /\.(?:mp4|m4v)(?:$|[?#])/.test(lower)) {
    return { format: "mp4", formatLabel: "MP4" };
  }
  return { format: "other", formatLabel: hinted.toUpperCase() || "STREAM" };
};

export const normalizeStreams = (rawStreams: any[]): PlayableStream[] => {
  if (!Array.isArray(rawStreams) || rawStreams.length === 0) return [];

  if (rawStreams.every((stream) => stream && stream.__k45Stream === true)) {
    return rawStreams as PlayableStream[];
  }

  const seen = new Set<string>();
  const streams: PlayableStream[] = [];

  rawStreams.forEach((raw) => {
    if (!raw || typeof raw.link !== "string") return;
    const link = raw.link.trim();
    const isRemote = /^https?:\/\//i.test(link);
    const isLocal = Platform.OS !== "web" && /^(?:file|content):\/\//i.test(link);
    if (!isRemote && !isLocal) return;
    if (seen.has(link)) return;
    seen.add(link);

    const server = String(
      raw.server || raw.name || raw.label || `Source ${streams.length + 1}`,
    ).trim();
    const { format, formatLabel } = formatFromTypeAndLink(raw.type, link);
    const explicit = parseQuality(raw.quality);
    const fromUrl = inferQualityFromUrl(link);
    const quality = explicit.height != null ? explicit : fromUrl;
    const fallbackLabel = quality.label || formatLabel;

    streams.push({
      __k45Stream: true,
      index: streams.length,
      link,
      server,
      serverKey: server.toLowerCase(),
      qualityLabel: fallbackLabel,
      height: quality.height,
      format,
      formatLabel,
      adaptive: format === "hls" || format === "dash",
      downloadOnly: /\bdownload[\s-]*only\b/i.test(server),
      headers: sanitizeHeaders(raw.headers),
      subtitles: raw.subtitles,
      skip: raw.skip,
      raw,
    });
  });

  return streams;
};

export const orderGroupEntries = (
  entries: StreamGroupEntry[],
  preference: QualityPreference,
): StreamGroupEntry[] => {
  if (preference === "auto") return [...entries];
  return [...entries].sort((a, b) => {
    const ah = a.stream.height;
    const bh = b.stream.height;
    if (ah == null && bh == null) return 0;
    if (ah == null) return 1;
    if (bh == null) return -1;
    return preference === "highest" ? bh - ah : ah - bh;
  });
};

export const groupStreams = (streams: PlayableStream[]): StreamGroup[] => {
  const groups = new Map<string, PlayableStream[]>();
  for (const stream of streams) {
    const bucket = groups.get(stream.serverKey);
    if (bucket) bucket.push(stream);
    else groups.set(stream.serverKey, [stream]);
  }

  const result: StreamGroup[] = [];
  groups.forEach((bucket, key) => {
    const entries: StreamGroupEntry[] = [];
    const usedLabels = new Map<string, number>();
    for (const stream of bucket) {
      let label = stream.qualityLabel || stream.formatLabel;
      const count = usedLabels.get(label) || 0;
      usedLabels.set(label, count + 1);
      if (count > 0) label = `${label} · ${count + 1}`;
      entries.push({ stream, label });
    }
    result.push({
      key,
      label: bucket[0].server,
      entries,
      adaptive: entries.some((entry) => entry.stream.adaptive),
      formats: Array.from(
        new Set(entries.map((entry) => entry.stream.formatLabel)),
      ),
    });
  });

  return result;
};

export const preferredEntry = (
  group: StreamGroup,
  preference: QualityPreference,
): StreamGroupEntry => {
  return orderGroupEntries(group.entries, preference)[0];
};

const probeCache = new Map<
  string,
  { result: StreamProbe; expiresAt: number }
>();

const probeRequest = async (
  stream: PlayableStream,
  method: "HEAD" | "GET",
  signal: AbortSignal,
  range: boolean,
): Promise<Response> => {
  const headers = { ...stream.headers };
  if (range) headers.Range = "bytes=0-4095";
  return fetch(stream.link, { method, headers, signal });
};

export async function probeStream(
  stream: PlayableStream,
  options?: { timeoutMs?: number; signal?: AbortSignal; force?: boolean },
): Promise<StreamProbe> {
  if (/^(?:file|content):\/\//i.test(stream.link)) {
    return { status: "ok", reason: "Local file", checkedAt: Date.now() };
  }
  const cacheKey = `${stream.link}::${stream.format}`;
  const cached = probeCache.get(cacheKey);
  if (!options?.force && cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  const timeoutMs = options?.timeoutMs ?? 5000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  if (options?.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener("abort", onAbort, { once: true });
  }

  let result: StreamProbe;
  try {
    let response: Response;
    if (stream.adaptive) {
      // Manifests are cheap to fetch and HEAD requests are often rejected or
      // return no body, so validate the first bytes directly.
      response = await probeRequest(stream, "GET", controller.signal, true);
    } else {
      response = await probeRequest(stream, "HEAD", controller.signal, false);
      if ([403, 405, 501].includes(response.status)) {
        response = await probeRequest(stream, "GET", controller.signal, true);
      }
    }

    const status = response.status;
    const contentType = response.headers.get("content-type") || "";

    if (status === 416) {
      result = { status: "ok", httpStatus: status, contentType, checkedAt: Date.now() };
    } else if (status >= 200 && status < 400) {
      if (/text\/html/i.test(contentType)) {
        result = {
          status: "failed",
          httpStatus: status,
          contentType,
          reason: "Server returned a web page instead of a video stream",
          checkedAt: Date.now(),
        };
      } else if (stream.adaptive) {
        const body = (await response.text()).slice(0, 4096);
        const valid = /#EXTM3U/i.test(body) || /<MPD[\s>]/i.test(body);
        result = valid
          ? { status: "ok", httpStatus: status, contentType, checkedAt: Date.now() }
          : {
              status: "failed",
              httpStatus: status,
              contentType,
              reason: "Response is not a valid HLS/DASH manifest",
              checkedAt: Date.now(),
            };
      } else {
        result = { status: "ok", httpStatus: status, contentType, checkedAt: Date.now() };
      }
    } else if (status === 401 || status === 403 || status === 404 || status === 410) {
      result = {
        status: "failed",
        httpStatus: status,
        contentType,
        reason: `HTTP ${status}`,
        checkedAt: Date.now(),
      };
    } else {
      result = {
        status: "failed",
        httpStatus: status,
        contentType,
        reason: `HTTP ${status}`,
        checkedAt: Date.now(),
      };
    }
  } catch (error: any) {
    const aborted = controller.signal.aborted;
    result = {
      status: "unknown",
      reason: aborted ? "Server check timed out" : error?.message || "Network error",
      checkedAt: Date.now(),
    };
  } finally {
    clearTimeout(timer);
    options?.signal?.removeEventListener("abort", onAbort);
  }

  probeCache.set(cacheKey, {
    result,
    expiresAt: Date.now() + (result.status === "ok" ? 60_000 : 15_000),
  });
  return result;
}

export type PlaybackSelection = {
  streams: PlayableStream[];
  startIndex: number;
  probes: Record<number, StreamProbe>;
  failedCount: number;
  checkedCount: number;
  skippedDownloadOnly: number;
};

/**
 * Probes a handful of real candidates before playback and picks the first one
 * that answers like a video instead of an HTML error page. Probing is bounded
 * so a slow host cannot block playback — inconclusive candidates still play.
 */
export async function selectPlaybackStreams(
  rawStreams: any[],
  options?: {
    preference?: QualityPreference;
    signal?: AbortSignal;
    budgetMs?: number;
    probeTimeoutMs?: number;
    includeDownloadOnly?: boolean;
  },
): Promise<PlaybackSelection> {
  const normalized = normalizeStreams(rawStreams);
  const isDownloadOnly = (stream: PlayableStream) =>
    stream.downloadOnly || /\bdownload[\s-]*only\b/i.test(stream.server);
  const playable = options?.includeDownloadOnly
    ? normalized
    : normalized.filter((stream) => !isDownloadOnly(stream));
  const skippedDownloadOnly = normalized.length - playable.length;
  const streams = playable.map((stream, index) =>
    stream.index === index ? stream : { ...stream, index },
  );
  if (streams.length === 0) {
    return {
      streams: [],
      startIndex: 0,
      probes: {},
      failedCount: 0,
      checkedCount: 0,
      skippedDownloadOnly,
    };
  }

  const preference = options?.preference ?? "auto";
  const groups = groupStreams(streams);
  const ordered: PlayableStream[] = [];

  if (groups.length > 1) {
    groups.slice(0, 4).forEach((group) => {
      ordered.push(preferredEntry(group, preference).stream);
    });
  }

  const remainder = groups.flatMap((group) =>
    orderGroupEntries(group.entries, preference).map(
      (entry) => entry.stream,
    ),
  );
  for (const stream of remainder) {
    if (!ordered.some((candidate) => candidate.index === stream.index)) {
      ordered.push(stream);
    }
  }

  const candidates = ordered.slice(0, 4);
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (options?.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener("abort", onAbort, { once: true });
  }
  const budget = Math.max(1500, options?.budgetMs ?? 6500);
  const timer = setTimeout(() => controller.abort(), budget);

  let results: PromiseSettledResult<StreamProbe>[];
  try {
    results = await Promise.allSettled(
      candidates.map((stream) =>
        probeStream(stream, {
          timeoutMs: options?.probeTimeoutMs ?? 4500,
          signal: controller.signal,
        }),
      ),
    );
  } finally {
    clearTimeout(timer);
    options?.signal?.removeEventListener("abort", onAbort);
  }

  const probes: Record<number, StreamProbe> = {};
  let failedCount = 0;
  let checkedCount = 0;

  results.forEach((entry, index) => {
    const stream = candidates[index];
    const probe: StreamProbe =
      entry.status === "fulfilled"
        ? entry.value
        : {
            status: "unknown",
            reason:
              entry.reason instanceof Error
                ? entry.reason.message
                : "Server check failed",
            checkedAt: Date.now(),
          };
    probes[stream.index] = probe;
    checkedCount += 1;
    if (probe.status === "failed") failedCount += 1;
  });

  let chosen =
    candidates.find((stream) => probes[stream.index]?.status === "ok") ||
    candidates.find((stream) => probes[stream.index]?.status === "unknown") ||
    streams[0];

  if (!chosen) chosen = streams[0];

  const annotated = streams.map((stream) =>
    probes[stream.index] ? { ...stream, probe: probes[stream.index] } : stream,
  );

  return {
    streams: annotated,
    startIndex: chosen.index,
    probes,
    failedCount,
    checkedCount,
    skippedDownloadOnly,
  };
}

export const isLocalStream = (stream: PlayableStream | undefined): boolean =>
  !!stream &&
  (Platform.OS !== "web"
    ? stream.link.startsWith("file:") || stream.link.startsWith("content:")
    : false);
