import { create } from "zustand";

/**
 * Where playback start-up currently is, shown step by step on the loading
 * screen. Set by tmdbPlayback (source → servers → audio) and by the player
 * (buffering until the first frame).
 */
export type PlaybackStage = "source" | "servers" | "audio" | "buffering";

export const PLAYBACK_STAGES: PlaybackStage[] = ["source", "servers", "audio", "buffering"];

export const usePlaybackStageStore = create<{
  stage: PlaybackStage;
  setStage: (stage: PlaybackStage) => void;
}>((set) => ({
  stage: "source",
  setStage: (stage) => set({ stage }),
}));

export const setPlaybackStage = (stage: PlaybackStage) =>
  usePlaybackStageStore.getState().setStage(stage);
