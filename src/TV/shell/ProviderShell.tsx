import React from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import TvShell from "./TvShell";
import TvComingSoon from "./TvComingSoon";
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

/** Provider Based layout on TV (Phase 1: shell; screens arrive in Phase 2). */
export default function ProviderShell() {
  return (
    <TvShell<ProviderSection>
      items={PROVIDER_RAIL}
      home="home"
      renderSection={(section) => {
        switch (section) {
          case "home":
            return <TvComingSoon title="Provider Based Home" icon="home" />;
          case "search":
            return <TvComingSoon title="Search" icon="search" />;
          case "watchlist":
            return <TvComingSoon title="Watchlist" icon="bookmark" />;
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
