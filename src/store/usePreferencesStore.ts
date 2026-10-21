import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createMMKV } from "react-native-mmkv";
import type {
  SubtitleAlign,
  SubtitleFont,
  SubtitleWeight,
} from "@/lib/subtitles";

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

export type DefaultQuality = "auto" | "highest" | "lowest";
export type DownloadQuality = "best" | "smallest";
export type DownloadLocation = "app" | "custom";

export type Preferences = {
  resumePlayback: boolean;
  defaultQuality: DefaultQuality;
  autoSubtitles: boolean;
  subtitleLanguage: string;
  subtitleSize: number;
  subtitleFont: SubtitleFont;
  subtitleWeight: SubtitleWeight;
  subtitleColor: string;
  subtitleBackground: string;
  subtitleBackgroundOpacity: number;
  subtitleShadow: number;
  subtitleBottom: number;
  subtitleAlign: SubtitleAlign;
  controlsTimeout: 3 | 5 | 10;
  showRemainingTime: boolean;
  downloadQuality: DownloadQuality;
  downloadLocation: DownloadLocation;
  downloadDirectoryUri: string | null;
  wifiOnlyDownloads: boolean;
};

const DEFAULT_PREFERENCES: Preferences = {
  resumePlayback: true,
  defaultQuality: "auto",
  autoSubtitles: false,
  subtitleLanguage: "auto",
  subtitleSize: 16,
  subtitleFont: "system",
  subtitleWeight: "600",
  subtitleColor: "#FFFFFF",
  subtitleBackground: "#000000",
  subtitleBackgroundOpacity: 0.55,
  subtitleShadow: 2,
  subtitleBottom: 36,
  subtitleAlign: "center",
  controlsTimeout: 5,
  showRemainingTime: true,
  downloadQuality: "best",
  downloadLocation: "app",
  downloadDirectoryUri: null,
  wifiOnlyDownloads: false,
};

export type SubtitleAppearance = Pick<
  Preferences,
  | "subtitleSize"
  | "subtitleFont"
  | "subtitleWeight"
  | "subtitleColor"
  | "subtitleBackground"
  | "subtitleBackgroundOpacity"
  | "subtitleShadow"
  | "subtitleBottom"
  | "subtitleAlign"
>;

type PreferencesState = Preferences & {
  setPreference: <K extends keyof Preferences>(
    key: K,
    value: Preferences[K],
  ) => void;
  resetPreferences: () => void;
  resetSubtitleStyle: () => void;
};

const SUBTITLE_FONT_VALUES: SubtitleFont[] = [
  "system",
  "serif",
  "monospace",
  "rounded",
];
const SUBTITLE_WEIGHT_VALUES: SubtitleWeight[] = ["400", "600", "800"];
const SUBTITLE_ALIGN_VALUES: SubtitleAlign[] = ["left", "center", "right"];
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

const normalize = (saved: Partial<Preferences>): Preferences => {
  const subtitleSize = Number(saved.subtitleSize);
  const controlsTimeout = Number(saved.controlsTimeout);
  const backgroundOpacity = Number(saved.subtitleBackgroundOpacity);
  const shadow = Number(saved.subtitleShadow);
  const bottom = Number(saved.subtitleBottom);
  return {
    ...DEFAULT_PREFERENCES,
    ...saved,
    subtitleSize:
      Number.isFinite(subtitleSize) && subtitleSize >= 10 && subtitleSize <= 40
        ? Math.round(subtitleSize)
        : DEFAULT_PREFERENCES.subtitleSize,
    subtitleLanguage:
      typeof saved.subtitleLanguage === "string" &&
      /^(auto|[a-z]{2,3})$/i.test(saved.subtitleLanguage)
        ? saved.subtitleLanguage.toLowerCase()
        : DEFAULT_PREFERENCES.subtitleLanguage,
    subtitleFont: SUBTITLE_FONT_VALUES.includes(saved.subtitleFont as any)
      ? (saved.subtitleFont as SubtitleFont)
      : DEFAULT_PREFERENCES.subtitleFont,
    subtitleWeight: SUBTITLE_WEIGHT_VALUES.includes(saved.subtitleWeight as any)
      ? (saved.subtitleWeight as SubtitleWeight)
      : DEFAULT_PREFERENCES.subtitleWeight,
    subtitleColor:
      typeof saved.subtitleColor === "string" &&
      HEX_COLOR.test(saved.subtitleColor)
        ? saved.subtitleColor
        : DEFAULT_PREFERENCES.subtitleColor,
    subtitleBackground:
      typeof saved.subtitleBackground === "string" &&
      HEX_COLOR.test(saved.subtitleBackground)
        ? saved.subtitleBackground
        : DEFAULT_PREFERENCES.subtitleBackground,
    subtitleBackgroundOpacity:
      Number.isFinite(backgroundOpacity) &&
      backgroundOpacity >= 0 &&
      backgroundOpacity <= 1
        ? backgroundOpacity
        : DEFAULT_PREFERENCES.subtitleBackgroundOpacity,
    subtitleShadow:
      Number.isFinite(shadow) && [0, 2, 4].includes(Math.round(shadow))
        ? Math.round(shadow)
        : DEFAULT_PREFERENCES.subtitleShadow,
    subtitleBottom:
      Number.isFinite(bottom) && bottom >= 8 && bottom <= 160
        ? Math.round(bottom)
        : DEFAULT_PREFERENCES.subtitleBottom,
    subtitleAlign: SUBTITLE_ALIGN_VALUES.includes(saved.subtitleAlign as any)
      ? (saved.subtitleAlign as SubtitleAlign)
      : DEFAULT_PREFERENCES.subtitleAlign,
    controlsTimeout: [3, 5, 10].includes(controlsTimeout)
      ? (controlsTimeout as 3 | 5 | 10)
      : DEFAULT_PREFERENCES.controlsTimeout,
    downloadLocation:
      saved.downloadLocation === "custom" &&
      !!saved.downloadDirectoryUri
        ? "custom"
        : "app",
  };
};

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      ...DEFAULT_PREFERENCES,
      setPreference: (key, value) => set({ [key]: value } as any),
      resetPreferences: () => set({ ...DEFAULT_PREFERENCES }),
      resetSubtitleStyle: () =>
        set({
          subtitleSize: DEFAULT_PREFERENCES.subtitleSize,
          subtitleFont: DEFAULT_PREFERENCES.subtitleFont,
          subtitleWeight: DEFAULT_PREFERENCES.subtitleWeight,
          subtitleColor: DEFAULT_PREFERENCES.subtitleColor,
          subtitleBackground: DEFAULT_PREFERENCES.subtitleBackground,
          subtitleBackgroundOpacity:
            DEFAULT_PREFERENCES.subtitleBackgroundOpacity,
          subtitleShadow: DEFAULT_PREFERENCES.subtitleShadow,
          subtitleBottom: DEFAULT_PREFERENCES.subtitleBottom,
          subtitleAlign: DEFAULT_PREFERENCES.subtitleAlign,
        }),
    }),
    {
      name: "k45-preferences-storage",
      storage: createJSONStorage(() => zustandMMKVStorage),
      merge: (persisted, current) => ({
        ...current,
        ...normalize((persisted as Partial<Preferences>) || {}),
      }),
    },
  ),
);
