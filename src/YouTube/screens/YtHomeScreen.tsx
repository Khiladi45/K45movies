import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { HOME_TABS } from "../api";
import { useYtFeed, useYtShorts } from "../hooks";
import { useYtHiddenStore } from "../store";
import { useYtUiStore } from "../playerStore";
import { YT } from "../theme";
import type { YtVideo } from "../types";
import VideoCard from "../components/VideoCard";
import ShortsShelf from "../components/ShortsShelf";
import { FeedSkeleton } from "../components/Skeletons";

type Row =
  | { kind: "video"; key: string; video: YtVideo }
  | { kind: "shelf"; key: string; shorts: YtVideo[]; startIndex: number };

const SHELF_SIZE = 2;

/** Stable pseudo-random 5-8 so the shelf positions don't jump on re-render. */
const gapFor = (n: number) => 5 + ((n * 2654435761) >>> 0) % 4;

/** Videos with a 2-column Shorts shelf after every 5-8 of them. */
export function buildRows(videos: YtVideo[], shorts: YtVideo[]): Row[] {
  const rows: Row[] = [];
  let shelf = 0;
  let untilShelf = gapFor(0);
  videos.forEach((video) => {
    rows.push({ kind: "video", key: video.id, video });
    untilShelf -= 1;
    const start = shelf * SHELF_SIZE;
    if (untilShelf <= 0 && start + SHELF_SIZE <= shorts.length) {
      rows.push({
        kind: "shelf",
        key: `shelf-${shelf}`,
        shorts: shorts.slice(start, start + SHELF_SIZE),
        startIndex: start,
      });
      shelf += 1;
      untilShelf = gapFor(shelf);
    }
  });
  return rows;
}

export default function YtHomeScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const openMenu = useYtUiStore((s) => s.openMenu);
  const hiddenVideos = useYtHiddenStore((s) => s.videos);
  const hiddenChannels = useYtHiddenStore((s) => s.channels);
  const [tabKey, setTabKey] = useState(HOME_TABS[0].key);
  const tab = HOME_TABS.find((t) => t.key === tabKey) ?? HOME_TABS[0];

  const feed = useYtFeed(tab.filter);
  const shorts = useYtShorts(tab.shortsFilter);

  const rows = useMemo<Row[]>(() => {
    const videos = (feed.data ?? []).filter(
      (v) => !hiddenVideos.includes(v.id) && !(v.channelName && hiddenChannels.includes(v.channelName)),
    );
    return buildRows(videos, shorts.data ?? []);
  }, [feed.data, shorts.data, hiddenVideos, hiddenChannels]);

  const openVideo = useCallback(
    (video: YtVideo) => navigation.navigate("YtVideo", { video }),
    [navigation],
  );

  const shortsList = shorts.data ?? [];
  const openShort = useCallback(
    (index: number) =>
      navigation.navigate("Shorts", {
        items: shortsList,
        startIndex: index,
        query: tab.shortsFilter,
      }),
    [navigation, shortsList, tab.shortsFilter],
  );

  const refresh = () => {
    feed.refetch();
    shorts.refetch();
  };

  const loadMore = useCallback(() => {
    if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage();
    // Keep the shelves supplied: fetch more Shorts as the feed grows.
    const needed = Math.ceil(rows.length / 6) * SHELF_SIZE + SHELF_SIZE * 2;
    if (shortsList.length < needed && shorts.hasNextPage && !shorts.isFetchingNextPage) {
      shorts.fetchNextPage();
    }
  }, [feed, shorts, rows.length, shortsList.length]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.brand}>
          <View style={styles.logo}>
            <Ionicons name="play" size={12} color="#fff" />
          </View>
          <Text style={styles.brandText}>K45</Text>
        </View>
        <TouchableOpacity
          style={styles.iconBtn}
          accessibilityLabel="Search"
          onPress={() => navigation.navigate("YtSearch")}
        >
          <Ionicons name="search-outline" size={24} color={YT.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {HOME_TABS.map((t) => {
            const active = t.key === tabKey;
            return (
              <TouchableOpacity
                key={t.key}
                onPress={() => setTabKey(t.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {feed.isLoading ? (
        <FeedSkeleton />
      ) : feed.isError && rows.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.message}>Couldn't load videos.</Text>
          <TouchableOpacity style={styles.retry} onPress={refresh}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) => row.key}
          renderItem={({ item }) =>
            item.kind === "shelf" ? (
              <ShortsShelf shorts={item.shorts} startIndex={item.startIndex} onPress={openShort} />
            ) : (
              <VideoCard video={item.video} onPress={openVideo} onMenu={openMenu} />
            )
          }
          initialNumToRender={3}
          maxToRenderPerBatch={4}
          windowSize={7}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews
          onEndReached={loadMore}
          onEndReachedThreshold={1.5}
          refreshControl={
            <RefreshControl refreshing={feed.isRefetching && !feed.isFetchingNextPage} onRefresh={refresh} tintColor={YT.red} />
          }
          ListEmptyComponent={<Text style={[styles.message, styles.empty]}>No videos found.</Text>}
          ListFooterComponent={
            feed.isFetchingNextPage ? (
              <View style={{ paddingVertical: 20 }}>
                <ActivityIndicator color={YT.red} />
              </View>
            ) : (
              <View style={{ height: 16 }} />
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: YT.bg },
  header: { height: 56, flexDirection: "row", alignItems: "center", paddingLeft: 16, paddingRight: 4 },
  brand: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  logo: {
    width: 30,
    height: 22,
    borderRadius: 6,
    backgroundColor: YT.red,
    alignItems: "center",
    justifyContent: "center",
  },
  brandText: { color: YT.text, fontSize: 20, fontWeight: "700", letterSpacing: -0.5 },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  tabsWrap: { height: 48 },
  tabs: { paddingHorizontal: 12, gap: 8, alignItems: "center" },
  chip: { height: 32, paddingHorizontal: 14, borderRadius: 8, backgroundColor: YT.surface, justifyContent: "center" },
  chipActive: { backgroundColor: YT.text },
  chipText: { color: YT.text, fontSize: 14, fontWeight: "500" },
  chipTextActive: { color: YT.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  message: { color: YT.muted, fontSize: 14 },
  empty: { textAlign: "center", marginTop: 40 },
  retry: { backgroundColor: YT.surface, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 18 },
  retryText: { color: YT.text, fontWeight: "600" },
});
