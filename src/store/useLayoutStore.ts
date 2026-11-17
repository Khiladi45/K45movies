import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createMMKV } from "react-native-mmkv";
import { NO_LANGUAGE } from "@/lib/languages";
import {
  PHONE_DEFAULT_LAYOUT,
  TV_DEFAULT_LAYOUT,
  resolveLayout,
} from "@/lib/tvLayout";
import { IS_TV } from "@/TV/isTV";

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

export type AppLayout = "provider" | "movie" | "youtube";

type LayoutState = {
  // "provider" is the original app behaviour and the default. "movie" turns on
  // the TMDB-driven layout; "youtube" swaps the whole tab bar and screens for
  // the YouTube-style layout (see src/YouTube). Nothing in the provider flow
  // reads this value except the small gate components and the tab switch.
  layout: AppLayout;
  // ISO 639-1 audio language used to sort qualities in the Movie Based layout,
  // or "none".
  preferredLanguage: string;
  // Language code → provider id searched first and listed first (highest
  // quality first) when that language is the preferred one.
  priorityProviders: Record<string, string>;
  // Android TV only: true once a layout was picked on the TV. Until then the
  // TV shows the Movie Based layout (see src/lib/tvLayout.ts). Unused on phones.
  tvLayoutChosen?: boolean;
  setLayout: (layout: AppLayout) => void;
  setPreferredLanguage: (code: string) => void;
  setPriorityProvider: (language: string, providerId: string | null) => void;
};

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      layout: IS_TV ? TV_DEFAULT_LAYOUT : PHONE_DEFAULT_LAYOUT,
      preferredLanguage: NO_LANGUAGE,
      priorityProviders: {},
      setLayout: (layout) =>
        set(IS_TV ? { layout, tvLayoutChosen: true } : { layout }),
      setPreferredLanguage: (preferredLanguage) => set({ preferredLanguage }),
      setPriorityProvider: (language, providerId) =>
        set((state) => {
          const next = { ...state.priorityProviders };
          if (providerId) next[language] = providerId;
          else delete next[language];
          return { priorityProviders: next };
        }),
    }),
    {
      name: "k45-layout-storage",
      storage: createJSONStorage(() => zustandMMKVStorage),
      merge: (persisted, current) => {
        const saved = (persisted as Partial<LayoutState>) || {};
        return {
          ...current,
          layout: resolveLayout(saved, IS_TV),
          ...(IS_TV ? { tvLayoutChosen: saved.tvLayoutChosen === true } : {}),
          preferredLanguage:
            typeof saved.preferredLanguage === "string" &&
            saved.preferredLanguage
              ? saved.preferredLanguage
              : NO_LANGUAGE,
          priorityProviders:
            saved.priorityProviders && typeof saved.priorityProviders === "object"
              ? Object.fromEntries(
                  Object.entries(saved.priorityProviders).filter(
                    ([lang, id]) => typeof lang === "string" && typeof id === "string" && id,
                  ),
                )
              : {},
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

/** Provider to search and list first for a language, if the user chose one. */
export const priorityProviderFor = (
  priorityProviders: Record<string, string>,
  language: string | null | undefined,
): string | null =>
  language && language !== NO_LANGUAGE ? priorityProviders[language] || null : null;
