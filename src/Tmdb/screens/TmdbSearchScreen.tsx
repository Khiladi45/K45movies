import React, { useEffect, useRef, useState } from "react";
import {
  FlatList,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Skeleton from "@/components/Skeleton";
import { useThemeStore } from "@/store/useThemeStore";
import { useSearchHistoryStore } from "@/store/useSearchHistoryStore";
import { useTmdbSearch } from "@/hooks/useTmdb";
import { tmdbConfigured } from "@/lib/tmdbApi";
import { MissingKeyNotice, PosterCard, useOpenTitle } from "../components/common";

const TRENDING = ["Avatar", "Avengers", "Leo", "Jawan", "Money Heist", "Stranger Things", "Thriller"];

/** Search tab for the Movie Based layout: queries TMDB (movies + series). */
export default function TmdbSearchScreen({ navigation }: any) {
  const { primaryColor } = useThemeStore();
  const insets = useSafeAreaInsets();
  const open = useOpenTitle();
  const history = useSearchHistoryStore((s) => s.history);
  const addSearch = useSearchHistoryStore((s) => s.addSearch);
  const removeSearch = useSearchHistoryStore((s) => s.removeSearch);
  const clearHistory = useSearchHistoryStore((s) => s.clearHistory);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState("");
  const inputRef = useRef<TextInput>(null);

  // Same behaviour as the provider search: hide the tab bar while searching.
  useEffect(() => {
    navigation.getParent()?.setOptions({ tabBarStyle: { display: "none" } });
    return () =>
      navigation.getParent()?.setOptions({ tabBarStyle: { display: "flex" } });
  }, [navigation]);

  const { data, isLoading, isError, refetch } = useTmdbSearch(active);

  const submit = (term = query) => {
    const trimmed = term.trim();
    if (trimmed.length < 2) return;
    Keyboard.dismiss();
    setQuery(trimmed);
    addSearch(trimmed);
    setActive(trimmed);
  };

  const clear = () => {
    setQuery("");
    setActive("");
  };

  const header =
    active.length === 0 ? (
      <View>
        {history.length > 0 ? (
          <View style={styles.block}>
            <View style={styles.blockHead}>
              <Text style={styles.blockTitle}>Recent Searches</Text>
              <TouchableOpacity onPress={clearHistory} hitSlop={8}>
                <Text style={styles.clearAll}>Clear all</Text>
              </TouchableOpacity>
            </View>
            {history.map((term) => (
              <View key={term} style={styles.historyRow}>
                <TouchableOpacity style={styles.historyMain} onPress={() => submit(term)}>
                  <Ionicons name="time-outline" size={16} color="#8b93a0" />
                  <Text style={styles.historyText} numberOfLines={1}>
                    {term}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => removeSearch(term)} hitSlop={8}>
                  <Ionicons name="close" size={16} color="#666" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : null}
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Trending Searches</Text>
          <View style={styles.tags}>
            {TRENDING.map((term) => (
              <TouchableOpacity
                key={term}
                style={[styles.tag, { borderColor: `${primaryColor}33` }]}
                onPress={() => submit(term)}
              >
                <Ionicons name="trending-up" size={14} color={primaryColor} />
                <Text style={styles.tagText}>{term}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    ) : isLoading ? (
      <View style={styles.grid}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={styles.cell}>
            <Skeleton style={{ width: "100%", aspectRatio: 2 / 3, borderRadius: 12 }} />
            <Skeleton style={{ width: "80%", height: 12, borderRadius: 4, marginTop: 8 }} />
          </View>
        ))}
      </View>
    ) : isError ? (
      <View style={styles.empty}>
        <Ionicons name="cloud-offline-outline" size={52} color="#444" />
        <Text style={styles.emptyText}>Search failed</Text>
        <TouchableOpacity onPress={() => refetch()} style={[styles.retry, { backgroundColor: primaryColor }]}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    ) : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 6 }}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={[styles.inputWrap, { borderColor: `${primaryColor}33` }]}>
          <Ionicons name="search" size={20} color="#8b93a0" style={{ marginRight: 8 }} />
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Search movies & series..."
            placeholderTextColor="#8b93a0"
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => submit()}
            blurOnSubmit={false}
          />
          {query.length > 0 ? (
            <TouchableOpacity onPress={clear}>
              <Ionicons name="close-circle" size={22} color="#8b93a0" />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity
          style={[styles.searchBtn, { backgroundColor: primaryColor }]}
          onPress={() => submit()}
        >
          <Text style={styles.searchBtnText}>Search</Text>
        </TouchableOpacity>
      </View>

      {!tmdbConfigured() ? (
        <MissingKeyNotice />
      ) : (
        <FlatList showsHorizontalScrollIndicator={false}
          data={active && !isLoading && !isError ? data || [] : []}
          numColumns={3}
          keyExtractor={(item) => `${item.mediaType}:${item.id}`}
          columnWrapperStyle={styles.columns}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 40 }}
          ListHeaderComponent={header}
          ListEmptyComponent={
            active && !isLoading && !isError ? (
              <View style={styles.empty}>
                <MaterialCommunityIcons name="movie-search-outline" size={64} color="#444" />
                <Text style={styles.emptyText}>No results for "{active}"</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <View style={styles.cell}>
              <PosterCard
                item={item}
                width={Math.floor((Dimensions_width() - 32 - 24) / 3)}
                onPress={() => open(item)}
              />
            </View>
          )}
        />
      )}
    </View>
  );
}

import { Dimensions } from "react-native";
const Dimensions_width = () => Dimensions.get("window").width;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#050505" },
  bar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 12, gap: 10 },
  inputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0a0a0a",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 48,
  },
  input: { flex: 1, color: "#fff", fontSize: 15, paddingVertical: 0 },
  searchBtn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 },
  searchBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  block: { paddingHorizontal: 16, paddingTop: 10, marginBottom: 14 },
  blockHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  blockTitle: { color: "#fff", fontSize: 19, fontWeight: "700", marginBottom: 8 },
  clearAll: { color: "#ef4444", fontSize: 12, fontWeight: "700" },
  historyRow: { flexDirection: "row", alignItems: "center", paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(255,255,255,0.07)" },
  historyMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  historyText: { color: "#ddd", fontSize: 14, flex: 1 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tag: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#0a0a0a", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1 },
  tagText: { color: "#fff", fontSize: 14, fontWeight: "500" },
  columns: { paddingHorizontal: 16, gap: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, gap: 12 },
  cell: { marginBottom: 16, width: "31%" },
  empty: { alignItems: "center", paddingHorizontal: 40, marginTop: 40, gap: 10 },
  emptyText: { color: "#8b93a0", fontSize: 15, textAlign: "center", fontWeight: "600" },
  retry: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10, marginTop: 6 },
  retryText: { color: "#fff", fontWeight: "700" },
});
