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

type ThemeState = {
  primaryColor: string;
  setPrimaryColor: (color: string) => void;
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      primaryColor: "#8B5CF6",

      setPrimaryColor: (color) => set({ primaryColor: color }),
    }),
    {
      name: "k45-theme-storage",
      storage: createJSONStorage(() => zustandMMKVStorage),
    },
  ),
);
