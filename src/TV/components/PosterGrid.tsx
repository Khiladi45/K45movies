import React from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import type { TmdbItem } from "@/lib/tmdbApi";
import { PosterCard } from "./PosterRow";
import { TV } from "../theme";

export const GRID_COLUMNS = 7;

/** Poster grid for search results and My List. */
export default function PosterGrid({
  items,
  onOpen,
  empty,
  header,
}: {
  items: TmdbItem[];
  onOpen: (item: TmdbItem) => void;
  empty?: string;
  header?: React.ReactElement | null;
}) {
  return (
    <FlatList
      data={items}
      numColumns={GRID_COLUMNS}
      keyExtractor={(item) => `${item.mediaType}:${item.id}`}
      ListHeaderComponent={header}
      ListEmptyComponent={
        empty ? <Text style={styles.empty}>{empty}</Text> : null
      }
      contentContainerStyle={styles.content}
      columnWrapperStyle={styles.row}
      removeClippedSubviews={false}
      renderItem={({ item }) => (
        <View>
          <PosterCard item={item} onPress={onOpen} reportFocus={false} />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: TV.safeX, paddingBottom: 40 },
  row: { gap: TV.gap, marginBottom: TV.gap + 4 },
  empty: { color: TV.muted, fontSize: TV.text.body, marginTop: 24 },
});
