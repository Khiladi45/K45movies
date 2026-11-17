// Provider Based layout — TV Search. Same data as the phone search screen:
// useSearch(query, installedProviders) on submit, useSearchHistoryStore, the
// same trending terms. Results are one row per provider.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSearch } from "@/hooks/useSearch";
import { useProviderStore } from "@/store/useProviderStore";
import { useSearchHistoryStore } from "@/store/useSearchHistoryStore";
import { useInstalledProviderNames } from "@/components/PriorityProviderPicker";
import Focusable from "../components/Focusable";
import TvSearchBox from "../components/TvSearchBox";
import { requestFocus } from "../focusMemory";
import { TV } from "../theme";
import { PostCard } from "./PostCard";
import { PROVIDER_TRENDING, groupByProvider } from "./posts";
import { useOpenProviderPost } from "./TvProviderHomeScreen";

function Chips({
  title,
  terms,
  onPick,
  footer,
}: {
  title: string;
  terms: string[];
  onPick: (term: string) => void;
  footer?: React.ReactNode;
}) {
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

export default function TvProviderSearchScreen() {
  const installed = useProviderStore((s) => s.installedProviders);
  const providers = useInstalledProviderNames();
  const history = useSearchHistoryStore((s) => s.history);
  const addSearch = useSearchHistoryStore((s) => s.addSearch);
  const clearHistory = useSearchHistoryStore((s) => s.clearHistory);
  const open = useOpenProviderPost();

  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [focusResults, setFocusResults] = useState(false);
  const boxRef = useRef<View | null>(null);
  const firstResultRef = useRef<View | null>(null);

  const { data, isFetching, isError } = useSearch(query, installed);
  const groups = useMemo(() => groupByProvider(data, installed), [data, installed]);
  const nameOf = (id: string) => providers.find((p) => p.id === id)?.name || id;

  // Search runs on submit (like the phone), not on every letter.
  const run = useCallback(
    (term: string) => {
      const value = term.trim();
      setText(value);
      if (value.length > 2) {
        setQuery(value);
        addSearch(value);
        setFocusResults(true);
      } else {
        setQuery("");
        requestFocus(boxRef);
      }
    },
    [addSearch],
  );

  // After a search: focus the first result (or back to the box).
  useEffect(() => {
    if (!focusResults || isFetching) return;
    const timer = setTimeout(() => {
      setFocusResults(false);
      if (!(groups.length > 0 && requestFocus(firstResultRef))) requestFocus(boxRef);
    }, 120);
    return () => clearTimeout(timer);
  }, [focusResults, isFetching, groups.length]);

  const searching = query.length > 2;

  return (
    <View style={styles.screen}>
      <TvSearchBox
        ref={boxRef}
        text={text}
        onChangeText={setText}
        onDone={run}
        placeholder={`Search ${installed.length} provider${installed.length === 1 ? "" : "s"}`}
        busy={isFetching}
      />
      {!searching ? (
        <ScrollView contentContainerStyle={styles.body}>
          {text.trim().length > 0 && text.trim().length <= 2 ? (
            <Text style={styles.hint}>Type at least 3 letters.</Text>
          ) : null}
          <Chips
            title="Recent searches"
            terms={history}
            onPick={run}
            footer={
              <Focusable style={[styles.chip, styles.clear]} onPress={clearHistory}>
                <Text style={styles.chipText}>Clear</Text>
              </Focusable>
            }
          />
          <Chips title="Trending" terms={PROVIDER_TRENDING} onPick={run} />
          <Text style={styles.hint}>
            Press OK on the search box to type, or use the mic button on your remote.
          </Text>
        </ScrollView>
      ) : isError ? (
        <Text style={styles.hint}>Search failed. Check your connection and try again.</Text>
      ) : !isFetching && groups.length === 0 ? (
        <Text style={styles.hint}>Nothing found for “{query}”.</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.results}>
          {groups.map((group, groupIndex) => (
            <View key={group.providerId} style={styles.row}>
              <Text style={styles.rowTitle}>
                {nameOf(group.providerId)}
                <Text style={styles.count}>{`  ${group.posts.length}`}</Text>
              </Text>
              <FlatList
                horizontal
                data={group.posts}
                keyExtractor={(item, index) => `${item.link || item.title}-${index}`}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.list}
                removeClippedSubviews={false}
                initialNumToRender={TV.rowLimit}
                windowSize={41}
                renderItem={({ item, index }) => (
                  <PostCard
                    ref={groupIndex === 0 && index === 0 ? firstResultRef : undefined}
                    post={{ ...item, providerId: item.providerId || group.providerId }}
                    reportFocus={false}
                    onPress={open}
                  />
                )}
              />
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: TV.bg, paddingTop: TV.safeY + 8 },
  body: { paddingHorizontal: TV.safeX, paddingBottom: 40 },
  results: { paddingBottom: 40 },
  hint: { color: TV.muted, fontSize: TV.text.body, marginHorizontal: TV.safeX, marginTop: 8 },
  block: { marginBottom: 18 },
  blockTitle: { color: "#fff", fontSize: TV.text.row, fontWeight: "700", marginBottom: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "rgba(255,255,255,0.1)" },
  clear: { backgroundColor: "rgba(239,68,68,0.15)" },
  chipText: { color: "#fff", fontSize: TV.text.body, fontWeight: "600" },
  row: { marginBottom: 18 },
  rowTitle: { color: "#fff", fontSize: TV.text.row, fontWeight: "700", marginBottom: 8, marginLeft: TV.safeX },
  count: { color: TV.muted, fontSize: TV.text.small, fontWeight: "600" },
  list: { gap: TV.gap, paddingHorizontal: TV.safeX, paddingVertical: 6 },
});
