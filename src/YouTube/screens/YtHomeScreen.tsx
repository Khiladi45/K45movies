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
import { YT } from "../theme";
import type { YtVideo } from "../types";
import VideoRow from "../components/VideoRow";
import ShortsShelf from "../components/ShortsShelf";

type Row =
  | { kind: "video"; key: string; video: YtVideo }
  | { kind: "shelf"; key: string };

// Where the Shorts shelf sits in the list (after this many videos).
const SHELF_AFTER = 2;

export default function YtHomeScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [tabKey, setTabKey] = useState(HOME_TABS[0].key);
  const tab = HOME_TABS.find((t) => t.key === tabKey) ?? HOME_TABS[0];

  const feed = useYtFeed(tab.filter);
  const shorts = useYtShorts(tab.shortsFilter);

  const rows = useMemo<Row[]>(() => {
    const videos = feed.data ?? [];
    const out: Row[] = videos.map((video) => ({
      kind: "video",
      key: video.id,
      video,
    }));
    if ((shorts.data?.length ?? 0) > 0) {
      out.splice(Math.min(SHELF_AFTER, out.length), 0, { kind: "shelf", key: "shelf" });
    }
    return out;
  }, [feed.data, shorts.data]);

  const openVideo = useCallback(
    (video: YtVideo) => navigation.navigate("YtVideo", { video }),
    [navigation],
  );

  const openShort = useCallback(
    (index: number) =>
      navigation.navigate("Shorts", {
        items: shorts.data ?? [],
        startIndex: index,
        query: tab.shortsFilter,
      }),
    [navigation, shorts.data, tab.shortsFilter],
  );

  const refresh = () => {
    feed.refetch();
    shorts.refetch();
  };

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
          onPress={() => navigation.navigate("Search")}
        >
          <Ionicons name="search-outline" size={24} color={YT.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.iconBtn}
          accessibilityLabel="Settings and profile"
          onPress={() => navigation.navigate("Profile")}
        >
          <Ionicons name="person-circle-outline" size={28} color={YT.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabsWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabs}
        >
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
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {feed.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={YT.red} />
        </View>
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
              <ShortsShelf shorts={shorts.data ?? []} onPress={openShort} />
            ) : (
              <VideoRow video={item.video} onPress={openVideo} />
            )
          }
          refreshControl={
            <RefreshControl
              refreshing={feed.isRefetching}
              onRefresh={refresh}
              tintColor={YT.red}
            />
          }
          ListEmptyComponent={
            <Text style={[styles.message, styles.empty]}>No videos found.</Text>
          }
          contentContainerStyle={{ paddingBottom: 16 }}
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
