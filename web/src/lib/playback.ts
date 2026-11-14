import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Source } from "./catalog-types";
import type { SavedTitle } from "./library";

export type PlaybackItem = { provider: string; ref: string; title: string; series: boolean };
export type PlaybackTarget = {
  title: SavedTitle;
  item: PlaybackItem;
  episodes: PlaybackItem[];
  episodeNumber?: number;
  seasonNumber?: number;
  preferredLanguage?: string;
};
type Session = { target: PlaybackTarget; sources: Source[]; index: number; position: number };

export const usePlayback = create<{
  session: Session | null; minimized: boolean; sessionId: number;
  open: (session: Session) => void; replace: (session: Session) => void; minimize: () => void; expand: () => void; close: () => void;
}>((set) => ({
  session: null, minimized: false, sessionId: 0,
  open: (session) => set((state) => ({ session, minimized: false, sessionId: state.sessionId + 1 })),
  replace: (session) => set({ session }),
  minimize: () => set({ minimized: true }),
  expand: () => set({ minimized: false }),
  close: () => set({ session: null, minimized: false }),
}));

export type CaptionStyle = {
  size: number; color: string; background: string; opacity: number; delay: number;
  weight: number; bottom: number; align: "left" | "center" | "right"; shadow: boolean;
  font: "sans-serif" | "serif" | "monospace";
};
export const defaultCaptionStyle: CaptionStyle = {
  size: 16, color: "#ffffff", background: "#000000", opacity: 55, delay: 0,
  weight: 600, bottom: 36, align: "center", shadow: true, font: "sans-serif",
};

type PlayerPreferences = {
  captions: CaptionStyle; autoplay: boolean;
  patch: (style: Partial<CaptionStyle>) => void; reset: () => void; toggleAutoplay: () => void;
};

export const usePlayerPreferences = create<PlayerPreferences>()(persist((set) => ({
  captions: defaultCaptionStyle, autoplay: false,
  patch: (style) => set((state) => ({ captions: { ...state.captions, ...style } })),
  reset: () => set({ captions: defaultCaptionStyle }),
  toggleAutoplay: () => set((state) => ({ autoplay: !state.autoplay })),
}), {
  name: "k45-web-player-preferences", storage: createJSONStorage(() => localStorage), skipHydration: true,
  merge: (saved, current) => {
    const previous = saved as Partial<PlayerPreferences> | undefined;
    return { ...current, autoplay: previous?.autoplay === true, captions: { ...defaultCaptionStyle, ...previous?.captions } };
  },
}));
