import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type CatalogLayout = "provider" | "movie";

type Appearance = {
  layout: CatalogLayout;
  sidebarCollapsed: boolean;
  setLayout: (layout: CatalogLayout) => void;
  toggleSidebar: () => void;
};

export const useAppearance = create<Appearance>()(
  persist(
    (set) => ({
      layout: "provider",
      sidebarCollapsed: false,
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
        };
      },
    },
  ),
);
