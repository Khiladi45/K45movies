import type { RefObject } from "react";
import type { View } from "react-native";

/**
 * Last control the remote was on, per navigation route. When a TV screen is
 * shown again (e.g. after closing the player) focus is put back there;
 * otherwise Android may leave nothing focused and the remote stops working.
 */
const lastFocused = new Map<string, RefObject<View | null>>();

export function rememberFocus(routeKey: string | undefined, ref: RefObject<View | null>) {
  if (routeKey) lastFocused.set(routeKey, ref);
}

export function recallFocus(routeKey: string | undefined): RefObject<View | null> | undefined {
  return routeKey ? lastFocused.get(routeKey) : undefined;
}

export function forgetFocus(routeKey: string | undefined) {
  if (routeKey) lastFocused.delete(routeKey);
}

/** Moves remote focus to a mounted view; false if it is gone. */
export function requestFocus(ref: RefObject<View | null> | undefined): boolean {
  const view = ref?.current as (View & { requestTVFocus?: () => void }) | null | undefined;
  if (!view || typeof view.requestTVFocus !== "function") return false;
  view.requestTVFocus();
  return true;
}
