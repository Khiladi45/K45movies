import { providers } from "./catalog-api";
import type { Source } from "./catalog-types";
import type { Progress } from "./library";
import { usePlayback } from "./playback";

export async function checkSource(source: Source, signal: AbortSignal) {
  try {
    const response = await fetch(source.url, { method: "HEAD", signal: AbortSignal.any([signal, AbortSignal.timeout(6000)]) });
    const type = response.headers.get("content-type") ?? "";
    // A host may reject HEAD while still serving GET.
    if ([400, 405, 501, 502, 503, 504].includes(response.status)) return "unknown";
    return response.ok && !/text\/html|application\/json/.test(type) ? "available" : "failed";
  } catch { return "unknown"; }
}

export async function resumePlayback(entry: Progress, signal: AbortSignal) {
  if (!entry.playback) return false;
  const item = entry.playback.item;
  const sources = await providers.sources(item.provider, item.ref, item.series ? "series" : "movie", signal);
  if (!sources.length || signal.aborted) return false;
  const index = sources.findIndex(({ server, quality }) => server === entry.source?.server && quality === entry.source?.quality);
  usePlayback.getState().open({ target: entry.playback, sources, index: Math.max(0, index), position: entry.position });
  return true;
}
