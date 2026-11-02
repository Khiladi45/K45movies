// Dead-link filtering for the Movie Based layout.
//
// A quality row only knows a provider *page* link. To confirm it really plays
// we resolve its stream(s) through the provider, then probe the stream URL
// (HEAD, or a first-bytes GET for HLS/DASH and for hosts that reject HEAD).
// Rows whose streams all answer 404/403/HTML/etc. are dropped from the UI.
// Everything runs in the background, a few rows at a time, so nothing blocks.

import { providerApi } from "@/lib/providerApi";
import {
  normalizeStreams,
  probeStream,
  type PlayableStream,
} from "@/lib/streams";
import { detectLanguagesFromStreams } from "@/lib/audioLanguages";
import type { SourceOption } from "@/lib/titleBridge";

export type ValidationResult = {
  // ok = at least one stream confirmed working; dead = every stream failed or
  // none was playable; unknown = could not be confirmed (timeout / network).
  status: "ok" | "dead" | "unknown";
  languages: string[];
};

const PROBE_TIMEOUT_MS = 4500;
const MAX_STREAMS_PER_ROW = 4;
const RAW_TTL_MS = 3 * 60_000;

const rawCache = new Map<string, { raw: any; expiresAt: number }>();
const resultCache = new Map<string, ValidationResult>();

const cacheKey = (option: Pick<SourceOption, "providerId" | "link">) =>
  `${option.providerId}|${option.link}`;

/** Raw provider response fetched during validation, reused by playback so the
 * provider is not asked twice. Returns undefined once it is stale. */
export function takeResolvedStream(providerId: string, link: string): any {
  const hit = rawCache.get(`${providerId}|${link}`);
  if (!hit || hit.expiresAt < Date.now()) return undefined;
  return hit.raw;
}

export function peekValidation(
  option: Pick<SourceOption, "providerId" | "link">,
): ValidationResult | undefined {
  return resultCache.get(cacheKey(option));
}

const isDownloadOnly = (stream: PlayableStream) =>
  stream.downloadOnly || /\bdownload[\s-]*only\b/i.test(stream.server);

/** Resolves and probes one row. Never throws (aborts resolve as unknown). */
export async function validateOption(
  option: SourceOption,
  signal?: AbortSignal,
): Promise<ValidationResult> {
  const key = cacheKey(option);
  const cached = resultCache.get(key);
  if (cached && cached.status !== "unknown") return cached;

  let result: ValidationResult;
  try {
    let raw: any;
    const stored = rawCache.get(key);
    if (stored && stored.expiresAt > Date.now()) {
      raw = stored.raw;
    } else {
      raw = await providerApi.getStream(
        option.providerId,
        option.link,
        option.type,
        signal,
      );
      rawCache.set(key, { raw, expiresAt: Date.now() + RAW_TTL_MS });
    }
    if (signal?.aborted) return { status: "unknown", languages: [] };

    const streams = normalizeStreams(
      Array.isArray(raw) ? raw : raw ? [raw] : [],
    )
      .filter((stream) => !isDownloadOnly(stream))
      .slice(0, MAX_STREAMS_PER_ROW);

    if (streams.length === 0) {
      result = { status: "dead", languages: [] };
    } else {
      // Probe the candidates together; any confirmed stream makes the row live.
      const probes = await Promise.all(
        streams.map((stream) =>
          probeStream(stream, { timeoutMs: PROBE_TIMEOUT_MS, signal }),
        ),
      );
      if (signal?.aborted) return { status: "unknown", languages: [] };
      const live = streams.filter((_s, i) => probes[i].status === "ok");
      if (live.length > 0) {
        const languages = await detectLanguagesFromStreams(live, { signal }).catch(
          () => [] as string[],
        );
        result = { status: "ok", languages };
      } else if (probes.every((probe) => probe.status === "failed")) {
        result = { status: "dead", languages: [] };
      } else {
        result = { status: "unknown", languages: [] };
      }
    }
  } catch {
    // Provider could not resolve the row (or the request was aborted).
    result = { status: signal?.aborted ? "unknown" : "dead", languages: [] };
  }

  if (!signal?.aborted) resultCache.set(key, result);
  return result;
}

/**
 * Validates rows with bounded concurrency and reports each as it finishes, so
 * confirmed rows appear one by one while slower ones are still being checked.
 */
export async function validateOptions(
  options: SourceOption[],
  onResult: (id: string, result: ValidationResult) => void,
  signal?: AbortSignal,
  concurrency = 4,
): Promise<void> {
  let next = 0;
  const lane = async () => {
    while (!signal?.aborted) {
      const index = next++;
      if (index >= options.length) return;
      const option = options[index];
      const result = await validateOption(option, signal);
      if (!signal?.aborted) onResult(option.id, result);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, options.length) }, lane),
  );
}
