import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useYtSearch, useYtSuggestions } from "../hooks";
import { useYtSearchStore } from "../store";
import { useYtUiStore } from "../playerStore";
import { YT } from "../theme";
import type { YtVideo } from "../types";
import VideoRow from "../components/VideoRow";
import { RowSkeleton } from "../components/Skeletons";

const ROW_H = 110; // 94px thumbnail + 8px padding top and bottom

const useDebounced = (value: string, ms: number) => {
  const [out, setOut] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setOut(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return out;
};

/**
 * Root-stack search screen opened from the Home header. Typing shows live
 * suggestions; submitting shows results in the same screen. Back always goes
 * to Home.
 */
export default function YtSearchScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const openMenu = useYtUiStore((s) => s.openMenu);
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState("");

  const recent = useYtSearchStore((s) => s.recent);
  const addSearch = useYtSearchStore((s) => s.addSearch);
  const removeSearch = useYtSearchStore((s) => s.removeSearch);
  const clearSearches = useYtSearchStore((s) => s.clearSearches);

  const debounced = useDebounced(text, 220);
  const suggestions = useYtSuggestions(submitted ? "" : debounced);
  const results = useYtSearch(submitted);
  const videos = results.data ?? [];

  // Remember the search together with a thumbnail of its first result.
  const firstImage = videos[0]?.image;
  useEffect(() => {
    if (submitted && firstImage) addSearch(submitted, firstImage);
  }, [submitted, firstImage, addSearch]);

  const imageFor = useMemo(() => {
    const map = new Map(recent.map((r) => [r.term.toLowerCase(), r.image]));
    return (term: string) => map.get(term.toLowerCase());
  }, [recent]);

  const run = useCallback(
    (term: string) => {
      const trimmed = term.trim();
      if (!trimmed) return;
      setText(trimmed);
      setSubmitted(trimmed);
      addSearch(trimmed);
      Keyboard.dismiss();
    },
    [addSearch],
  );

  const onChangeText = (value: string) => {
    setText(value);
    // Editing the query leaves the results and goes back to suggestions.
    if (submitted) setSubmitted("");
  };

  const clearText = () => {
    setText("");
    setSubmitted("");
    inputRef.current?.focus();
  };

  const openResult = useCallback(
    (video: YtVideo) => {
      if (video.isShort) {
        const shorts = videos.filter((v) => v.isShort);
        navigation.navigate("Tabs", { screen: "Shorts", params: {
          items: shorts,
          startIndex: Math.max(0, shorts.findIndex((v) => v.id === video.id)),
        } });
      } else {
        navigation.navigate("YtVideo", { video });
      }
    },
    [navigation, videos],
  );

  const showResults = submitted.length > 0;
  const typing = text.trim().length > 0 && !showResults;
  const live = suggestions.data ?? [];

  const suggestionRows = useMemo(
    () => live.map((term) => ({ term, image: imageFor(term) })),
    [live, imageFor],
  );

  const renderTermRow = ({ item }: { item: { term: string; image?: string } }) => (
    <TouchableOpacity
      style={styles.recentRow}
      onPress={() => run(item.term)}
      onLongPress={typing ? undefined : () => removeSearch(item.term)}
      accessibilityRole="button"
    >
      <Ionicons name="time-outline" size={22} color={YT.muted} />
      <Text style={styles.recentText} numberOfLines={1}>
        {item.term}
      </Text>
      {item.image ? (
        <Image source={{ uri: item.image }} style={styles.recentThumb} contentFit="cover" />
      ) : (
        <View style={styles.recentThumb} />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={24} color={YT.text} />
        </TouchableOpacity>
        <View style={styles.input}>
          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={onChangeText}
            onSubmitEditing={() => run(text)}
            placeholder="Search videos"
            placeholderTextColor={YT.muted}
            returnKeyType="search"
            autoFocus
            autoCorrect={false}
            style={styles.field}
            accessibilityLabel="Search videos"
          />
          {text.length > 0 ? (
            <TouchableOpacity onPress={clearText} accessibilityLabel="Clear search" hitSlop={10}>
              <Ionicons name="close" size={20} color={YT.muted} />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity style={styles.iconBtn} onPress={() => run(text)} accessibilityLabel="Search">
          <Ionicons name="search" size={24} color={YT.text} />
        </TouchableOpacity>
      </View>

      {showResults ? (
        results.isLoading ? (
          <RowSkeleton />
        ) : results.isError && videos.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.msg}>Search failed.</Text>
            <TouchableOpacity style={styles.retry} onPress={() => results.refetch()}>
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={videos}
            keyExtractor={(v) => v.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <VideoRow
                video={item}
                onPress={openResult}
                right={
                  <TouchableOpacity hitSlop={10} onPress={() => openMenu(item)} accessibilityLabel="More options">
                    <Ionicons name="ellipsis-vertical" size={18} color={YT.text} />
                  </TouchableOpacity>
                }
              />
            )}
            getItemLayout={(_, index) => ({ length: ROW_H, offset: ROW_H * index, index })}
            initialNumToRender={8}
            maxToRenderPerBatch={8}
            windowSize={9}
            removeClippedSubviews
            onEndReached={() => results.hasNextPage && !results.isFetchingNextPage && results.fetchNextPage()}
            onEndReachedThreshold={1.5}
            ListEmptyComponent={<Text style={[styles.msg, styles.empty]}>No results for "{submitted}".</Text>}
            ListFooterComponent={
              results.isFetchingNextPage ? (
                <ActivityIndicator color={YT.red} style={{ paddingVertical: 20 }} />
              ) : (
                <View style={{ height: 16 }} />
              )
            }
          />
        )
      ) : typing ? (
        <FlatList
          data={suggestionRows}
          keyExtractor={(r) => r.term}
          keyboardShouldPersistTaps="handled"
          renderItem={renderTermRow}
          ListHeaderComponent={
            suggestions.isFetching && suggestionRows.length === 0 ? (
              <ActivityIndicator color={YT.muted} style={{ paddingVertical: 20 }} />
            ) : null
          }
        />
      ) : (
        <FlatList
          data={recent}
          keyExtractor={(r) => r.term}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            recent.length > 0 ? (
              <View style={styles.head}>
                <Text style={styles.headText}>Recent searches</Text>
                <TouchableOpacity onPress={clearSearches} accessibilityLabel="Clear all recent searches">
                  <Text style={styles.clear}>Clear all</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
          ListEmptyComponent={<Text style={[styles.msg, styles.empty]}>Your recent searches appear here.</Text>}
          renderItem={renderTermRow}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: YT.bg },
  bar: { height: 56, flexDirection: "row", alignItems: "center", paddingRight: 4 },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  input: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    backgroundColor: YT.surface,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 8,
  },
  field: { flex: 1, color: YT.text, fontSize: 16, padding: 0 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  headText: { color: YT.text, fontSize: 16, fontWeight: "700" },
  clear: { color: YT.blue, fontSize: 14, fontWeight: "500", paddingVertical: 8 },
  recentRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 8, minHeight: 52 },
  recentText: { flex: 1, color: YT.text, fontSize: 16 },
  recentThumb: { width: 72, height: 40, borderRadius: 6, backgroundColor: YT.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  msg: { color: YT.muted, fontSize: 14 },
  empty: { textAlign: "center", marginTop: 40 },
  retry: { backgroundColor: YT.surface, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 18 },
  retryText: { color: YT.text, fontWeight: "600" },
});
