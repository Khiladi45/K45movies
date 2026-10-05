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

type ProviderState = {
  activeProvider: string;
  installedProviders: string[];
  setActiveProvider: (value: string) => void;
  toggleInstall: (value: string) => void;
};

export const useProviderStore = create<ProviderState>()(
  persist(
    (set) => ({
      // Default active and installed provider
      activeProvider: "vega",
      installedProviders: ["vega"],

      setActiveProvider: (value) => set({ activeProvider: value }),

      toggleInstall: (value) =>
        set((state) => {
          const isInstalled = state.installedProviders.includes(value);
          return {
            installedProviders: isInstalled
              ? state.installedProviders.filter((p) => p !== value)
              : [...state.installedProviders, value],
          };
        }),
    }),
    {
      // The unique key used to save this data in MMKV
      name: "k45-provider-storage",

      // Tell Zustand to use our MMKV adapter
      storage: createJSONStorage(() => zustandMMKVStorage),
    },
  ),
);
