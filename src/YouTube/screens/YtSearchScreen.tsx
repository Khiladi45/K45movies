import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { useYtSearch } from "../hooks";
import { useYtSearchStore } from "../store";
import { YT } from "../theme";
import type { YtVideo } from "../types";
import VideoRow from "../components/VideoRow";

export default function YtSearchScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState("");

  const recent = useYtSearchStore((s) => s.recent);
  const addSearch = useYtSearchStore((s) => s.addSearch);
  const removeSearch = useYtSearchStore((s) => s.removeSearch);
  const clearSearches = useYtSearchStore((s) => s.clearSearches);

  const results = useYtSearch(submitted);

  // Remember the search together with a thumbnail of its first result.
  const firstImage = results.data?.[0]?.image;
  useEffect(() => {
    if (submitted && firstImage) addSearch(submitted, firstImage);
  }, [submitted, firstImage, addSearch]);

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

  const reset = () => {
    setText("");
    setSubmitted("");
    inputRef.current?.focus();
  };

  const openResult = useCallback(
    (video: YtVideo) => {
      if (video.isShort) {
        const shorts = (results.data ?? []).filter((v) => v.isShort);
        navigation.navigate("Shorts", {
          items: shorts,
          startIndex: Math.max(0, shorts.findIndex((v) => v.id === video.id)),
        });
      } else {
        navigation.navigate("YtVideo", { video });
      }
    },
    [navigation, results.data],
  );

  const showResults = submitted.length > 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        {showResults ? (
          <TouchableOpacity style={styles.iconBtn} onPress={reset} accessibilityLabel="Back to recent searches">
            <Ionicons name="arrow-back" size={24} color={YT.text} />
          </TouchableOpacity>
        ) : null}
        <View style={[styles.input, !showResults && { marginLeft: 12 }]}>
          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={setText}
            onSubmitEditing={() => run(text)}
            placeholder="Search videos"
            placeholderTextColor={YT.muted}
            returnKeyType="search"
            autoCorrect={false}
            style={styles.field}
            accessibilityLabel="Search videos"
          />
          {text.length > 0 ? (
            <TouchableOpacity onPress={reset} accessibilityLabel="Clear search" hitSlop={10}>
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
          <View style={styles.center}>
            <ActivityIndicator color={YT.red} />
          </View>
        ) : results.isError ? (
          <View style={styles.center}>
            <Text style={styles.msg}>Search failed.</Text>
            <TouchableOpacity style={styles.retry} onPress={() => results.refetch()}>
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={results.data ?? []}
            keyExtractor={(v) => v.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => <VideoRow video={item} onPress={openResult} />}
            ListEmptyComponent={<Text style={[styles.msg, styles.empty]}>No results for "{submitted}".</Text>}
            contentContainerStyle={{ paddingBottom: 16 }}
          />
        )
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
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.recentRow}
              onPress={() => run(item.term)}
              onLongPress={() => removeSearch(item.term)}
              accessibilityRole="button"
              accessibilityHint="Long press to remove"
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
          )}
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
