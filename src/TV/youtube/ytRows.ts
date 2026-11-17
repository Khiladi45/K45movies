// YouTube TV home rows (no imports; unit-tested): videos in rows of N with a
// Shorts row after every 5-8 videos, at the same stable positions as the
// phone YtHomeScreen (same gap formula).

export type TvYtRow<V> =
  | { kind: "videos"; key: string; items: V[] }
  | { kind: "shorts"; key: string; items: V[]; startIndex: number };

/** Same stable pseudo-random 5-8 as the phone's shelf gaps. */
export const shelfGap = (n: number) => 5 + (((n * 2654435761) >>> 0) % 4);

export const SHORTS_PER_ROW = 8;

export function buildTvRows<V extends { id: string }>(
  videos: V[],
  shorts: V[],
  columns = 3,
): TvYtRow<V>[] {
  const rows: TvYtRow<V>[] = [];
  let pending: V[] = [];
  let shelf = 0;
  let untilShelf = shelfGap(0);
  const flush = () => {
    if (pending.length) {
      rows.push({ kind: "videos", key: `v-${pending[0].id}`, items: pending });
      pending = [];
    }
  };
  for (const video of videos) {
    pending.push(video);
    untilShelf -= 1;
    if (pending.length === columns) flush();
    const start = shelf * SHORTS_PER_ROW;
    if (untilShelf <= 0 && start + 1 <= shorts.length) {
      flush();
      rows.push({
        kind: "shorts",
        key: `s-${shelf}`,
        items: shorts.slice(start, start + SHORTS_PER_ROW),
        startIndex: start,
      });
      shelf += 1;
      untilShelf = shelfGap(shelf);
    }
  }
  flush();
  return rows;
}

/** Filters out videos and channels the user hid (same rule as phone Home). */
export function withoutHidden<V extends { id: string; channelName?: string }>(
  videos: V[],
  hiddenVideos: string[],
  hiddenChannels: string[],
): V[] {
  return videos.filter(
    (v) => !hiddenVideos.includes(v.id) && !(v.channelName && hiddenChannels.includes(v.channelName)),
  );
}
