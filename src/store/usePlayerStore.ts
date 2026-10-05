import { create } from "zustand";

type PlayerMeta = { title?: string; episode?: string; poster?: string } | null;

type PlayerState = {
  currentVideoUrl: string;
  streams: any[];
  initialStreamIndex: number;
  playerMeta: PlayerMeta;
  setVideo: (
    url: string,
    streams?: any[],
    index?: number,
    meta?: PlayerMeta,
  ) => void;
  closeMiniPlayer: () => void;
};

export const usePlayerStore = create<PlayerState>()((set) => ({
  currentVideoUrl: "",
  streams: [],
  initialStreamIndex: 0,
  playerMeta: null,
  setVideo: (url, streams = [], index = 0, meta = null) =>
    set({
      currentVideoUrl: url,
      streams,
      initialStreamIndex: index,
      playerMeta: meta,
    }),
  closeMiniPlayer: () =>
    set({
      currentVideoUrl: "",
      streams: [],
      initialStreamIndex: 0,
      playerMeta: null,
    }),
}));
