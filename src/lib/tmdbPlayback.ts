// Starts playback of a SourceOption (a quality row from the Movie Based
// layout) in the app's existing player. It mirrors what DetailScreen does for
// provider titles: open the player on a placeholder, resolve the provider
// stream, pick a server, then hand the real stream to usePlayerStore.

import { providerApi } from "@/lib/providerApi";
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
import type { SourceOption } from "@/lib/titleBridge";
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
let inFlight = false;

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
  if (inFlight) return;
  inFlight = true;
  const meta = buildPlayerMeta(option, target);
  try {
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

    let raw: any;
    try {
      raw = await providerApi.getStream(
        option.providerId,
        option.link,
        option.type,
        hooks.signal,
      );
    } catch (error: any) {
      failPending(option.link);
      throw new Error(
        error?.message || "Could not get a playable stream from this provider.",
      );
    }
    if (hooks.signal?.aborted) return;

    hooks.onStage?.("Checking servers…");
    const streams: any[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const selection = await selectPlaybackStreams(streams, {
      preference: usePreferencesStore.getState().defaultQuality,
      signal: hooks.signal,
      budgetMs: 3000,
      probeTimeoutMs: 2600,
    });
    if (hooks.signal?.aborted) return;
    if (selection.streams.length === 0) {
      failPending(option.link);
      throw new Error(
        selection.skippedDownloadOnly > 0
          ? "This provider only offers download-only servers."
          : "This provider returned no playable stream.",
      );
    }

    // Prefer a server whose audio matches the user's language, but never one
    // the probe already found dead.
    let startIndex = selection.startIndex;
    const preferred = getPreferredLanguage();
    if (preferred && selection.streams.length > 1) {
      hooks.onStage?.("Choosing audio…");
      const hit = await findPreferredStreamIndex(
        selection.streams,
        preferred,
        hooks.signal,
      );
      if (hit >= 0 && selection.streams[hit].probe?.status !== "failed") {
        startIndex = hit;
      }
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
    inFlight = false;
  }
}


// ---- switching sources from inside the player ------------------------------

let switching = false;

/** Resolves a row to playable streams and the server to start on. */
async function resolveOption(option: SourceOption) {
  const raw = await providerApi.getStream(
    option.providerId,
    option.link,
    option.type,
  );
  const list: any[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const selection = await selectPlaybackStreams(list, {
    preference: usePreferencesStore.getState().defaultQuality,
    budgetMs: 3000,
    probeTimeoutMs: 2600,
  });
  if (selection.streams.length === 0) {
    throw new Error("This provider returned no playable stream.");
  }
  let startIndex = selection.startIndex;
  const preferred = getPreferredLanguage();
  if (preferred && selection.streams.length > 1) {
    const hit = await findPreferredStreamIndex(selection.streams, preferred);
    if (hit >= 0 && selection.streams[hit].probe?.status !== "failed") {
      startIndex = hit;
    }
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
    const { streams, startIndex } = await resolveOption(option);
    const player = usePlayerStore.getState();
    if (!player.currentVideoUrl) return "ok"; // the user closed the player
    const chosen = streams[startIndex] || streams[0];
    player.setVideo(chosen.link, streams, startIndex, meta);
    useSourceQueueStore.getState().setCurrent(option.id);
    return "ok";
  } catch {
    useSourceQueueStore.getState().markFailed(option.id);
    return "failed";
  } finally {
    switching = false;
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
