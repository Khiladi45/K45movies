// Continue Watching -> player, skipping the Details page.
//
// The player saves a ResumeSnapshot (its meta + the user's stream / audio /
// subtitle choices) with every Continue Watching entry. Tapping the entry
// rebuilds the player from it: same provider, quality, episode and position,
// with the saved server, audio track and subtitle re-applied on first load.

import { providerApi } from "@/lib/providerApi";
import { selectPlaybackStreams, type PlayableStream } from "@/lib/streams";
import {
  usePlayerStore,
  type PlayerMeta,
  type PlayerRestore,
  type ResumeSnapshot,
} from "@/store/usePlayerStore";
import { usePreferencesStore } from "@/store/usePreferencesStore";
import { useContinueWatchingStore } from "@/store/useContinueWatchingStore";
import {
  continueKey,
  useTmdbContinueWatchingStore,
} from "@/store/useTmdbContinueWatchingStore";
import { currentRouteName, goBack, navigate } from "@/navigation/navigationRef";

const PENDING = "pending://stream";
let inFlight = false;

/** Index of the stream the user had selected, or -1 when it is gone. */
function findSavedStream(
  streams: PlayableStream[],
  saved?: PlayerRestore["stream"],
): number {
  if (!saved) return -1;
  const byKey = streams.findIndex(
    (s) =>
      !!saved.serverKey &&
      s.serverKey === saved.serverKey &&
      (!saved.qualityLabel || s.qualityLabel === saved.qualityLabel) &&
      (saved.height == null || s.height === saved.height),
  );
  if (byKey >= 0) return byKey;
  const byServer = streams.findIndex(
    (s) => !!saved.serverKey && s.serverKey === saved.serverKey,
  );
  if (byServer >= 0) return byServer;
  return saved.link ? streams.findIndex((s) => s.link === saved.link) : -1;
}

function failPending(link?: string) {
  const state = usePlayerStore.getState();
  if (state.currentVideoUrl === PENDING && state.playerMeta?.link === link) {
    state.close();
    if (currentRouteName() === "Player") goBack();
  }
}

/**
 * Opens the player straight from a saved snapshot. Resolves false when it
 * could not start (the caller then falls back to the Details page).
 */
export async function resumeFromSnapshot(
  snapshot: ResumeSnapshot,
  position: number,
  onError?: (message: string) => void,
): Promise<boolean> {
  const base = snapshot.meta;
  if (!base?.link || !base.providerId) return false;
  if (inFlight) return true; // a resume is already starting: ignore the tap
  inFlight = true;
  const meta: NonNullable<PlayerMeta> = {
    ...base,
    resumeAt: position > 2 ? position : undefined,
    restore: snapshot.restore,
  };
  try {
    usePlayerStore.getState().setVideo(PENDING, [], 0, meta);
    navigate("Player");

    let raw: any;
    try {
      raw = await providerApi.getStream(
        base.providerId,
        base.link,
        base.type || "movie",
      );
    } catch (error: any) {
      failPending(base.link);
      onError?.(error?.message || "Could not get a playable stream.");
      return false;
    }

    const streams: any[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const selection = await selectPlaybackStreams(streams, {
      preference: usePreferencesStore.getState().defaultQuality,
      budgetMs: 3000,
      probeTimeoutMs: 2600,
    });
    if (selection.streams.length === 0) {
      failPending(base.link);
      onError?.("This provider returned no playable stream.");
      return false;
    }

    const state = usePlayerStore.getState();
    if (state.currentVideoUrl !== PENDING || state.playerMeta?.link !== base.link) {
      return true; // closed or replaced meanwhile: leave the screen alone
    }

    // Prefer the exact server the user had, unless it is known to be dead.
    let start = selection.startIndex;
    const saved = findSavedStream(selection.streams, snapshot.restore.stream);
    if (saved >= 0 && selection.streams[saved].probe?.status !== "failed") {
      start = saved;
    }
    const chosen = selection.streams[start] || selection.streams[0];
    state.setVideo(chosen.link, selection.streams, start, meta);
    return true;
  } finally {
    inFlight = false;
  }
}

/** Provider Based layout entry. */
export function resumeProviderItem(
  item: { link: string; position: number; resume?: ResumeSnapshot },
  onError?: (message: string) => void,
) {
  if (!item.resume) return Promise.resolve(false);
  useContinueWatchingStore.getState().restore(item.link);
  return resumeFromSnapshot(item.resume, item.position, onError);
}

/** Movie Based layout entry. */
export function resumeTmdbItem(
  item: {
    id: number;
    mediaType: "movie" | "tv";
    position: number;
    resume?: ResumeSnapshot;
  },
  onError?: (message: string) => void,
) {
  if (!item.resume) return Promise.resolve(false);
  useTmdbContinueWatchingStore
    .getState()
    .restore(continueKey(item.mediaType, item.id));
  return resumeFromSnapshot(item.resume, item.position, onError);
}
