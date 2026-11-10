import React, { type RefObject } from "react";
import { StyleSheet, Text, TVFocusGuideView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeStore } from "@/store/useThemeStore";
import Focusable from "./Focusable";
import { TV } from "../theme";

export type TvSection = "home" | "search" | "mylist" | "settings";

const ITEMS: { key: TvSection; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "home", label: "Home", icon: "home" },
  { key: "search", label: "Search", icon: "search" },
  { key: "mylist", label: "My List", icon: "bookmark" },
  { key: "settings", label: "Settings", icon: "settings" },
];

/**
 * Left rail. Wrapped in a focus guide so pressing Left from anywhere in the
 * content lands here, and Right goes back into the content.
 */
export default function SideNav({
  section,
  onSelect,
  activeRef,
}: {
  section: TvSection;
  onSelect: (section: TvSection) => void;
  /** Attached to the active item, used as the focus fallback. */
  activeRef?: RefObject<View | null>;
}) {
  const primaryColor = useThemeStore((s) => s.primaryColor);
  return (
    <TVFocusGuideView autoFocus style={styles.rail}>
      <Text style={[styles.logo, { color: primaryColor }]}>K45</Text>
      <View style={styles.items}>
        {ITEMS.map((item) => {
          const active = item.key === section;
          return (
            <Focusable
              key={item.key}
              ref={active ? activeRef : undefined}
              style={styles.item}
              onPress={() => onSelect(item.key)}
              accessibilityLabel={item.label}
            >
              {(focused) => (
                <>
                  <Ionicons
                    name={active ? item.icon : (`${item.icon}-outline` as any)}
                    size={22}
                    color={active || focused ? "#fff" : TV.muted}
                  />
                  {focused ? <Text style={styles.label}>{item.label}</Text> : null}
                </>
              )}
            </Focusable>
          );
        })}
      </View>
    </TVFocusGuideView>
  );
}

const styles = StyleSheet.create({
  rail: {
    width: TV.navWidth,
    paddingTop: TV.safeY,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  logo: { fontSize: 16, fontWeight: "900", marginBottom: 24 },
  items: { gap: 10, alignItems: "center" },
  item: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    position: "absolute",
    left: 54,
    color: "#fff",
    fontSize: TV.text.small,
    fontWeight: "700",
    backgroundColor: "rgba(0,0,0,0.85)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
});
