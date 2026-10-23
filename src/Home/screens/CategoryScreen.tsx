import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { providerApi } from "@/lib/providerApi";
import { useThemeStore } from "@/store/useThemeStore";
import Skeleton from "@/components/Skeleton";

const PAGE_LIMIT = 40;
const COLUMNS = 3;

const extractPosts = (payload: any): any[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.posts)) return payload.posts;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const keyFor = (item: any) => item?.link || item?.title;

export default function CategoryScreen({ route, navigation }: any) {
  const { providerId, filter, title } = route.params || {};
  const insets = useSafeAreaInsets();
  const { primaryColor } = useThemeStore();

  const [items, setItems] = useState<any[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const mounted = useRef(true);
  const inFlight = useRef(false);
  const pageRef = useRef(0);
  const itemsRef = useRef<any[]>([]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const loadPage = useCallback(
    async (nextPage: number, mode: "initial" | "more" | "refresh") => {
      if (inFlight.current) return;
      if (!providerId || !filter) {
        setLoading(false);
        setError("This category cannot be loaded.");
        return;
      }
      inFlight.current = true;
      if (mode === "initial") setLoading(true);
      if (mode === "more") setLoadingMore(true);
      if (mode === "refresh") setRefreshing(true);
      setError(null);

      try {
        const payload = await providerApi.getPosts(
          providerId,
          filter,
          nextPage,
        );
        if (!mounted.current) return;
        const incoming = extractPosts(payload).filter(
          (item: any) => item && keyFor(item),
        );

        const previous = mode === "more" ? itemsRef.current : [];
        const seen = new Set(previous.map(keyFor));
        const unique = [...previous];
        for (const item of incoming) {
          const key = keyFor(item);
          if (seen.has(key)) continue;
          seen.add(key);
          unique.push({ ...item, providerId: item.providerId || providerId });
        }
        const added = unique.length - previous.length;
        itemsRef.current = unique;
        setItems(unique);
        pageRef.current = nextPage;
        setPage(nextPage);
        setDone(incoming.length === 0 || added === 0);
      } catch (caught: any) {
        if (!mounted.current) return;
        setError(caught?.message || "Could not load this category.");
      } finally {
        if (mounted.current) {
          setLoading(false);
          setLoadingMore(false);
          setRefreshing(false);
        }
        inFlight.current = false;
      }
    },
    [providerId, filter],
  );

  useEffect(() => {
    itemsRef.current = [];
    setItems([]);
    setDone(false);
    pageRef.current = 0;
    loadPage(1, "initial");
  }, [loadPage]);

  const loadMore = () => {
    if (loading || loadingMore || refreshing || done || inFlight.current) return;
    if (pageRef.current >= PAGE_LIMIT) {
      setDone(true);
      return;
    }
    void loadPage(pageRef.current + 1, "more");
  };

  const refresh = () => {
    if (inFlight.current) return;
    setDone(false);
    void loadPage(1, "refresh");
  };

  const retry = () => {
    if (items.length === 0) {
      setDone(false);
      void loadPage(1, "initial");
    } else {
      void loadPage(pageRef.current + 1, "more");
    }
  };

  const openDetail = (item: any) => {
    navigation.navigate("Detail", {
      movie: item,
      providerId: item.providerId || providerId,
    });
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.82}
      onPress={() => openDetail(item)}
    >
      <View style={styles.posterBox}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.poster} />
        ) : (
          <Ionicons name="film-outline" size={26} color="#444" />
        )}
      </View>
      <Text style={styles.cardTitle} numberOfLines={2}>
        {item.title || "Untitled"}
      </Text>
    </TouchableOpacity>
  );

  const ListFooter = () => {
    if (loadingMore) {
      return (
        <View style={styles.footer}>
          <ActivityIndicator color={primaryColor} />
        </View>
      );
    }
    if (error && items.length > 0) {
      return (
        <TouchableOpacity style={styles.footer} onPress={retry}>
          <Text style={styles.footerError} numberOfLines={2}>
            {error}
          </Text>
          <Text style={[styles.footerRetry, { color: primaryColor }]}>
            Tap to retry
          </Text>
        </TouchableOpacity>
      );
    }
    if (done && items.length > 0) {
      return (
        <View style={styles.footer}>
          <Text style={styles.footerEnd}>End of {title || "category"}</Text>
        </View>
      );
    }
    return null;
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={10}
        >
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title || "Category"}
        </Text>
        <View style={{ width: 34 }} />
      </View>

      {loading ? (
        <View style={styles.skeletonGrid}>
          {Array.from({ length: 9 }).map((_, index) => (
            <View key={index} style={styles.card}>
              <Skeleton style={styles.skeletonPoster} />
              <Skeleton style={styles.skeletonTitle} />
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={items}
          numColumns={COLUMNS}
          keyExtractor={(item, index) => `${keyFor(item)}-${index}`}
          renderItem={renderItem}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          initialNumToRender={12}
          windowSize={7}
          maxToRenderPerBatch={8}
          removeClippedSubviews
          ListFooterComponent={ListFooter}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={primaryColor}
              colors={[primaryColor]}
            />
          }
          ListEmptyComponent={
            error ? (
              <View style={styles.center}>
                <Ionicons name="cloud-offline-outline" size={46} color="#444" />
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity
                  style={[styles.retryButton, { borderColor: primaryColor }]}
                  onPress={retry}
                >
                  <Text style={[styles.retryText, { color: primaryColor }]}>
                    Try again
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.center}>
                <Ionicons name="albums-outline" size={46} color="#444" />
                <Text style={styles.emptyText}>
                  No titles in this category yet
                </Text>
              </View>
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  backButton: { width: 34, padding: 4 },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    paddingTop: 4,
    flexGrow: 1,
  },
  columnWrapper: { justifyContent: "space-between" },
  card: { width: "31%", marginBottom: 18 },
  posterBox: {
    width: "100%",
    aspectRatio: 2 / 3,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#141414",
    alignItems: "center",
    justifyContent: "center",
  },
  poster: { width: "100%", height: "100%" },
  cardTitle: {
    color: "#fff",
    fontSize: 12,
    marginTop: 6,
    fontWeight: "500",
    lineHeight: 16,
  },
  skeletonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  skeletonPoster: { width: "100%", aspectRatio: 2 / 3, borderRadius: 12 },
  skeletonTitle: {
    width: "82%",
    height: 12,
    borderRadius: 4,
    marginTop: 8,
  },
  center: {
    flex: 1,
    minHeight: 300,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 30,
  },
  emptyText: { color: "#888", fontSize: 14, textAlign: "center" },
  errorText: { color: "#aaa", fontSize: 13, textAlign: "center" },
  retryButton: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  retryText: { fontSize: 13, fontWeight: "700" },
  footer: { paddingVertical: 22, alignItems: "center", gap: 4 },
  footerError: { color: "#d98a8a", fontSize: 12.5, textAlign: "center" },
  footerRetry: { fontSize: 12, fontWeight: "700" },
  footerEnd: { color: "#555", fontSize: 12 },
});
