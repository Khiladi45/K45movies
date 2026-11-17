import React, { memo, useEffect } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { usePosts } from "@/hooks/useProvider";
import Focusable from "../components/Focusable";
import { TV } from "../theme";
import { PostCard, SeeAllCard, postCardStyles } from "./PostCard";
import { extractPosts, type ProviderPost } from "./posts";
import { usePostFocusStore } from "./postFocusStore";

/**
 * One catalog row of the Provider Based TV home. Loads its posts only when
 * `enabled` (the home enables rows near the focus so slow TV boxes don't
 * scrape every catalog at once). Shows up to TV.rowLimit posters, then a
 * "See all" card that opens the full category grid.
 */
export const PostRow = memo(function PostRow({
  providerId,
  catalog,
  rowIndex,
  enabled,
  onOpen,
  onSeeAll,
  onRowFocus,
  seedHero,
}: {
  providerId: string;
  catalog: { title: string; filter?: string; id?: string };
  rowIndex: number;
  enabled: boolean;
  onOpen: (post: ProviderPost) => void;
  onSeeAll: (catalog: { title: string; filter: string }) => void;
  onRowFocus: (rowIndex: number) => void;
  /** First row fills the hero before anything is focused. */
  seedHero?: boolean;
}) {
  const filter = String(catalog.filter || catalog.id || "");
  const { data, isLoading, isError, refetch } = usePosts(providerId, enabled ? filter : "");
  const posts: ProviderPost[] = extractPosts(data).slice(0, TV.rowLimit);

  useEffect(() => {
    if (!seedHero || posts.length === 0) return;
    const store = usePostFocusStore.getState();
    if (!store.focused) store.setFocused({ ...posts[0], providerId, catalogTitle: catalog.title });
  }, [seedHero, posts.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const focused = () => onRowFocus(rowIndex);

  return (
    <View style={styles.row}>
      <Text style={styles.title} numberOfLines={1}>
        {catalog.title}
      </Text>
      {isError ? (
        <Focusable style={styles.retry} onPress={() => refetch()} onFocus={focused}>
          <Text style={styles.retryText}>Couldn't load this row — press OK to retry</Text>
        </Focusable>
      ) : !enabled || isLoading ? (
        <View style={styles.list}>
          {Array.from({ length: 7 }).map((_, i) => (
            <View key={i} style={[postCardStyles.card, styles.skeleton]} />
          ))}
        </View>
      ) : posts.length === 0 ? (
        <Text style={styles.empty}>Nothing here right now.</Text>
      ) : (
        <FlatList
          horizontal
          data={posts}
          keyExtractor={(item, index) => `${item.link || item.title}-${index}`}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.list}
          // Keep every card mounted so D-pad focus can reach the row's end.
          initialNumToRender={TV.rowLimit + 1}
          windowSize={41}
          removeClippedSubviews={false}
          renderItem={({ item }) => (
            <PostCard
              post={{ ...item, providerId: item.providerId || providerId }}
              catalogTitle={catalog.title}
              onPress={onOpen}
              onFocus={focused}
            />
          )}
          ListFooterComponent={
            filter ? (
              <SeeAllCard
                onPress={() => onSeeAll({ title: catalog.title, filter })}
                onFocus={focused}
              />
            ) : null
          }
        />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { marginBottom: 18 },
  title: {
    color: "#fff",
    fontSize: TV.text.row,
    fontWeight: "700",
    marginBottom: 8,
    marginLeft: TV.safeX,
  },
  list: { flexDirection: "row", gap: TV.gap, paddingHorizontal: TV.safeX, paddingVertical: 6 },
  skeleton: { opacity: 0.5 },
  empty: { color: TV.muted, fontSize: TV.text.small, marginLeft: TV.safeX },
  retry: {
    alignSelf: "flex-start",
    marginLeft: TV.safeX,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(239,68,68,0.15)",
  },
  retryText: { color: "#fca5a5", fontSize: TV.text.small, fontWeight: "600" },
});
