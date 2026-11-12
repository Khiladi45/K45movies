import React from "react";
import TvShell from "./TvShell";
import TvYtHomeScreen from "../youtube/TvYtHomeScreen";
import TvYtSearchScreen from "../youtube/TvYtSearchScreen";
import TvYtShortsSection from "../youtube/TvYtShortsSection";
import TvYtWatchlistScreen from "../youtube/TvYtWatchlistScreen";
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

/** YouTube layout on TV: Home, Search, Shorts, Watchlist, Settings. */
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
            return <TvYtSearchScreen />;
          case "shorts":
            return <TvYtShortsSection />;
          case "watchlist":
            return <TvYtWatchlistScreen />;
          case "settings":
            return <TvSettingsScreen />;
        }
      }}
    />
  );
}
