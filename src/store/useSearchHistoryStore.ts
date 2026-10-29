import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createMMKV } from "react-native-mmkv";

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

const MAX_HISTORY = 12;

type SearchHistoryState = {
  history: string[];
  addSearch: (term: string) => void;
  removeSearch: (term: string) => void;
  clearHistory: () => void;
};

export const useSearchHistoryStore = create<SearchHistoryState>()(
  persist(
    (set) => ({
      history: [],

      addSearch: (term) =>
        set((state) => {
          const trimmed = term.trim();
          if (!trimmed) return state;
          return {
            history: [
              trimmed,
              ...state.history.filter((item) => item.toLowerCase() !== trimmed.toLowerCase()),
            ].slice(0, MAX_HISTORY),
          };
        }),

      removeSearch: (term) =>
        set((state) => ({
          history: state.history.filter((item) => item !== term),
        })),

      clearHistory: () => set({ history: [] }),
    }),
    {
      name: "k45-search-history",
      storage: createJSONStorage(() => zustandMMKVStorage),
    },
  ),
);
