import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { defaultAccent, isAccent } from "./accents";

export type CatalogLayout = "provider" | "movie";

type Appearance = {
  layout: CatalogLayout;
  sidebarCollapsed: boolean;
  accent: string;
  setAccent: (accent: string) => void;
  setLayout: (layout: CatalogLayout) => void;
  toggleSidebar: () => void;
};

export const useAppearance = create<Appearance>()(
  persist(
    (set) => ({
      layout: "provider",
      sidebarCollapsed: false,
      accent: defaultAccent,
      setAccent: (accent) => { if (isAccent(accent)) set({ accent }); },
      setLayout: (layout) => set({ layout }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
    }),
    {
      name: "k45-web-appearance",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      merge: (saved, current) => {
        const preferences = saved as Partial<Appearance> | null;
        return {
          ...current,
          layout: preferences?.layout === "movie" ? "movie" : "provider",
          sidebarCollapsed: preferences?.sidebarCollapsed === true,
          accent: isAccent(preferences?.accent) ? preferences.accent : defaultAccent,
        };
      },
    },
  ),
);
