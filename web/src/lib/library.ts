import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { PlaybackTarget } from "./playback";
import type { CatalogLayout } from "./appearance";

export const avatars = ["Violet", "Ocean", "Emerald", "Gold", "Rose"] as const;
export type Avatar = typeof avatars[number];
export type Profile = { id: string; name: string; avatar: Avatar; photo?: string };
export type SavedTitle = { href: string; title: string; layout: CatalogLayout; image?: string; note?: string };
export type Progress = SavedTitle & { position: number; duration: number; updatedAt: number; playback?: PlaybackTarget; source?: { server: string; quality?: string }; }
const watchers = ["ta", "te", "ml", "kn", "hi", "en", "ko", "ja"] as const;
export const audioLanguages = ["none", ...watchers] as const;
export type AudioLanguage = typeof audioLanguages[number];

type Library = {
  profiles: Profile[]; activeProfile: string | null; installed: string[]; activeProvider: string | null;
  watchlist: SavedTitle[]; progress: Progress[]; history: string[]; language: AudioLanguage;
  episodeOrder: Record<string, "asc" | "desc">;
  saveProfile: (profile: Omit<Profile, "id">, id?: string) => void;
  selectProfile: (id: string) => void;
  removeProfile: (id: string) => void;
  activate: (id: string) => void;
  removeProvider: (id: string, fallback?: string) => void;
  toggleSaved: (entry: SavedTitle) => void;
  saveProgress: (entry: Progress) => void;
  dismissProgress: (href: string) => void;
  dismissed: string[];
  addSearch: (query: string) => void;
  removeSearch: (query: string) => void;
  clearSearch: () => void;
  setLanguage: (language: AudioLanguage) => void;
  setEpisodeOrder: (key: string, order: "asc" | "desc") => void;
};

export const useLibrary = create<Library>()(
  persist((set) => ({
    profiles: [], activeProfile: null, installed: ["vega"], activeProvider: "vega",
    watchlist: [], progress: [], dismissed: [], history: [], language: "none", episodeOrder: {},
    saveProfile: (profile, id) => set((state) => {
      if (id) return { profiles: state.profiles.map((existing) => existing.id === id ? { ...profile, id } : existing) };
      const next = { ...profile, id: crypto.randomUUID() };
      return { profiles: [...state.profiles, next], activeProfile: state.activeProfile ?? next.id };
    }),
    selectProfile: (id) => set((state) => state.profiles.some((profile) => profile.id === id) ? { activeProfile: id } : state),
    removeProfile: (id) => set((state) => {
      const profiles = state.profiles.filter((profile) => profile.id !== id);
      return { profiles, activeProfile: state.activeProfile === id ? profiles[0]?.id ?? null : state.activeProfile };
    }),
    activate: (id) => set((state) => ({
      activeProvider: id, installed: state.installed.includes(id) ? state.installed : [...state.installed, id],
    })),
    removeProvider: (id, fallback) => set((state) => {
      const installed = state.installed.filter((provider) => provider !== id);
      if (state.activeProvider !== id) return { installed };
      return { activeProvider: installed[0] ?? fallback ?? null, installed: installed.length || !fallback ? installed : [fallback] };
    }),
    toggleSaved: (entry) => set((state) => ({
      watchlist: state.watchlist.some(({ href }) => href === entry.href)
        ? state.watchlist.filter(({ href }) => href !== entry.href) : [entry, ...state.watchlist],
    })),
    saveProgress: (entry) => set((state) => {
      if (!Number.isFinite(entry.position) || entry.position < 10 || state.dismissed.includes(entry.href)) return state;
      const progress = state.progress.filter(({ href }) => href !== entry.href);
      if (entry.duration > 0 && entry.position / entry.duration >= 0.9) return { progress };
      return { progress: [entry, ...progress].slice(0, 40) };
    }),
    dismissProgress: (href) => set((state) => ({
      progress: state.progress.filter((entry) => entry.href !== href),
      dismissed: [...state.dismissed.filter((entry) => entry !== href), href].slice(-100),
    })),
    addSearch: (query) => set((state) => ({ history: [query, ...state.history.filter((term) => term.toLowerCase() !== query.toLowerCase())].slice(0, 20) })),
    removeSearch: (query) => set((state) => ({ history: state.history.filter((term) => term !== query) })),
    clearSearch: () => set({ history: [] }),
    setLanguage: (language) => set({ language }),
    setEpisodeOrder: (key, order) => set((state) => ({ episodeOrder: { ...state.episodeOrder, [key]: order } })),
  }), {
    name: "k45-web-library",
    storage: createJSONStorage(() => localStorage),
    skipHydration: true,
  }),
);
