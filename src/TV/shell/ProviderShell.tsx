import React from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import TvShell from "./TvShell";
import TvProviderHomeScreen from "../provider/TvProviderHomeScreen";
import TvProviderSearchScreen from "../provider/TvProviderSearchScreen";
import TvProviderWatchlistScreen from "../provider/TvProviderWatchlistScreen";
import type { TvRailItem } from "./TvSideRail";
import TvSettingsScreen, { ProvidersBlock } from "../screens/TvSettingsScreen";
import { TV } from "../theme";

export type ProviderSection = "home" | "search" | "watchlist" | "providers" | "settings";

export const PROVIDER_RAIL: TvRailItem<ProviderSection>[] = [
  { key: "home", label: "Home", icon: "home" },
  { key: "search", label: "Search", icon: "search" },
  { key: "watchlist", label: "Watchlist", icon: "bookmark" },
  { key: "providers", label: "Providers", icon: "extension-puzzle" },
  { key: "settings", label: "Settings", icon: "settings" },
];

/** Providers section: the same install/remove block as Settings, full page. */
function ProvidersSection() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Providers</Text>
      <ProvidersBlock />
    </ScrollView>
  );
}

/** Provider Based layout on TV (Home since Phase 2a; other screens follow). */
export default function ProviderShell() {
  return (
    <TvShell<ProviderSection>
      items={PROVIDER_RAIL}
      home="home"
      renderSection={(section) => {
        switch (section) {
          case "home":
            return <TvProviderHomeScreen />;
          case "search":
            return <TvProviderSearchScreen />;
          case "watchlist":
            return <TvProviderWatchlistScreen />;
          case "providers":
            return <ProvidersSection />;
          case "settings":
            return <TvSettingsScreen />;
        }
      }}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: TV.bg },
  content: { paddingTop: TV.safeY + 8, paddingHorizontal: TV.safeX, paddingBottom: 40 },
  title: { color: "#fff", fontSize: TV.text.title, fontWeight: "800", marginBottom: 14 },
});
