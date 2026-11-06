// Starts playback of a SourceOption (a quality row from the Movie Based
// layout) in the app's existing player. It mirrors what DetailScreen does for
// provider titles: open the player on a placeholder, resolve the provider
// stream, pick a server, then hand the real stream to usePlayerStore.

import { episodeLabel, toPlayerEpisodes } from "@/lib/episodes";
import { selectPlaybackStreams } from "@/lib/streams";
import { findPreferredStreamIndex } from "@/lib/audioLanguages";
import { usePlayerStore, type PlayerMeta } from "@/store/usePlayerStore";
import { usePreferencesStore } from "@/store/usePreferencesStore";
import { getPreferredLanguage } from "@/store/useLayoutStore";
import {
  continueKey,
  useTmdbContinueWatchingStore,
} from "@/store/useTmdbContinueWatchingStore";
import { currentRouteName, goBack } from "@/navigation/navigationRef";
import {
  nextQueueOption,
  useSourceQueueStore,
} from "@/store/useSourceQueueStore";
import {
  forgetStreams,
  resolveStreams,
  type SourceOption,
} from "@/lib/titleBridge";
import type { TmdbMediaType } from "@/lib/tmdbApi";

export type PlayTarget = {
  mediaType: TmdbMediaType;
  id: number;
  title: string;
  // Full image URL for the player, plus raw TMDB paths for continue watching.
  imageUrl?: string;
  poster: string | null;
  backdrop: string | null;
  season?: number;
  episode?: number;
  episodeTitle?: string;
};

const PENDING = "pending://stream";
// The playSource call in progress; a newer tap aborts it.
let current: AbortController | null = null;

export function buildPlayerMeta(
  option: SourceOption,
  target: PlayTarget,
): NonNullable<PlayerMeta> {
  const isSeries = target.mediaType === "tv";
  const preferred = getPreferredLanguage();
  return {
    title: target.title,
    link: option.link,
    providerId: option.providerId,
    type: option.type,
    image: target.imageUrl,
    isSeries,
    qualities: option.linkList.map((entry) => ({
      label: entry.title || entry.quality || "Quality",
      episodesLink: entry.episodesLink,
      directLinks: toPlayerEpisodes(entry.directLinks),
    })),
    qualityIndex: option.linkIndex,
    episodes: option.items,
    episodeNumber: isSeries ? (target.episode ?? null) : null,
    linkIndex: isSeries ? undefined : option.itemIndex,
    episode: isSeries
      ? target.episodeTitle
        ? `S${target.season} E${target.episode} · ${target.episodeTitle}`
        : episodeLabel(
            { title: "", link: option.link, number: target.episode ?? null },
            option.itemIndex,
          )
      : undefined,
    preferredAudioLanguage: preferred ?? undefined,
    tmdb: {
      id: target.id,
      mediaType: target.mediaType,
      season: target.season,
      episode: target.episode,
      episodeTitle: target.episodeTitle,
      poster: target.poster,
      backdrop: target.backdrop,
    },
  };
}

function failPending(link: string) {
  const state = usePlayerStore.getState();
  if (state.currentVideoUrl === PENDING && state.playerMeta?.link === link) {
    state.close();
    if (currentRouteName() === "Player") goBack();
  }
}

/** Aborts `controller` when `signal` fires; returns the detach function. */
function link(signal: AbortSignal | undefined, controller: AbortController) {
  if (!signal) return () => {};
  if (signal.aborted) controller.abort();
  const onAbort = () => controller.abort();
  signal.addEventListener("abort", onAbort, { once: true });
  return () => signal.removeEventListener("abort", onAbort);
}

/**
 * Probes the servers and picks the one to start on: the preferred audio
 * language when known (closest to 1080p among matches), otherwise the first
 * server that answered. Language data mostly comes from the probe itself, so
 * this rarely costs an extra request.
 */
async function chooseStart(streams: any[], signal?: AbortSignal) {
  const selection = await selectPlaybackStreams(streams, {
    preference: usePreferencesStore.getState().defaultQuality,
    signal,
    budgetMs: 3000,
    probeTimeoutMs: 2600,
  });
  let startIndex = selection.startIndex;
  const preferred = getPreferredLanguage();
  if (preferred && selection.streams.length > 1 && !signal?.aborted) {
    const hit = await findPreferredStreamIndex(
      selection.streams,
      preferred,
      signal,
    );
    if (hit >= 0) startIndex = hit;
  }
  return { selection, startIndex };
}

/**
 * Plays one quality row. Throws an Error with a user-readable message when no
 * stream could be started (the caller shows it); resolves quietly when the
 * user closed or replaced the player while the provider was resolving.
 */
export async function playSource(
  option: SourceOption,
  target: PlayTarget,
  hooks: {
    openPlayer: () => void;
    onStage?: (stage: string) => void;
    signal?: AbortSignal;
  },
  // Every row the list knows about right now: the player can fall back to the
  // next one if this stream fails, and lists them in its Sources panel.
  queue?: {
    options: SourceOption[];
    providerNames?: Record<string, string>;
    unchecked?: number;
  },
): Promise<void> {
  // A newer tap replaces the one still resolving.
  current?.abort();
  const controller = new AbortController();
  current = controller;
  const detach = link(hooks.signal, controller);
  const signal = controller.signal;
  const meta = buildPlayerMeta(option, target);
  // Closes the placeholder player, unless a newer tap now owns it (a double
  // tap on the same row shares the link, so the link alone is not enough).
  const fail = () => {
    if (current === controller) failPending(option.link);
  };
  try {
    // Start (or join) the provider request before the player opens: opening
    // it interrupts background language probes, and one of them may already
    // be resolving this very row.
    const streamsPromise = resolveStreams(
      option.providerId,
      option.link,
      option.type,
      signal,
    );
    streamsPromise.catch(() => {});

    const known = queue?.options?.length ? queue.options : [];
    useSourceQueueStore.getState().setQueue({
      options: known.some((o) => o.id === option.id) ? known : [option, ...known],
      providerNames: queue?.providerNames || {},
      target,
      currentId: option.id,
      unchecked: queue?.unchecked ?? 0,
    });
    useTmdbContinueWatchingStore
      .getState()
      .restore(continueKey(target.mediaType, target.id));

    hooks.onStage?.("Preparing stream…");
    usePlayerStore.getState().setVideo(PENDING, [], 0, meta);
    hooks.openPlayer();

    let streams: any[];
    try {
      streams = await streamsPromise;
    } catch (error: any) {
      fail();
      if (signal.aborted) return;
      throw new Error(
        error?.message || "Could not get a playable stream from this provider.",
      );
    }
    if (signal.aborted) {
      fail();
      return;
    }

    hooks.onStage?.("Checking servers…");
    const { selection, startIndex } = await chooseStart(streams, signal);
    if (signal.aborted) {
      fail();
      return;
    }
    if (selection.streams.length === 0) {
      forgetStreams(option.providerId, option.link);
      fail();
      throw new Error(
        selection.skippedDownloadOnly > 0
          ? "This provider only offers download-only servers."
          : "This provider returned no playable stream.",
      );
    }

    const state = usePlayerStore.getState();
    if (state.currentVideoUrl !== PENDING || state.playerMeta?.link !== option.link) {
      // Closed or replaced while resolving: do not hijack the screen.
      return;
    }
    const chosen = selection.streams[startIndex] || selection.streams[0];
    state.setVideo(chosen.link, selection.streams, startIndex, meta);
    hooks.openPlayer();
  } finally {
    detach();
    if (current === controller) current = null;
  }
}


// ---- switching sources from inside the player ------------------------------

let switching = false;
// Aborted when the player closes, so a source switch still resolving in the
// background stops instead of reopening a closed player.
let switchController: AbortController | null = null;

usePlayerStore.subscribe((state) => {
  if (!state.currentVideoUrl) switchController?.abort();
});

/** Resolves a row to playable streams and the server to start on. */
async function resolveOption(option: SourceOption, signal?: AbortSignal) {
  const list = await resolveStreams(
    option.providerId,
    option.link,
    option.type,
    signal,
  );
  const { selection, startIndex } = await chooseStart(list, signal);
  if (selection.streams.length === 0) {
    forgetStreams(option.providerId, option.link);
    throw new Error("This provider returned no playable stream.");
  }
  return { streams: selection.streams, startIndex };
}

export type SwitchResult = "ok" | "failed" | "busy";

/**
 * Loads another provider row into the open player without leaving it,
 * resuming from `position`. A row that cannot be resolved is marked failed.
 */
export async function switchToOption(
  option: SourceOption,
  position: number,
  notice?: string,
): Promise<SwitchResult> {
  const queue = useSourceQueueStore.getState();
  if (!queue.target) return "failed";
  if (switching) return "busy";
  switching = true;
  try {
    const meta: NonNullable<PlayerMeta> = {
      ...buildPlayerMeta(option, queue.target),
      resumeAt: position > 2 ? position : undefined,
      notice,
    };
    switchController = new AbortController();
    const signal = switchController.signal;
    const { streams, startIndex } = await resolveOption(option, signal);
    const player = usePlayerStore.getState();
    if (signal.aborted || !player.currentVideoUrl) return "ok"; // player closed
    const chosen = streams[startIndex] || streams[0];
    player.setVideo(chosen.link, streams, startIndex, meta);
    useSourceQueueStore.getState().setCurrent(option.id);
    return "ok";
  } catch {
    if (switchController?.signal.aborted) return "ok"; // player closed
    useSourceQueueStore.getState().markFailed(option.id);
    return "failed";
  } finally {
    switching = false;
    switchController = null;
  }
}

/**
 * Stream failed for good: walk the queue until one row loads. Resolves false
 * when the queue is exhausted (the player then shows its error).
 */
export async function playNextQueueSource(position: number): Promise<boolean> {
  for (let guard = 0; guard < 50; guard += 1) {
    const next = nextQueueOption();
    if (!next) return false;
    const { providerNames } = useSourceQueueStore.getState();
    const name = providerNames[next.providerId] || next.providerId;
    const result = await switchToOption(
      next,
      position,
      `Stream failed — switched to ${name}`,
    );
    if (result === "ok" || result === "busy") return true;
  }
  return false;
}
