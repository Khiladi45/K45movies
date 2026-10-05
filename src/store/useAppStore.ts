import { create } from "zustand";

interface AppState {
  isDarkMode: boolean;
  activeProviderId: string | null;

  toggleTheme: () => void;
  setActiveProvider: (id: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  isDarkMode: true,
  activeProviderId: null,

  toggleTheme: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
  setActiveProvider: (id) => set({ activeProviderId: id }),
}));
