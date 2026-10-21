import { create } from "zustand";

export type PlayerMeta = {
  title?: string;
  episode?: string;
  poster?: string;
  link?: string;
  providerId?: string;
  type?: string;
  image?: string;
} | null;

type PlayerState = {
  sessionId: number;
  currentVideoUrl: string;
  streams: any[];
  initialStreamIndex: number;
  playerMeta: PlayerMeta;
  expanded: boolean;
  open: (
    url: string,
    streams?: any[],
    index?: number,
    meta?: PlayerMeta,
  ) => void;
  setVideo: (
    url: string,
    streams?: any[],
    index?: number,
    meta?: PlayerMeta,
  ) => void;
  expand: () => void;
  minimize: () => void;
  close: () => void;
  closeMiniPlayer: () => void;
};

export const usePlayerStore = create<PlayerState>()((set) => ({
  sessionId: 0,
  currentVideoUrl: "",
  streams: [],
  initialStreamIndex: 0,
  playerMeta: null,
  expanded: false,
  open: (url, streams = [], index = 0, meta = null) =>
    set((state) => ({
      sessionId: state.sessionId + 1,
      currentVideoUrl: url,
      streams,
      initialStreamIndex: index,
      playerMeta: meta,
      expanded: true,
    })),
  setVideo: (url, streams = [], index = 0, meta = null) =>
    set((state) => ({
      sessionId: state.sessionId + 1,
      currentVideoUrl: url,
      streams,
      initialStreamIndex: index,
      playerMeta: meta,
      expanded: true,
    })),
  expand: () => set({ expanded: true }),
  minimize: () => set({ expanded: false }),
  close: () =>
    set({
      currentVideoUrl: "",
      streams: [],
      initialStreamIndex: 0,
      playerMeta: null,
      expanded: false,
    }),
  closeMiniPlayer: () =>
    set({
      currentVideoUrl: "",
      streams: [],
      initialStreamIndex: 0,
      playerMeta: null,
      expanded: false,
    }),
}));
