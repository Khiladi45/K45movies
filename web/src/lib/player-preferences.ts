import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type CaptionStyle = {
  size: number; color: string; background: string; opacity: number; delay: number;
  weight: number; bottom: number; align: "left" | "center" | "right"; shadow: 0 | 2 | 4;
  font: "sans-serif" | "serif" | "monospace";
};
export const defaultCaptionStyle: CaptionStyle = {
  size: 16, color: "#ffffff", background: "#000000", opacity: 55, delay: 0,
  weight: 600, bottom: 36, align: "center", shadow: 2, font: "sans-serif",
};

export type PlaybackPreferences = {
  resume: boolean;
  background: boolean;
  autoplay: boolean;
  defaultQuality: "auto" | "highest" | "lowest";
  controlsTimeout: 3 | 5 | 10;
  showRemaining: boolean;
  autoSubtitles: boolean;
  subtitleLanguage: string;
};
const defaults: PlaybackPreferences = {
  resume: true, background: true, autoplay: false, defaultQuality: "auto",
  controlsTimeout: 5, showRemaining: true, autoSubtitles: false, subtitleLanguage: "auto",
};

type PlayerPreferences = PlaybackPreferences & {
  captions: CaptionStyle;
  patch: (style: Partial<CaptionStyle>) => void;
  reset: () => void;
  resetAll: () => void;
  set: <K extends keyof PlaybackPreferences>(key: K, value: PlaybackPreferences[K]) => void;
};

function numeric(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function color(value: unknown, fallback: string) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function hydrateCaptions(value: unknown): CaptionStyle {
  const saved = (value ?? {}) as Record<string, unknown>;
  return {
    size: numeric(saved.size, 16, 12, 42), color: color(saved.color, "#ffffff"),
    background: color(saved.background, "#000000"), opacity: numeric(saved.opacity, 55, 0, 100),
    delay: numeric(saved.delay, 0, -10, 10), bottom: numeric(saved.bottom, 36, 0, 120),
    weight: saved.weight === 400 || saved.weight === 700 ? saved.weight : 600,
    align: saved.align === "left" || saved.align === "right" ? saved.align : "center",
    shadow: saved.shadow === false || saved.shadow === 0 ? 0 : saved.shadow === 4 ? 4 : 2,
    font: saved.font === "serif" || saved.font === "monospace" ? saved.font : "sans-serif",
  };
}

export const usePlayerPreferences = create<PlayerPreferences>()(persist((set) => ({
  ...defaults, captions: defaultCaptionStyle,
  patch: (style) => set((state) => ({ captions: { ...state.captions, ...style } })),
  reset: () => set({ captions: defaultCaptionStyle }),
  resetAll: () => set({ ...defaults, captions: defaultCaptionStyle }),
  set: (key, value) => set({ [key]: value }),
}), {
  name: "k45-web-player-preferences", storage: createJSONStorage(() => localStorage), skipHydration: true,
  merge: (saved, current) => {
    const previous = saved as Partial<PlayerPreferences> | undefined;
    return {
      ...current, captions: hydrateCaptions(previous?.captions),
      resume: previous?.resume !== false, background: previous?.background !== false,
      autoplay: previous?.autoplay === true, autoSubtitles: previous?.autoSubtitles === true,
      showRemaining: previous?.showRemaining !== false,
      controlsTimeout: previous?.controlsTimeout === 3 || previous?.controlsTimeout === 10 ? previous.controlsTimeout : 5,
      defaultQuality: previous?.defaultQuality === "highest" || previous?.defaultQuality === "lowest" ? previous.defaultQuality : "auto",
      subtitleLanguage: typeof previous?.subtitleLanguage === "string" && /^[a-z]{2}$/.test(previous.subtitleLanguage) ? previous.subtitleLanguage : "auto",
    };
  },
}));
