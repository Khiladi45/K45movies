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

export type TmdbContinueItem = {
  key: string;
  id: number;
  mediaType: TmdbMediaType;
  title: string;
  // TMDB paths (not full URLs).
  poster: string | null;
  backdrop: string | null;
  season?: number;
  episode?: number;
  episodeTitle?: string;
  position: number;
  duration: number;
  updatedAt: number;
};

const MAX_ITEMS = 20;
const MAX_DISMISSED = 100;

// One entry per title: for a series it is the episode watched last.
export const continueKey = (mediaType: TmdbMediaType, id: number) =>
  `${mediaType}:${id}`;

type State = {
  items: TmdbContinueItem[];
  dismissed: string[];
  upsert: (item: Omit<TmdbContinueItem, "key" | "updatedAt">) => void;
  remove: (key: string) => void;
  // Called when the user starts playing again, so a dismissed title can
  // reappear.
  restore: (key: string) => void;
};

// Separate from useContinueWatchingStore (provider layout).
export const useTmdbContinueWatchingStore = create<State>()(
  persist(
    (set) => ({
      items: [],
      dismissed: [],
      upsert: (item) =>
        set((state) => {
          const key = continueKey(item.mediaType, item.id);
          if (state.dismissed.includes(key)) return state;
          const rest = state.items.filter((existing) => existing.key !== key);
          return {
            items: [{ ...item, key, updatedAt: Date.now() }, ...rest].slice(
              0,
              MAX_ITEMS,
            ),
          };
        }),
      remove: (key) =>
        set((state) => ({
          items: state.items.filter((item) => item.key !== key),
          dismissed: state.dismissed.includes(key)
            ? state.dismissed
            : [...state.dismissed, key].slice(-MAX_DISMISSED),
        })),
      restore: (key) =>
        set((state) => ({
          dismissed: state.dismissed.filter((existing) => existing !== key),
        })),
    }),
    {
      name: "k45-tmdb-continue-watching-storage",
      storage: createJSONStorage(() => zustandMMKVStorage),
    },
  ),
);
