import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTmdbWatchlistStore } from "@/store/useTmdbWatchlistStore";
import type { TmdbItem } from "@/lib/tmdbApi";
import PosterGrid from "../components/PosterGrid";
import { useOpenTvTitle } from "./TvHomeScreen";
import { TV } from "../theme";

export default function TvMyListScreen() {
  const saved = useTmdbWatchlistStore((s) => s.items);
  const open = useOpenTvTitle();
  const items = useMemo<TmdbItem[]>(
    () =>
      saved.map((entry) => ({
        id: entry.id,
        mediaType: entry.mediaType,
        title: entry.title,
        originalTitle: entry.title,
        overview: "",
        poster: entry.poster,
        backdrop: null,
        year: entry.year || "",
        rating: 0,
        originalLanguage: "",
      })),
    [saved],
  );
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>My List</Text>
      <PosterGrid
        items={items}
        onOpen={open}
        empty="Titles you add with “My List” on a title page appear here."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: TV.bg, paddingTop: TV.safeY + 8 },
  title: {
    color: "#fff",
    fontSize: TV.text.title,
    fontWeight: "800",
    marginHorizontal: TV.safeX,
    marginBottom: 14,
  },
});
