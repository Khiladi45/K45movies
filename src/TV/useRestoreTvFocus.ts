import { useEffect, useRef, type RefObject } from "react";
import type { View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { forgetFocus, recallFocus, requestFocus } from "./focusMemory";

/**
 * When this TV screen becomes visible again (back from the player or another
 * page), put remote focus back on the control it was on, or on `fallback`.
 * Without this Android can come back with nothing focused, and then only the
 * Back key works.
 */
export function useRestoreTvFocus(fallback?: RefObject<View | null>) {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const firstVisit = useRef(true);
  const fallbackRef = useRef(fallback);
  fallbackRef.current = fallback;

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      if (firstVisit.current) {
        firstVisit.current = false;
        return;
      }
      // Let the screen finish its transition before moving focus.
      setTimeout(() => {
        if (!requestFocus(recallFocus(route.key))) requestFocus(fallbackRef.current);
      }, 120);
    });
    return unsubscribe;
  }, [navigation, route.key]);

  useEffect(() => () => forgetFocus(route.key), [route.key]);
}
