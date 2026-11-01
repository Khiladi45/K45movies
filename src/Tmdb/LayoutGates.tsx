// The only place that decides between the two layouts. In "provider" mode each
// gate renders the original screen with the original props and nothing else, so
// the provider flow behaves exactly as it did before the Movie Based layout
// existed. In "movie" mode the original screens are never mounted, so no
// provider calls are made from Home / Search / Watchlist.

import React from "react";
import HomeScreen from "@/Home/screens/HomeScreen";
import Header from "@/components/header";
import GlobalSearch from "@/components/search";
import Watchlist from "@/components/watchlist";
import { useLayoutStore } from "@/store/useLayoutStore";
import MovieHeader from "./components/MovieHeader";
import TmdbHomeScreen from "./screens/TmdbHomeScreen";
import TmdbSearchScreen from "./screens/TmdbSearchScreen";
import TmdbWatchlistScreen from "./screens/TmdbWatchlistScreen";

export function HomeHeaderGate() {
  const layout = useLayoutStore((s) => s.layout);
  return layout === "movie" ? <MovieHeader /> : <Header />;
}

export function HomeGate(props: any) {
  const layout = useLayoutStore((s) => s.layout);
  return layout === "movie" ? <TmdbHomeScreen /> : <HomeScreen {...props} />;
}

export function SearchGate(props: any) {
  const layout = useLayoutStore((s) => s.layout);
  return layout === "movie" ? (
    <TmdbSearchScreen {...props} />
  ) : (
    <GlobalSearch {...props} />
  );
}

export function WatchlistGate(props: any) {
  const layout = useLayoutStore((s) => s.layout);
  return layout === "movie" ? (
    <TmdbWatchlistScreen {...props} />
  ) : (
    <Watchlist {...props} />
  );
}
