import React from "react";
import TvShell from "./TvShell";
import TvComingSoon from "./TvComingSoon";
import TvYtHomeScreen from "../youtube/TvYtHomeScreen";
import type { TvRailItem } from "./TvSideRail";
import TvSettingsScreen from "../screens/TvSettingsScreen";

export type YouTubeSection = "home" | "search" | "shorts" | "watchlist" | "settings";

export const YOUTUBE_RAIL: TvRailItem<YouTubeSection>[] = [
  { key: "home", label: "Home", icon: "home" },
  { key: "search", label: "Search", icon: "search" },
  { key: "shorts", label: "Shorts", icon: "flash" },
  { key: "watchlist", label: "Watchlist", icon: "bookmark" },
  { key: "settings", label: "Settings", icon: "settings" },
];

/** YouTube layout on TV (Phase 1: shell; screens arrive in Phase 3). */
export default function YouTubeShell() {
  return (
    <TvShell<YouTubeSection>
      items={YOUTUBE_RAIL}
      home="home"
      renderSection={(section) => {
        switch (section) {
          case "home":
            return <TvYtHomeScreen />;
          case "search":
            return <TvComingSoon title="Search" icon="search" />;
          case "shorts":
            return <TvComingSoon title="Shorts" icon="flash" />;
          case "watchlist":
            return <TvComingSoon title="Watchlist" icon="bookmark" />;
          case "settings":
            return <TvSettingsScreen />;
        }
      }}
    />
  );
}
