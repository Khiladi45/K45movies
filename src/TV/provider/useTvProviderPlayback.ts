// Provider Based TV: start playback the same way the phone DetailScreen does
// (pending player → provider stream → server check → real stream) so the
// global PlayerOverlay, its TV controls, quality/episode panels, resume and
// Continue Watching all work unchanged. Mirrors only what TV needs.
import { useCallback, useEffect, useRef, useState } from "react";
import { providerApi } from "@/lib/providerApi";
import { selectPlaybackStreams } from "@/lib/streams";
import { usePlayerStore } from "@/store/usePlayerStore";
import { usePreferencesStore } from "@/store/usePreferencesStore";
import { setPlaybackStage } from "@/store/usePlaybackStageStore";
import { currentRouteName, goBack, navigate } from "@/navigation/navigationRef";
import { buildProviderPlayerMeta, type TvPlayCtx } from "./providerMeta";

const PENDING = "pending://stream";

export function useTvProviderPlayback({
  info,
  post,
  providerId,
}: {
  info: any;
  post: { link: string; title?: string; image?: string; type?: string };
  providerId: string;
}) {
  const [playingLink, setPlayingLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const current = useRef<AbortController | null>(null);
  const infoRef = useRef(info);
  infoRef.current = info;

  useEffect(() => () => current.current?.abort(), []);

  const play = useCallback(
    async (link: string, type: string, ctx?: TvPlayCtx | null) => {
      // A newer press replaces one that is still resolving.
      current.current?.abort();
      const controller = new AbortController();
      current.current = controller;
      const { signal } = controller;
      setError(null);
      setPlayingLink(link);
      const meta = buildProviderPlayerMeta({
        info: infoRef.current,
        post,
        providerId,
        link,
        type,
        ctx,
      });
      // Closes the placeholder player, unless a newer press owns it now.
      const fail = (message: string) => {
        if (current.current !== controller) return;
        const state = usePlayerStore.getState();
        if (state.currentVideoUrl === PENDING && state.playerMeta?.link === link) {
          state.close();
          if (currentRouteName() === "Player") goBack();
        }
        setError(message);
      };
      try {
        setPlaybackStage("source");
        usePlayerStore.getState().setVideo(PENDING, [], 0, meta);
        navigate("Player");

        let raw: any;
        try {
          raw = await providerApi.getStream(providerId, link, type, signal);
        } catch (e: any) {
          if (signal.aborted) return;
          return fail(e?.message || "Could not get a playable stream from this provider.");
        }
        if (signal.aborted) return;
        setPlaybackStage("servers");
        const streams: any[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
        const selection = await selectPlaybackStreams(streams, {
          preference: usePreferencesStore.getState().defaultQuality,
          signal,
          budgetMs: 3000,
          probeTimeoutMs: 2600,
        });
        if (signal.aborted) return;
        if (selection.streams.length === 0) {
          return fail(
            selection.skippedDownloadOnly > 0
              ? "This provider only offers download-only servers."
              : "This provider returned no playable stream.",
          );
        }
        const state = usePlayerStore.getState();
        if (state.currentVideoUrl !== PENDING || state.playerMeta?.link !== link) return;
        const chosen = selection.streams[selection.startIndex] || selection.streams[0];
        state.setVideo(chosen.link, selection.streams, selection.startIndex, meta);
      } finally {
        if (current.current === controller) setPlayingLink(null);
      }
    },
    [post, providerId],
  );

  return { play, playingLink, error, clearError: () => setError(null) };
}
