// Pure ranking helpers for picking the stream playback starts on. No imports,
// so they can be unit-tested with plain Node (see tests/stream-selection).

/** Height playback aims for under the "hd" preference. */
export const HD_TARGET_HEIGHT = 1080;

/**
 * Sort key for the "hd" preference (lower is better): heights at or below
 * 1080p first, tallest first; then taller-than-1080p (slower to start), the
 * closest first; unknown heights last.
 */
export function hdRank(height: number | null | undefined): number {
  if (height == null || !(height > 0)) return 100000;
  if (height <= HD_TARGET_HEIGHT) return HD_TARGET_HEIGHT - height;
  return 10000 + (height - HD_TARGET_HEIGHT);
}

/**
 * Among streams whose audio matches the preferred language, the index of the
 * best one for a fast HD start; -1 when none matches. Streams the server check
 * already found dead are never chosen.
 */
export function pickPreferredIndex(
  candidates: {
    languages: string[];
    height: number | null;
    failed?: boolean;
  }[],
  preferred: string,
): number {
  let best = -1;
  candidates.forEach((candidate, index) => {
    if (candidate.failed || !candidate.languages.includes(preferred)) return;
    if (best < 0 || hdRank(candidate.height) < hdRank(candidates[best].height)) {
      best = index;
    }
  });
  return best;
}

/** Search order: the priority provider first, the rest unchanged. */
export function providersInPriorityOrder(
  installed: string[],
  priority: string | null | undefined,
): string[] {
  if (!priority || !installed.includes(priority)) return installed;
  return [priority, ...installed.filter((id) => id !== priority)];
}

/**
 * Puts the priority provider's rows first, highest quality first (taller
 * first, unknown heights last); every other row keeps its order after them.
 */
export function prioritizeProviderRows<T extends { providerId: string; height: number | null }>(
  rows: T[],
  priority: string | null | undefined,
): T[] {
  if (!priority) return rows;
  const mine = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.providerId === priority)
    .sort(
      (a, b) =>
        (b.row.height ?? -1) - (a.row.height ?? -1) || a.index - b.index,
    )
    .map(({ row }) => row);
  if (mine.length === 0) return rows;
  return [...mine, ...rows.filter((row) => row.providerId !== priority)];
}
