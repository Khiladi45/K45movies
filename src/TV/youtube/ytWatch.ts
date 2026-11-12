// Pure helpers for the TV YouTube watch page and Shorts player (no imports,
// unit-tested with plain Node).

/** Video autoplay picks after one ends: the first related non-Short, not the same video. */
export function nextAutoplay<V extends { id: string; isShort?: boolean }>(
  related: V[] | undefined,
  currentId: string,
): V | undefined {
  return (related ?? []).find((r) => !r.isShort && r.id !== currentId);
}

/** 75 → "1:15", 3725 → "1:02:05". */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** 0..1 progress for a bar; 0 for an unknown duration. */
export function progressOf(position: number, duration: number): number {
  if (!(duration > 0) || !Number.isFinite(position)) return 0;
  return Math.min(1, Math.max(0, position / duration));
}

/**
 * Tiny pub/sub so frequent player updates (every 500 ms) re-render only the
 * control layer that subscribes, not the whole watch page.
 */
export function createBus<T>(initial: T) {
  let value = initial;
  const listeners = new Set<(v: T) => void>();
  return {
    get: () => value,
    emit: (v: T) => {
      value = v;
      listeners.forEach((l) => l(v));
    },
    subscribe: (l: (v: T) => void) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
}

/** Index of the Short to show after ▲/▼, clamped to the list. */
export function stepShort(index: number, delta: number, length: number): number {
  if (length <= 0) return 0;
  return Math.min(length - 1, Math.max(0, index + delta));
}

/** Shorts that should mount a player: the active one and its neighbours. */
export function isNearActive(index: number, active: number): boolean {
  return Math.abs(index - active) <= 1;
}
