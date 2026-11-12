import React, { useCallback, useRef, useState, type ReactNode } from "react";
import { Alert, BackHandler, StyleSheet, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import TvSideRail, { type TvRailItem } from "./TvSideRail";
import { useRestoreTvFocus } from "../useRestoreTvFocus";
import { TV } from "../theme";

/**
 * Generic TV shell for the Provider Based and YouTube layouts: side rail +
 * one section at a time. Same rules as the Movie layout's TvMain (which is
 * not changed): Back from another section returns Home, Back on Home asks
 * before exiting, and focus is restored when coming back from a detail page
 * or the player.
 */
export default function TvShell<K extends string>({
  items,
  home,
  renderSection,
}: {
  items: TvRailItem<K>[];
  /** The Home section's key (Back target, initial section). */
  home: K;
  renderSection: (section: K, go: (section: K) => void) => ReactNode;
}) {
  const [section, setSection] = useState<K>(home);
  const activeRef = useRef<View | null>(null);
  useRestoreTvFocus(activeRef);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        if (section !== home) {
          setSection(home);
          return true;
        }
        Alert.alert("Exit K45movies?", undefined, [
          { text: "Cancel", style: "cancel" },
          { text: "Exit", style: "destructive", onPress: () => BackHandler.exitApp() },
        ]);
        return true;
      });
      return () => sub.remove();
    }, [section, home]),
  );

  return (
    <View style={styles.main}>
      <TvSideRail items={items} active={section} onSelect={setSection} activeRef={activeRef} />
      <View style={styles.content}>{renderSection(section, setSection)}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, flexDirection: "row", backgroundColor: TV.bg },
  content: { flex: 1 },
});
