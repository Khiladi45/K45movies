// YouTube layout — TV Search. Same data as the phone YouTube search:
// useYtSearch(query) on submit, useYtSuggestions for related searches and
// useYtSearchStore for recent searches. Results: Shorts row + 3-column grid.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, View } from "react-native";
import { useYtSearch, useYtSuggestions } from "@/YouTube/hooks";
import { useYtHiddenStore, useYtSearchStore } from "@/YouTube/store";
import Focusable from "../components/Focusable";
import TvSearchBox from "../components/TvSearchBox";
import { requestFocus } from "../focusMemory";
import { TV } from "../theme";
import { useOpenYt } from "./TvYtHomeScreen";
import { YtShortCard, YtVideoCard } from "./YtTvCards";
import { useYtActions } from "./useYtActions";
import { withoutHidden } from "./ytRows";
import { chunk } from "./ytWatch";

function Chips({ title, terms, onPick, footer }: { title: string; terms: string[]; onPick: (t: string) => void; footer?: React.ReactNode }) {
  if (terms.length === 0) return null;
  return (
    <View style={styles.block}>
      <Text style={styles.blockTitle}>{title}</Text>
      <View style={styles.chips}>
        {terms.map((term) => (
          <Focusable key={term} style={styles.chip} onPress={() => onPick(term)}>
            <Text style={styles.chipText} numberOfLines={1}>
              {term}
            </Text>
          </Focusable>
        ))}
        {footer}
      </View>
    </View>
  );
}

export default function TvYtSearchScreen() {
  const recent = useYtSearchStore((s) => s.recent);
  const addSearch = useYtSearchStore((s) => s.addSearch);
  const clearSearches = useYtSearchStore((s) => s.clearSearches);
  const hiddenVideos = useYtHiddenStore((s) => s.videos);
  const hiddenChannels = useYtHiddenStore((s) => s.channels);
  const { openVideo, openShorts } = useOpenYt();
  const { openActions, dialog } = useYtActions();

  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [focusResults, setFocusResults] = useState(false);
  const boxRef = useRef<View | null>(null);
  const firstResultRef = useRef<View | null>(null);

  const search = useYtSearch(query);
  const suggestions = useYtSuggestions(query);
  const all = useMemo(
    () => withoutHidden(search.data ?? [], hiddenVideos, hiddenChannels),
    [search.data, hiddenVideos, hiddenChannels],
  );
  const shorts = useMemo(() => all.filter((v) => v.isShort), [all]);
  const rows = useMemo(() => chunk(all.filter((v) => !v.isShort), TV.ytColumns), [all]);

  const run = useCallback((term: string) => {
    const value = term.trim();
    setText(value);
    if (value.length > 0) {
      setQuery(value);
      setFocusResults(true);
    } else {
      setQuery("");
      requestFocus(boxRef);
    }
  }, []);

  // Remember the search with its first thumbnail once results arrive.
  const firstImage = all[0]?.image;
  useEffect(() => {
    if (query && firstImage) addSearch(query, firstImage);
  }, [query, firstImage, addSearch]);

  // After a search: focus the first result (or back to the box).
  const loading = search.isLoading && query.length > 0;
  useEffect(() => {
    if (!focusResults || loading) return;
    const timer = setTimeout(() => {
      setFocusResults(false);
      if (!(all.length > 0 && requestFocus(firstResultRef))) requestFocus(boxRef);
    }, 120);
    return () => clearTimeout(timer);
  }, [focusResults, loading, all.length]);

  const more = (rowIndex: number) => {
    if (rowIndex >= rows.length - 2 && search.hasNextPage && !search.isFetchingNextPage) void search.fetchNextPage();
  };
  const related = (suggestions.data ?? []).filter((s) => s.toLowerCase() !== query.toLowerCase()).slice(0, 8);

  return (
    <View style={styles.screen}>
      <TvSearchBox
        ref={boxRef}
        text={text}
        onChangeText={setText}
        onDone={run}
        placeholder="Search YouTube"
        busy={search.isFetching}
      />
      {!query ? (
        <ScrollView contentContainerStyle={styles.body}>
          <Chips
            title="Recent searches"
            terms={recent.map((r) => r.term)}
            onPick={run}
            footer={
              <Focusable style={[styles.chip, styles.clear]} onPress={clearSearches}>
                <Text style={styles.chipText}>Clear</Text>
              </Focusable>
            }
          />
          <Text style={styles.hint}>Press OK on the search box to type, or use the mic button on your remote.</Text>
        </ScrollView>
      ) : loading ? (
        <ActivityIndicator color="#fff" size="large" style={{ marginTop: 40 }} />
      ) : search.isError ? (
        <Text style={styles.hint}>Search failed. Check your connection and try again.</Text>
      ) : all.length === 0 ? (
        <Text style={styles.hint}>Nothing found for “{query}”.</Text>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) => row[0].id}
          contentContainerStyle={styles.content}
          removeClippedSubviews={false}
          initialNumToRender={4}
          windowSize={9}
          ListHeaderComponent={
            <>
              {shorts.length > 0 ? (
                <View style={styles.block}>
                  <Text style={styles.blockTitle}>Shorts</Text>
                  <FlatList
                    horizontal
                    data={shorts}
                    keyExtractor={(v) => v.id}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.shortsList}
                    removeClippedSubviews={false}
                    renderItem={({ item, index }) => (
                      <YtShortCard
                        ref={rows.length === 0 && index === 0 ? firstResultRef : undefined}
                        video={item}
                        onPress={() => openShorts(shorts, index)}
                        onLongPress={openActions}
                      />
                    )}
                  />
                </View>
              ) : null}
            </>
          }
          ListFooterComponent={
            <>
              {search.isFetchingNextPage ? <ActivityIndicator color="#fff" style={{ marginVertical: 16 }} /> : null}
              <Chips title="Related searches" terms={related} onPick={run} />
            </>
          }
          renderItem={({ item: row, index: rowIndex }) => (
            <View style={styles.row}>
              {row.map((video, i) => (
                <YtVideoCard
                  key={video.id}
                  ref={rowIndex === 0 && i === 0 ? firstResultRef : undefined}
                  video={video}
                  onPress={openVideo}
                  onLongPress={openActions}
                  onFocus={() => more(rowIndex)}
                />
              ))}
            </View>
          )}
        />
      )}
      {dialog}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: TV.bg, paddingTop: TV.safeY + 8 },
  body: { paddingHorizontal: TV.safeX, paddingBottom: 40 },
  content: { paddingHorizontal: TV.safeX, paddingBottom: 40 },
  hint: { color: TV.muted, fontSize: TV.text.body, marginHorizontal: TV.safeX, marginTop: 8 },
  block: { marginBottom: 18 },
  blockTitle: { color: "#fff", fontSize: TV.text.row, fontWeight: "700", marginBottom: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "rgba(255,255,255,0.1)" },
  clear: { backgroundColor: "rgba(239,68,68,0.15)" },
  chipText: { color: "#fff", fontSize: TV.text.body, fontWeight: "600" },
  shortsList: { gap: TV.gap },
  row: { flexDirection: "row", gap: TV.gap + 4, marginBottom: 18 },
});
