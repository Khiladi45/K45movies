import React, { type RefObject } from "react";
import { StyleSheet, Text, TVFocusGuideView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeStore } from "@/store/useThemeStore";
import Focusable from "../components/Focusable";
import { TV } from "../theme";

export type TvRailItem<K extends string = string> = {
  key: K;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

/**
 * Left rail for the Provider Based and YouTube TV shells. Same look and focus
 * behaviour as the Movie layout's SideNav (which stays unchanged), but the
 * items come in as a prop. The active item takes first focus when the shell
 * mounts, e.g. right after switching layout.
 */
export default function TvSideRail<K extends string>({
  items,
  active,
  onSelect,
  activeRef,
}: {
  items: TvRailItem<K>[];
  active: K;
  onSelect: (key: K) => void;
  /** Attached to the active item, used as the focus fallback. */
  activeRef?: RefObject<View | null>;
}) {
  const primaryColor = useThemeStore((s) => s.primaryColor);
  return (
    <TVFocusGuideView autoFocus style={styles.rail}>
      <Text style={[styles.logo, { color: primaryColor }]}>K45</Text>
      <View style={styles.items}>
        {items.map((item) => {
          const isActive = item.key === active;
          return (
            <Focusable
              key={item.key}
              ref={isActive ? activeRef : undefined}
              hasTVPreferredFocus={isActive}
              style={styles.item}
              onPress={() => onSelect(item.key)}
              accessibilityLabel={item.label}
            >
              {(focused) => (
                <>
                  <Ionicons
                    name={isActive ? item.icon : (`${item.icon}-outline` as any)}
                    size={22}
                    color={isActive || focused ? "#fff" : TV.muted}
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
  item: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
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
