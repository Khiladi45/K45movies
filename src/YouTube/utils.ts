import { Platform, Share, StatusBar } from "react-native";
import { useYtToastStore } from "./playerStore";

/** Shows the dark logo toast (see components/YtToast). */
export const notify = (message: string) => useYtToastStore.getState().show(message);

export const shareVideo = async (video: { title: string; link: string }) => {
  try {
    await Share.share({ message: `${video.title}\n${video.link}` });
  } catch {
    // The user dismissing the sheet is not an error.
  }
};

/** 83 -> "1:23", 3725 -> "1:02:05". */
export const formatClock = (seconds: number): string => {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
};

/** Hides the status and navigation bars (fullscreen) or brings them back. */
export const setImmersive = (on: boolean) => {
  try {
    StatusBar.setHidden(on, "fade");
  } catch {}
  if (Platform.OS !== "android") return;
  try {
    const NavigationBar = require("expo-navigation-bar");
    if (typeof NavigationBar.setVisibilityAsync === "function") {
      Promise.resolve(NavigationBar.setVisibilityAsync(on ? "hidden" : "visible")).catch(() => {});
    }
  } catch {}
};

/** Locks landscape (fullscreen) or portrait. Safe when the module is missing. */
export const lockOrientation = (landscape: boolean) => {
  try {
    const SO = require("expo-screen-orientation");
    SO.lockAsync(
      landscape ? SO.OrientationLock.LANDSCAPE : SO.OrientationLock.PORTRAIT_UP,
    ).catch(() => {});
  } catch {}
};

export const unlockOrientation = () => {
  try {
    require("expo-screen-orientation").unlockAsync().catch(() => {});
  } catch {}
};

// ---- brightness / volume (fullscreen swipe gestures) ----------------------

let Brightness: any = null;
let VolumeManager: any = null;
try {
  Brightness = require("expo-brightness");
} catch {}
try {
  VolumeManager = require("react-native-volume-manager").VolumeManager;
} catch {}

let brightnessTouched = false;

export const getBrightness = async (): Promise<number> => {
  try {
    const v = await Brightness?.getBrightnessAsync?.();
    return typeof v === "number" ? v : 0.5;
  } catch {
    return 0.5;
  }
};

export const setBrightness = (value: number) => {
  brightnessTouched = true;
  try {
    Brightness?.setBrightnessAsync?.(value)?.catch?.(() => {});
  } catch {}
};

/** Hands brightness back to the system after the player closes. */
export const restoreBrightness = () => {
  if (!brightnessTouched) return;
  brightnessTouched = false;
  try {
    Brightness?.restoreSystemBrightnessAsync?.()?.catch?.(() => {});
  } catch {}
};

export const getVolume = async (): Promise<number> => {
  try {
    const v = await VolumeManager?.getVolume?.();
    const n = typeof v === "number" ? v : v?.volume;
    return typeof n === "number" ? n : 0.5;
  } catch {
    return 0.5;
  }
};

export const setVolume = (value: number) => {
  try {
    VolumeManager?.setVolume?.(value, { showUI: false });
  } catch {}
};
