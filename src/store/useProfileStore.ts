import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createMMKV } from "react-native-mmkv";

const mmkv = createMMKV();

const zustandMMKVStorage = {
  setItem: (name: string, value: string) => mmkv.set(name, value),
  getItem: (name: string) => mmkv.getString(name) ?? null,
  removeItem: (name: string) => mmkv.remove(name),
};

export type Profile = {
  id: string;
  name: string;
  avatarUri: string;
  isCustom?: boolean;
  createdAt: number;
};

type ProfileState = {
  profiles: Profile[];
  activeProfileId: string | null;
  addProfile: (data: Omit<Profile, "id" | "createdAt">) => Profile;
  updateProfile: (
    id: string,
    data: Partial<Omit<Profile, "id" | "createdAt">>,
  ) => void;
  deleteProfile: (id: string) => void;
  setActiveProfile: (id: string) => void;
  getActiveProfile: () => Profile | null;
};

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      profiles: [],
      activeProfileId: null,

      addProfile: (data) => {
        const newProfile: Profile = {
          ...data,
          id: `profile_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          createdAt: Date.now(),
        };
        set((state) => {
          const profiles = [...state.profiles, newProfile];
          const isFirst = state.profiles.length === 0;
          return {
            profiles,
            activeProfileId: isFirst ? newProfile.id : state.activeProfileId,
          };
        });
        return newProfile;
      },

      updateProfile: (id, data) =>
        set((state) => ({
          profiles: state.profiles.map((p) =>
            p.id === id ? { ...p, ...data } : p,
          ),
        })),

      deleteProfile: (id) =>
        set((state) => {
          const profiles = state.profiles.filter((p) => p.id !== id);
          let activeProfileId = state.activeProfileId;
          if (activeProfileId === id) {
            activeProfileId = profiles[0]?.id || null;
          }
          return { profiles, activeProfileId };
        }),

      setActiveProfile: (id) => set({ activeProfileId: id }),

      getActiveProfile: () => {
        const state = get();
        return (
          state.profiles.find((p) => p.id === state.activeProfileId) || null
        );
      },
    }),
    {
      name: "k45-profile-storage",
      storage: createJSONStorage(() => zustandMMKVStorage),
    },
  ),
);

// Preset superhero/hero avatars from DiceBear (free, no API key)
export const PRESET_AVATARS = [
  "https://api.dicebear.com/7.x/superhero/svg?seed=Hulk&backgroundColor=b6e3f4",
  "https://api.dicebear.com/7.x/superhero/svg?seed=Spider&backgroundColor=ffd5dc",
  "https://api.dicebear.com/7.x/superhero/svg?seed=Iron&backgroundColor=c0aede",
  "https://api.dicebear.com/7.x/superhero/svg?seed=Thor&backgroundColor=d1d4f9",
  "https://api.dicebear.com/7.x/superhero/svg?seed=Bat&backgroundColor=ffdfbf",
  "https://api.dicebear.com/7.x/superhero/svg?seed=Wolf&backgroundColor=b6e3f4",
  "https://api.dicebear.com/7.x/superhero/svg?seed=Lion&backgroundColor=ffd5dc",
  "https://api.dicebear.com/7.x/superhero/svg?seed=Knight&backgroundColor=c0aede",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=hero1&backgroundColor=b6e3f4",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=hero2&backgroundColor=ffd5dc",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=hero3&backgroundColor=c0aede",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=hero4&backgroundColor=d1d4f9",
  "https://api.dicebear.com/7.x/bottts/svg?seed=robot1&backgroundColor=b6e3f4",
  "https://api.dicebear.com/7.x/bottts/svg?seed=robot2&backgroundColor=ffd5dc",
  "https://api.dicebear.com/7.x/lorelei/svg?seed=fantasy1&backgroundColor=c0aede",
  "https://api.dicebear.com/7.x/lorelei/svg?seed=fantasy2&backgroundColor=d1d4f9",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=adv1&backgroundColor=b6e3f4",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=adv2&backgroundColor=ffd5dc",
];
