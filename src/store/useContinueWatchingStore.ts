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

export type ContinueWatchingItem = {
  link: string;
  title: string;
  image?: string;
  providerId: string;
  type?: string;
  position: number;
  duration: number;
  updatedAt: number;
};

const MAX_ITEMS = 20;
const MAX_DISMISSED = 100;

type ContinueWatchingState = {
  items: ContinueWatchingItem[];
  // Links the user explicitly dismissed with the × button. Persisted so a
  // dismissed title does not reappear the next time playback progress saves.
  dismissed: string[];
  upsert: (item: Omit<ContinueWatchingItem, "updatedAt">) => void;
  remove: (link: string) => void;
  restore: (link: string) => void;
};

export const useContinueWatchingStore = create<ContinueWatchingState>()(
  persist(
    (set) => ({
      items: [],
      dismissed: [],

      upsert: (item) =>
        set((state) => {
          if (state.dismissed.includes(item.link)) return state;
          const rest = state.items.filter((i) => i.link !== item.link);
          const next = [{ ...item, updatedAt: Date.now() }, ...rest];
          return { items: next.slice(0, MAX_ITEMS) };
        }),

      remove: (link) =>
        set((state) => ({
          items: state.items.filter((i) => i.link !== link),
          dismissed: state.dismissed.includes(link)
            ? state.dismissed
            : [...state.dismissed, link].slice(-MAX_DISMISSED),
        })),

      restore: (link) =>
        set((state) => ({
          dismissed: state.dismissed.filter((l) => l !== link),
        })),
    }),
    {
      name: "k45-continue-watching-storage",
      storage: createJSONStorage(() => zustandMMKVStorage),
    },
  ),
);
