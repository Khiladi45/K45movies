import { create } from "zustand";
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
