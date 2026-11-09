// TV remote seeking ("scrubbing"): Left/Right move a pending target that is
// previewed on the timeline and applied with one real seek once the user stops
// pressing. No imports, unit-tested with plain Node.
//
// Remote events (react-native-tvos, Android): only key-UP events are sent for
// normal presses (eventKeyAction 1) unless ReactFeatureFlags.enableKeyDownEvents
// is on; holding a key sends one "long*" event with action 0 and another with
// action 1 on release.

/** Seconds per step while tapping, and once a key has been held a while. */
export const SCRUB_STEP = 10;
export const SCRUB_FAST_STEP = 30;
/** Holding longer than this switches to the fast step. */
export const SCRUB_ACCELERATE_AFTER_MS = 1500;
/**
 * While Left/Right is held, the target moves one step this often. (The
 * react-native-tvos Android helper reports a held key as a single
 * "longLeft"/"longRight" down event and one up event on release, so the
 * repeat is timer-driven on our side.)
 */
export const SCRUB_HOLD_INTERVAL_MS = 250;
/** The real seek happens this long after the last press. */
export const SCRUB_COMMIT_MS = 700;

/**
 * Next pending target. Starts from `pending` (an earlier press not yet
 * applied) or the current position, moves one step, and stays inside the
 * video. An unknown duration (0) only limits the start.
 */
export function nextScrubTarget(
  pending: number | null,
  current: number,
  direction: 1 | -1,
  heldMs: number,
  duration: number,
): number {
  const base = pending ?? (Number.isFinite(current) ? current : 0);
  const step = heldMs >= SCRUB_ACCELERATE_AFTER_MS ? SCRUB_FAST_STEP : SCRUB_STEP;
  const target = base + direction * step;
  const max = duration > 0 ? duration : Number.POSITIVE_INFINITY;
  return Math.min(Math.max(0, target), max);
}

/** Clamp for real seeks; an unknown duration (0) does not cap the target. */
export function clampSeek(time: number, duration: number): number {
  const max = duration > 0 ? duration : Number.POSITIVE_INFINITY;
  return Math.min(Math.max(0, Number.isFinite(time) ? time : 0), max);
}

/** What a remote event means for the player (pure, unit-tested). */
export type RemoteAction =
  | { kind: "step"; direction: 1 | -1 }
  | { kind: "holdStart"; direction: 1 | -1 }
  | { kind: "holdEnd" }
  | { kind: "boostStart" }
  | { kind: "boostEnd" }
  | { kind: "togglePlay" }
  | { kind: "play" }
  | { kind: "pause" }
  | { kind: "wake" }
  | { kind: "none" };

/**
 * Maps a react-native-tvos remote event to a player action. `scrubZone` is true
 * when Left/Right should seek (controls hidden, or focus on the center
 * Play/Pause button) rather than move focus between buttons. OK (select) is
 * handled by the focused button itself, so only its long press is mapped.
 */
export function remoteAction(
  eventType: string,
  eventKeyAction: number | null | undefined,
  scrubZone: boolean,
): RemoteAction {
  const down = eventKeyAction === 0;
  const up = !down; // UP (1) or unspecified (-1)
  switch (eventType) {
    case "left":
    case "right":
      if (!up) return { kind: "none" };
      return scrubZone
        ? { kind: "step", direction: eventType === "right" ? 1 : -1 }
        : { kind: "wake" };
    case "longLeft":
    case "longRight":
    case "longRewind":
    case "longFastForward": {
      // Release always ends a hold, wherever focus is now.
      if (up) return { kind: "holdEnd" };
      if (!scrubZone) return { kind: "wake" };
      const direction = eventType === "longRight" || eventType === "longFastForward" ? 1 : -1;
      return { kind: "holdStart", direction };
    }
    case "rewind":
    case "fastForward":
      return up ? { kind: "step", direction: eventType === "fastForward" ? 1 : -1 } : { kind: "none" };
    case "longSelect":
      // Release always ends 2x, wherever focus is now.
      if (up) return { kind: "boostEnd" };
      return scrubZone ? { kind: "boostStart" } : { kind: "none" };
    case "playPause":
    case "longPlayPause":
      return up ? { kind: "togglePlay" } : { kind: "none" };
    case "play":
      return up ? { kind: "play" } : { kind: "none" };
    case "pause":
      return up ? { kind: "pause" } : { kind: "none" };
    case "up":
    case "down":
    case "longUp":
    case "longDown":
      return up ? { kind: "wake" } : { kind: "none" };
    default:
      return { kind: "none" };
  }
}
