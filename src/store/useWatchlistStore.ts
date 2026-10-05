import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createMMKV } from "react-native-mmkv";

// 1. Initialize MMKV
const mmkv = createMMKV();

// 2. Create the storage adapter for Zustand
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

export type WatchlistMovie = {
  link: string;
  title: string;
  image: string;
  providerId: string;
  type?: string;
  addedAt: number;
};

type WatchlistState = {
  movies: WatchlistMovie[];
  addToWatchlist: (movie: Omit<WatchlistMovie, "addedAt">) => void;
  removeFromWatchlist: (link: string) => void;
  isInWatchlist: (link: string) => boolean;
  toggleWatchlist: (movie: Omit<WatchlistMovie, "addedAt">) => void;
};

export const useWatchlistStore = create<WatchlistState>()(
  persist(
    (set, get) => ({
      movies: [],

      addToWatchlist: (movie) =>
        set((state) => {
          if (state.movies.some((m) => m.link === movie.link)) return state;
          return {
            movies: [{ ...movie, addedAt: Date.now() }, ...state.movies],
          };
        }),

      removeFromWatchlist: (link) =>
        set((state) => ({
          movies: state.movies.filter((m) => m.link !== link),
        })),

      isInWatchlist: (link) => get().movies.some((m) => m.link === link),

      toggleWatchlist: (movie) => {
        const exists = get().movies.some((m) => m.link === movie.link);
        if (exists) {
          get().removeFromWatchlist(movie.link);
        } else {
          get().addToWatchlist(movie);
        }
      },
    }),
    {
      name: "k45-watchlist-storage",
      storage: createJSONStorage(() => zustandMMKVStorage),
    },
  ),
);
