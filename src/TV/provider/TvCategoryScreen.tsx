// Provider Based layout — full category grid on TV ("See all"). Paged like the
// phone CategoryScreen: providerApi.getPosts page by page, duplicates dropped,
// stops on an empty/duplicate page or after PAGE_LIMIT pages.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { providerApi } from "@/lib/providerApi";
import Focusable from "../components/Focusable";
import { TV } from "../theme";
import { useRestoreTvFocus } from "../useRestoreTvFocus";
import { PostCard } from "./PostCard";
import { mergePostsPage, type ProviderPost } from "./posts";
import { useOpenProviderPost } from "./TvProviderHomeScreen";

const PAGE_LIMIT = 40;
export const CATEGORY_COLUMNS = 7;

export default function TvCategoryScreen({ route }: any) {
  const { providerId, filter, title } = route.params || {};
  const open = useOpenProviderPost();
  const [items, setItems] = useState<ProviderPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const mounted = useRef(true);
  const inFlight = useRef(false);
  const pageRef = useRef(0);
  const itemsRef = useRef<ProviderPost[]>([]);
  const firstRef = useRef<View | null>(null);
  // Back from a detail page: focus returns to the poster it was on.
  useRestoreTvFocus(firstRef);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const loadPage = useCallback(
    async (page: number, more: boolean) => {
      if (inFlight.current) return;
      if (!providerId || !filter) {
        setLoading(false);
        setError("This category cannot be loaded.");
        return;
      }
      inFlight.current = true;
      if (more) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const payload = await providerApi.getPosts(providerId, filter, page);
        if (!mounted.current) return;
        const merged = mergePostsPage(more ? itemsRef.current : [], payload, providerId);
        itemsRef.current = merged.items;
        setItems(merged.items);
        pageRef.current = page;
        setDone(merged.incoming === 0 || merged.added === 0);
      } catch (caught: any) {
        if (mounted.current) setError(caught?.message || "Could not load this category.");
      } finally {
        if (mounted.current) {
          setLoading(false);
          setLoadingMore(false);
        }
        inFlight.current = false;
      }
    },
    [providerId, filter],
  );

  useEffect(() => {
    pageRef.current = 0;
    itemsRef.current = [];
    setDone(false);
    void loadPage(1, false);
  }, [loadPage]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || done || pageRef.current >= PAGE_LIMIT) return;
    void loadPage(pageRef.current + 1, true);
  }, [loading, loadingMore, done, loadPage]);

  return (
    <View style={styles.screen}>
      <Text style={styles.title} numberOfLines={1}>
        {title || "Category"}
      </Text>
      {loading ? (
        <ActivityIndicator color="#fff" size="large" style={{ marginTop: 40 }} />
      ) : error && items.length === 0 ? (
        <Focusable style={styles.retry} hasTVPreferredFocus onPress={() => loadPage(1, false)}>
          <Text style={styles.retryText}>{error} Press OK to retry.</Text>
        </Focusable>
      ) : (
        <FlatList
          data={items}
          numColumns={CATEGORY_COLUMNS}
          keyExtractor={(item, index) => `${item.link || item.title}-${index}`}
          contentContainerStyle={styles.content}
          columnWrapperStyle={styles.gridRow}
          removeClippedSubviews={false}
          // Load the next page while focus is still a couple of rows away.
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          ListEmptyComponent={<Text style={styles.empty}>Nothing in this category.</Text>}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color="#fff" style={{ marginVertical: 16 }} /> : null
          }
          renderItem={({ item, index }) => (
            <PostCard
              ref={index === 0 ? firstRef : undefined}
              hasTVPreferredFocus={index === 0}
              post={item}
              reportFocus={false}
              onPress={open}
              onFocus={() => {
                // Focus within the last two rows also asks for the next page.
                if (index >= items.length - CATEGORY_COLUMNS * 2) loadMore();
              }}
            />
          )}
        />
      )}
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
  content: { paddingHorizontal: TV.safeX, paddingBottom: 40 },
  gridRow: { gap: TV.gap, marginBottom: TV.gap + 4 },
  empty: { color: TV.muted, fontSize: TV.text.body },
  retry: {
    alignSelf: "flex-start",
    marginHorizontal: TV.safeX,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(239,68,68,0.15)",
  },
  retryText: { color: "#fca5a5", fontSize: TV.text.body, fontWeight: "600" },
});
