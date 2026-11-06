import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { YT } from "../theme";

type Item = {
  route: string;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  iconActive: React.ComponentProps<typeof Ionicons>["name"];
};

// The four tabs of the YouTube layout: Home | Shorts | Watchlist | Settings.
// Search is a stack screen opened from the Home header; "Providers" stays
// registered so the layout can always be switched back, but has no button.
const ITEMS: Item[] = [
  { route: "HomeTab", label: "Home", icon: "home-outline", iconActive: "home" },
  { route: "Shorts", label: "Shorts", icon: "film-outline", iconActive: "film" },
  { route: "Watchlist", label: "Watchlist", icon: "bookmark-outline", iconActive: "bookmark" },
  { route: "Profile", label: "Settings", icon: "settings-outline", iconActive: "settings" },
];

export default function YtBottomBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const activeName: string = state.routes[state.index]?.name;
  const onShorts = activeName === "Shorts";

  // The bar is hidden while a Short is playing (full-screen vertical video).
  if (onShorts) return null;

  return (
    <View
      style={[
        styles.bar,
        {
          paddingBottom: insets.bottom,
          backgroundColor: onShorts ? "#000" : YT.bg,
          borderTopColor: onShorts ? "#1a1a1a" : YT.border,
        },
      ]}
    >
      {ITEMS.map((item) => {
        const route = state.routes.find((r: any) => r.name === item.route);
        if (!route) return null;
        const focused = activeName === item.route;
        const color = focused ? "#fff" : YT.muted;
        return (
          <TouchableOpacity
            key={item.route}
            style={styles.tab}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={item.label}
            onPress={() => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(item.route);
              }
            }}
          >
            <Ionicons name={focused ? item.iconActive : item.icon} size={24} color={color} />
            <Text style={[styles.label, { color }]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 6 },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3, minHeight: 50 },
  label: { fontSize: 10 },
});
