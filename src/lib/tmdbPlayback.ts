// Starts playback of a SourceOption (a quality row from the Movie Based
// layout) in the app's existing player. It mirrors what DetailScreen does for
// provider titles: open the player on a placeholder, resolve the provider
// stream, pick a server, then hand the real stream to usePlayerStore.

import { providerApi } from "@/lib/providerApi";
import { episodeLabel, toPlayerEpisodes } from "@/lib/episodes";
import { selectPlaybackStreams } from "@/lib/streams";
import { takeResolvedStream } from "@/lib/streamValidation";
import { findPreferredStreamIndex } from "@/lib/audioLanguages";
import { usePlayerStore, type PlayerMeta } from "@/store/usePlayerStore";
import { usePreferencesStore } from "@/store/usePreferencesStore";
import { getPreferredLanguage } from "@/store/useLayoutStore";
import {
  continueKey,
  useTmdbContinueWatchingStore,
} from "@/store/useTmdbContinueWatchingStore";
import { currentRouteName, goBack } from "@/navigation/navigationRef";
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
): Promise<void> {
  if (inFlight) return;
  inFlight = true;
  const meta = buildPlayerMeta(option, target);
  try {
    useTmdbContinueWatchingStore
      .getState()
      .restore(continueKey(target.mediaType, target.id));

    hooks.onStage?.("Preparing stream…");
    usePlayerStore.getState().setVideo(PENDING, [], 0, meta);
    hooks.openPlayer();

    // The row was already resolved while being verified: reuse that answer.
    let raw: any = takeResolvedStream(option.providerId, option.link);
    if (raw === undefined) {
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
