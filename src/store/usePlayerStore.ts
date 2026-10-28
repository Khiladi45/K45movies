import { create } from "zustand";

export type PlayerEpisode = {
  title: string;
  link: string;
  type?: string;
  number: number | null;
};

// One entry of the details-page quality dropdown. A series quality carries its
// own episode list (episodesLink or directLinks); a movie quality is one link.
export type PlayerQuality = {
  label: string;
  episodesLink?: string;
  directLinks?: PlayerEpisode[];
};

export type PlayerMeta = {
  title?: string;
  episode?: string;
  poster?: string;
  link?: string;
  providerId?: string;
  type?: string;
  image?: string;
  isSeries?: boolean;
  qualities?: PlayerQuality[];
  qualityIndex?: number;
  // Episodes of the currently playing quality, and the current episode.
  episodes?: PlayerEpisode[];
  episodeNumber?: number | null;
  // Movies: which link inside the quality entry is playing.
  linkIndex?: number;
  // Seconds to resume from after a quality switch.
  resumeAt?: number;
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
