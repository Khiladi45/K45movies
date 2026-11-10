import React, { type RefObject } from "react";
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
  firstRef,
}: {
  items: TmdbItem[];
  onOpen: (item: TmdbItem) => void;
  empty?: string;
  header?: React.ReactElement | null;
  /** Attached to the first poster so a screen can move focus to it. */
  firstRef?: RefObject<View | null>;
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
      renderItem={({ item, index }) => (
        <View>
          <PosterCard
            ref={index === 0 ? firstRef : undefined}
            item={item}
            onPress={onOpen}
            reportFocus={false}
          />
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
