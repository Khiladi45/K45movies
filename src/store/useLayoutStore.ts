import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createMMKV } from "react-native-mmkv";
import { NO_LANGUAGE } from "@/lib/languages";

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

export type AppLayout = "provider" | "movie";

type LayoutState = {
  // "provider" is the original app behaviour and the default. "movie" turns on
  // the TMDB-driven layout; nothing in the provider flow reads this value
  // except the small gate components that pick which screen to render.
  layout: AppLayout;
  // ISO 639-1 audio language used to sort qualities in the Movie Based layout,
  // or "none".
  preferredLanguage: string;
  setLayout: (layout: AppLayout) => void;
  setPreferredLanguage: (code: string) => void;
};

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      layout: "provider",
      preferredLanguage: NO_LANGUAGE,
      setLayout: (layout) => set({ layout }),
      setPreferredLanguage: (preferredLanguage) => set({ preferredLanguage }),
    }),
    {
      name: "k45-layout-storage",
      storage: createJSONStorage(() => zustandMMKVStorage),
      merge: (persisted, current) => {
        const saved = (persisted as Partial<LayoutState>) || {};
        return {
          ...current,
          layout: saved.layout === "movie" ? "movie" : "provider",
          preferredLanguage:
            typeof saved.preferredLanguage === "string" &&
            saved.preferredLanguage
              ? saved.preferredLanguage
              : NO_LANGUAGE,
        };
      },
    },
  ),
);

/** Non-hook read for code that runs outside React (playback helpers). */
export const getPreferredLanguage = (): string | null => {
  const code = useLayoutStore.getState().preferredLanguage;
  return code && code !== NO_LANGUAGE ? code : null;
};
