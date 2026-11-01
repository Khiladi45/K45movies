import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createMMKV } from "react-native-mmkv";
import type { TmdbMediaType } from "@/lib/tmdbApi";

const mmkv = createMMKV();

const zustandMMKVStorage = {
  setItem: (name: string, value: string) => {
    mmkv.set(name, value);
  },
  getItem: (name: string) => {
    return mmkv.getString(name) ?? null;
  },
  removeItem: (name: string) => {
    mmkv.remove(name);
  },
};

export type TmdbWatchlistItem = {
  key: string;
  id: number;
  mediaType: TmdbMediaType;
  title: string;
  // TMDB poster path (not a full URL), so image size is chosen at render time.
  poster: string | null;
  year?: string;
  addedAt: number;
};

export const tmdbKey = (mediaType: TmdbMediaType, id: number) =>
  `${mediaType}:${id}`;

type State = {
  items: TmdbWatchlistItem[];
  has: (mediaType: TmdbMediaType, id: number) => boolean;
  toggle: (item: Omit<TmdbWatchlistItem, "key" | "addedAt">) => void;
  remove: (key: string) => void;
};

// Separate from the provider watchlist (useWatchlistStore) so the two layouts
// never see each other's entries.
export const useTmdbWatchlistStore = create<State>()(
  persist(
    (set, get) => ({
      items: [],
      has: (mediaType, id) =>
        get().items.some((item) => item.key === tmdbKey(mediaType, id)),
      toggle: (item) =>
        set((state) => {
          const key = tmdbKey(item.mediaType, item.id);
          if (state.items.some((existing) => existing.key === key)) {
            return { items: state.items.filter((existing) => existing.key !== key) };
          }
          return { items: [{ ...item, key, addedAt: Date.now() }, ...state.items] };
        }),
      remove: (key) =>
        set((state) => ({ items: state.items.filter((item) => item.key !== key) })),
    }),
    {
      name: "k45-tmdb-watchlist-storage",
      storage: createJSONStorage(() => zustandMMKVStorage),
    },
  ),
);
