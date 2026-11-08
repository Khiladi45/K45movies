// Play flow shared by the phone and TV title pages of the Movie Based layout.
import { useCallback, useEffect, useRef, useState } from "react";
import { playSource, type PlayTarget } from "@/lib/tmdbPlayback";
import { tmdbImage, type TmdbDetails } from "@/lib/tmdbApi";
import type { SourceOption } from "@/lib/titleBridge";

export type PlayQueue = {
  options: SourceOption[];
  providerNames?: Record<string, string>;
  unchecked?: number;
};

/** Everything the list knows now, handed to the player as its stream queue. */
export function buildQueue(sources: {
  options: SourceOption[];
  providers: { providerId: string; name: string; status: string }[];
}): PlayQueue {
  return {
    options: sources.options,
    providerNames: Object.fromEntries(
      sources.providers.map((p) => [p.providerId, p.name]),
    ),
    unchecked: sources.providers.filter(
      (p) => p.status === "searching" || p.status === "resolving",
    ).length,
  };
}

export function usePlayback(navigation: any) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  const play = useCallback(
    async (
      option: SourceOption,
      target: PlayTarget,
      onOpen?: () => void,
      queue?: PlayQueue,
    ) => {
      // A second tap while a source is still resolving switches to the new
      // source instead of being silently ignored.
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;
      setError(null);
      setPlayingId(option.id);
      try {
        await playSource(option, target, {
          openPlayer: () => {
            onOpen?.();
            if (navigation.isFocused()) navigation.navigate("Player");
          },
          onStage: setStage,
          signal: controller.signal,
        }, queue);
      } catch (e: any) {
        if (!controller.signal.aborted) {
          setError(e?.message || "Could not start playback.");
        }
      } finally {
        // A newer tap owns the state now; leave it alone.
        if (abort.current === controller) {
          setPlayingId(null);
          setStage(null);
        }
      }
    },
    [navigation],
  );

  return { play, playingId, stage, error, clearError: () => setError(null) };
}

export function playTarget(
  details: TmdbDetails,
  episode?: { season: number; episode: number; name: string },
): PlayTarget {
  return {
    mediaType: details.mediaType,
    id: details.id,
    title: details.title,
    imageUrl: tmdbImage(details.poster, "w500") || undefined,
    poster: details.poster,
    backdrop: details.backdrop,
    season: episode?.season,
    episode: episode?.episode,
    episodeTitle: episode?.name || undefined,
  };
}
