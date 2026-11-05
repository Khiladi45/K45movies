import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createMMKV } from "react-native-mmkv";
import type { YtVideo } from "./types";

const mmkv = createMMKV();
const storage = {
  setItem: (name: string, value: string) => {
    mmkv.set(name, value);
  },
  getItem: (name: string) => mmkv.getString(name) ?? null,
  removeItem: (name: string) => {
    mmkv.remove(name);
  },
};

export type SavedVideo = YtVideo & { addedAt: number };

type LibraryState = {
  saved: SavedVideo[];
  isSaved: (id: string) => boolean;
  toggleSaved: (video: YtVideo) => boolean;
  removeSaved: (id: string) => void;
};

/** Videos saved from the YouTube layout. Separate from the movie watchlist. */
export const useYtLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => ({
      saved: [],
      isSaved: (id) => get().saved.some((v) => v.id === id),
      toggleSaved: (video) => {
        const exists = get().saved.some((v) => v.id === video.id);
        set((state) => ({
          saved: exists
            ? state.saved.filter((v) => v.id !== video.id)
            : [{ ...video, addedAt: Date.now() }, ...state.saved],
        }));
        return !exists;
      },
      removeSaved: (id) =>
        set((state) => ({ saved: state.saved.filter((v) => v.id !== id) })),
    }),
    { name: "k45-yt-library", storage: createJSONStorage(() => storage) },
  ),
);

export type RecentSearch = { term: string; image?: string };
const MAX_RECENT = 15;

type RecentState = {
  recent: RecentSearch[];
  addSearch: (term: string, image?: string) => void;
  removeSearch: (term: string) => void;
  clearSearches: () => void;
};

/** Recent searches, each with a thumbnail from its first result. */
export const useYtSearchStore = create<RecentState>()(
  persist(
    (set) => ({
      recent: [],
      addSearch: (term, image) =>
        set((state) => {
          const trimmed = term.trim();
          if (!trimmed) return state;
          const previous = state.recent.find(
            (r) => r.term.toLowerCase() === trimmed.toLowerCase(),
          );
          return {
            recent: [
              { term: trimmed, image: image || previous?.image },
              ...state.recent.filter(
                (r) => r.term.toLowerCase() !== trimmed.toLowerCase(),
              ),
            ].slice(0, MAX_RECENT),
          };
        }),
      removeSearch: (term) =>
        set((state) => ({ recent: state.recent.filter((r) => r.term !== term) })),
      clearSearches: () => set({ recent: [] }),
    }),
    { name: "k45-yt-recent-searches", storage: createJSONStorage(() => storage) },
  ),
);

type HiddenState = {
  videos: string[];
  channels: string[];
  hideVideo: (id: string) => void;
  hideChannel: (name: string) => void;
  isHidden: (video: { id: string; channelName: string }) => boolean;
};

/** "Not interested" choices from the 3-dot menu. */
export const useYtHiddenStore = create<HiddenState>()(
  persist(
    (set, get) => ({
      videos: [],
      channels: [],
      hideVideo: (id) =>
        set((s) => (s.videos.includes(id) ? s : { videos: [id, ...s.videos].slice(0, 500) })),
      hideChannel: (name) =>
        set((s) => (s.channels.includes(name) ? s : { channels: [name, ...s.channels].slice(0, 200) })),
      isHidden: (v) =>
        get().videos.includes(v.id) || (!!v.channelName && get().channels.includes(v.channelName)),
    }),
    { name: "k45-yt-hidden", storage: createJSONStorage(() => storage) },
  ),
);
