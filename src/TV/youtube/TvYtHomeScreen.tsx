// YouTube layout — TV Home. Same data as the phone YtHomeScreen (HOME_TABS,
// useYtMixedFeed / useYtFeed, useYtShorts, the same hidden filters) as a
// 3-column 16:9 grid with a Shorts row every 5-8 videos, loading more as
// focus nears the end. Long-press OK opens the action dialog.
import React, { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useThemeStore } from "@/store/useThemeStore";
import { HOME_TABS } from "@/YouTube/api";
import { useYtFeed, useYtMixedFeed, useYtShorts } from "@/YouTube/hooks";
import { useYtHiddenStore } from "@/YouTube/store";
import type { YtVideo } from "@/YouTube/types";
import Focusable from "../components/Focusable";
import { TV } from "../theme";
import { useRestoreTvFocus } from "../useRestoreTvFocus";
import { YtShortCard, YtVideoCard } from "./YtTvCards";
import { buildTvRows, withoutHidden, type TvYtRow } from "./ytRows";
import { useYtActions } from "./useYtActions";

/** Opens a video page or the Shorts player (TV-only routes). */
export function useOpenYt() {
  const navigation = useNavigation<any>();
  const openVideo = useCallback(
    (video: YtVideo) => navigation.navigate("TvYtVideo", { video }),
    [navigation],
  );
  const openShorts = useCallback(
    (items: YtVideo[], startIndex: number, query?: string) =>
      navigation.navigate("TvYtShorts", { items, startIndex, query }),
    [navigation],
  );
  return { openVideo, openShorts };
}

export default function TvYtHomeScreen() {
  const primaryColor = useThemeStore((s) => s.primaryColor);
  const hiddenVideos = useYtHiddenStore((s) => s.videos);
  const hiddenChannels = useYtHiddenStore((s) => s.channels);
  const [tabKey, setTabKey] = useState(HOME_TABS[0].key);
  const tab = HOME_TABS.find((t) => t.key === tabKey) ?? HOME_TABS[0];
  const single = useYtFeed(tab.filter, !tab.topics);
  const mixed = useYtMixedFeed(tab.topics ?? [], !!tab.topics);
  const feed = tab.topics ? mixed : single;
  const shorts = useYtShorts(tab.shortsFilter);
  const { openVideo, openShorts } = useOpenYt();
  const { openActions, dialog } = useYtActions();
  const firstChipRef = useRef<View | null>(null);
  useRestoreTvFocus(firstChipRef);

  const shortsList = shorts.data ?? [];
  const rows = useMemo<TvYtRow<YtVideo>[]>(
    () =>
      buildTvRows(
        withoutHidden(feed.data ?? [], hiddenVideos, hiddenChannels),
        shortsList,
        TV.ytColumns,
      ),
    [feed.data, shortsList, hiddenVideos, hiddenChannels],
  );

  // Same "keep growing" logic as the phone home.
  const loading = useRef(false);
  const loadMore = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    try {
      if (shorts.hasNextPage && !shorts.isFetchingNextPage) shorts.fetchNextPage();
      for (let i = 0; i < 3; i++) {
        const before = feed.data?.length ?? 0;
        if (feed.isFetchingNextPage || !feed.hasNextPage) break;
        const result = await feed.fetchNextPage();
        if ((result.data?.length ?? 0) > before || !result.hasNextPage) break;
      }
    } finally {
      loading.current = false;
    }
  }, [feed, shorts]);

  const nearEnd = (rowIndex: number) => {
    if (rowIndex >= rows.length - 3) void loadMore();
  };

  return (
    <View style={styles.screen}>
      <View style={styles.chips}>
        {HOME_TABS.map((t, index) => (
          <Focusable
            key={t.key}
            ref={index === 0 ? firstChipRef : undefined}
            style={[styles.chip, t.key === tabKey ? { backgroundColor: primaryColor } : null]}
            onPress={() => setTabKey(t.key)}
          >
            <Text style={styles.chipText}>{t.label}</Text>
          </Focusable>
        ))}
      </View>
      {feed.isLoading ? (
        <ActivityIndicator color="#fff" size="large" style={{ marginTop: 40 }} />
      ) : feed.isError ? (
        <Focusable style={styles.retry} onPress={() => feed.refetch()}>
          <Text style={styles.retryText}>Couldn't load videos — press OK to retry</Text>
        </Focusable>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) => row.key}
          contentContainerStyle={styles.content}
          removeClippedSubviews={false}
          initialNumToRender={6}
          windowSize={9}
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={0.8}
          ListFooterComponent={
            feed.isFetchingNextPage ? <ActivityIndicator color="#fff" style={{ marginVertical: 16 }} /> : null
          }
          renderItem={({ item: row, index }) =>
            row.kind === "videos" ? (
              <View style={styles.videoRow}>
                {row.items.map((video) => (
                  <YtVideoCard
                    key={video.id}
                    video={video}
                    onPress={openVideo}
                    onLongPress={openActions}
                    onFocus={() => nearEnd(index)}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.shortsRow}>
                <Text style={styles.rowTitle}>Shorts</Text>
                <FlatList
                  horizontal
                  data={row.items}
                  keyExtractor={(v) => v.id}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.shortsList}
                  removeClippedSubviews={false}
                  renderItem={({ item: short, index: i }) => (
                    <YtShortCard
                      video={short}
                      onPress={() => openShorts(shortsList, row.startIndex + i, tab.shortsFilter)}
                      onLongPress={openActions}
                      onFocus={() => nearEnd(index)}
                    />
                  )}
                />
              </View>
            )
          }
        />
      )}
      {dialog}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: TV.bg, paddingTop: TV.safeY },
  chips: { flexDirection: "row", gap: 10, paddingHorizontal: TV.safeX, marginBottom: 14 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: "rgba(255,255,255,0.1)" },
  chipText: { color: "#fff", fontSize: TV.text.body, fontWeight: "700" },
  content: { paddingHorizontal: TV.safeX, paddingBottom: 40 },
  videoRow: { flexDirection: "row", gap: TV.gap + 4, marginBottom: 18 },
  shortsRow: { marginBottom: 18 },
  rowTitle: { color: "#fff", fontSize: TV.text.row, fontWeight: "700", marginBottom: 8 },
  shortsList: { gap: TV.gap },
  retry: {
    alignSelf: "flex-start",
    marginHorizontal: TV.safeX,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(239,68,68,0.15)",
  },
  retryText: { color: "#fca5a5", fontSize: TV.text.body, fontWeight: "600" },
});
