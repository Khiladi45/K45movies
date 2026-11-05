import { create } from "zustand";
import type { YtVideo } from "./types";

type MiniState = {
  /** The video shown in the floating mini player, or null when it is closed. */
  mini: { video: YtVideo; position: number } | null;
  setMini: (video: YtVideo, position: number) => void;
  clearMini: () => void;
};

export const useYtPlayerStore = create<MiniState>((set) => ({
  mini: null,
  setMini: (video, position) => set({ mini: { video, position } }),
  clearMini: () => set({ mini: null }),
}));

type UiState = {
  menuFor: YtVideo | null;
  downloadFor: YtVideo | null;
  openMenu: (video: YtVideo) => void;
  closeMenu: () => void;
  openDownload: (video: YtVideo) => void;
  closeDownload: () => void;
};

/** Which sheet is open. One host component renders them for every screen. */
export const useYtUiStore = create<UiState>((set) => ({
  menuFor: null,
  downloadFor: null,
  openMenu: (menuFor) => set({ menuFor }),
  closeMenu: () => set({ menuFor: null }),
  openDownload: (downloadFor) => set({ downloadFor, menuFor: null }),
  closeDownload: () => set({ downloadFor: null }),
}));

type ToastState = {
  message: string;
  id: number;
  show: (message: string) => void;
};

export const useYtToastStore = create<ToastState>((set) => ({
  message: "",
  id: 0,
  show: (message) => set((s) => ({ message, id: s.id + 1 })),
}));
