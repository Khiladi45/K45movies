import React, { memo } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useTmdbRow } from "@/hooks/useTmdb";
import { tmdbImage, type TmdbItem } from "@/lib/tmdbApi";
import Focusable from "./Focusable";
import { useTvFocusStore } from "../focusStore";
import { TV } from "../theme";

export const PosterCard = memo(function PosterCard({
  item,
  onPress,
  hasTVPreferredFocus,
  reportFocus = true,
}: {
  item: TmdbItem;
  onPress: (item: TmdbItem) => void;
  hasTVPreferredFocus?: boolean;
  reportFocus?: boolean;
}) {
  const uri = tmdbImage(item.poster, "w342");
  return (
    <Focusable
      grow
      hasTVPreferredFocus={hasTVPreferredFocus}
      style={styles.card}
      onPress={() => onPress(item)}
      onFocus={() => {
        if (reportFocus) useTvFocusStore.getState().setFocused(item);
      }}
      accessibilityLabel={item.title}
    >
      {uri ? (
        <Image source={{ uri }} style={styles.image} contentFit="cover" transition={150} />
      ) : (
        <View style={[styles.image, styles.noImage]}>
          <Text style={styles.noImageText} numberOfLines={3}>
            {item.title}
          </Text>
        </View>
      )}
    </Focusable>
  );
});

/** A titled horizontal row of posters. Native focus scrolls it as you move. */
export const PosterRow = memo(function PosterRow({
  title,
  items,
  loading,
  onOpen,
  firstHasFocus,
  reportFocus,
}: {
  title: string;
  items: TmdbItem[];
  loading?: boolean;
  onOpen: (item: TmdbItem) => void;
  firstHasFocus?: boolean;
  reportFocus?: boolean;
}) {
  if (!loading && items.length === 0) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowTitle}>{title}</Text>
      {loading ? (
        <View style={styles.list}>
          {Array.from({ length: 7 }).map((_, i) => (
            <View key={i} style={[styles.card, styles.skeleton]} />
          ))}
        </View>
      ) : (
        <FlatList
          horizontal
          data={items}
          keyExtractor={(item) => `${item.mediaType}:${item.id}`}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.list}
          // Keep every card mounted so D-pad focus can reach the row's end.
          initialNumToRender={20}
          windowSize={41}
          removeClippedSubviews={false}
          renderItem={({ item, index }) => (
            <PosterCard
              item={item}
              onPress={onOpen}
              hasTVPreferredFocus={firstHasFocus && index === 0}
              reportFocus={reportFocus}
            />
          )}
        />
      )}
    </View>
  );
});

/** A home row that loads its own TMDB list (same cache as the phone rows). */
export const TmdbFetchRow = memo(function TmdbFetchRow({
  title,
  rowKey,
  fetcher,
  onOpen,
  firstHasFocus,
}: {
  title: string;
  rowKey: string;
  fetcher: (signal?: AbortSignal) => Promise<TmdbItem[]>;
  onOpen: (item: TmdbItem) => void;
  firstHasFocus?: boolean;
}) {
  const { data, isLoading } = useTmdbRow(rowKey, fetcher);
  return (
    <PosterRow
      title={title}
      items={data || []}
      loading={isLoading}
      onOpen={onOpen}
      firstHasFocus={firstHasFocus}
      reportFocus
    />
  );
});

const styles = StyleSheet.create({
  row: { marginBottom: 18 },
  rowTitle: {
    color: "#fff",
    fontSize: TV.text.row,
    fontWeight: "700",
    marginBottom: 8,
    marginLeft: TV.safeX,
  },
  list: {
    flexDirection: "row",
    gap: TV.gap,
    paddingHorizontal: TV.safeX,
    paddingVertical: 6,
  },
  card: {
    width: TV.poster.width,
    height: TV.poster.height,
    overflow: "hidden",
    backgroundColor: TV.surface,
  },
  image: { width: "100%", height: "100%", borderRadius: TV.radius - 2 },
  noImage: { alignItems: "center", justifyContent: "center", padding: 8 },
  noImageText: { color: "#fff", fontSize: TV.text.small, textAlign: "center" },
  skeleton: { opacity: 0.5 },
});
