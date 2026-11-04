import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  ViewToken,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsFocused, useNavigation, useRoute } from "@react-navigation/native";
import { DEFAULT_SHORTS_QUERY, fetchShorts } from "../api";
import { useYtShorts, useYtWatch } from "../hooks";
import { useYtLibraryStore } from "../store";
import type { YtVideo } from "../types";
import { notify, shareVideo } from "../utils";
import YtPlayer from "../components/YtPlayer";

type ItemProps = {
  video: YtVideo;
  height: number;
  /** True for the Short currently on screen (and the screen is focused). */
  playing: boolean;
  /** True for the current Short and its neighbours, which pre-resolve streams. */
  near: boolean;
  topInset: number;
};

const ShortItem = memo(function ShortItem({ video, height, playing, near, topInset }: ItemProps) {
  const navigation = useNavigation<any>();
  const [userPaused, setUserPaused] = useState(false);
  const [liked, setLiked] = useState(false);
  const saved = useYtLibraryStore((s) => s.isSaved(video.id));
  const toggleSaved = useYtLibraryStore((s) => s.toggleSaved);

  // Channel and description are only fetched for the Short on screen.
  const watch = useYtWatch(video, video.link, playing);
  const channel = watch.data?.video.channelName || video.channelName || "YouTube";
  const description = watch.data?.description?.trim() || video.title;

  useEffect(() => {
    if (!playing) setUserPaused(false);
  }, [playing]);

  return (
    <View style={{ height, backgroundColor: "#000" }}>
      {near ? (
        <YtPlayer
          link={video.link}
          active={near}
          paused={!playing || userPaused}
          repeat
          resizeMode="cover"
          style={StyleSheet.absoluteFill}
        />
      ) : null}

      <TouchableWithoutFeedback onPress={() => setUserPaused((v) => !v)}>
        <View style={StyleSheet.absoluteFill}>
          {userPaused && playing ? (
            <View style={styles.pauseWrap} pointerEvents="none">
              <Ionicons name="play" size={64} color="rgba(255,255,255,0.85)" />
            </View>
          ) : null}
        </View>
      </TouchableWithoutFeedback>

      <View style={[styles.rail, { bottom: 24 }]}>
        <RailButton
          icon={liked ? "thumbs-up" : "thumbs-up-outline"}
          label="Like"
          active={liked}
          onPress={() => setLiked((v) => !v)}
        />
        <RailButton
          icon="chatbubble-ellipses-outline"
          label="Comment"
          onPress={() => notify("Comments aren't available here")}
        />
        <RailButton
          icon={saved ? "bookmark" : "bookmark-outline"}
          label={saved ? "Saved" : "Save"}
          onPress={() =>
            notify(toggleSaved(video) ? "Saved to Watchlist" : "Removed from Watchlist")
          }
        />
        <RailButton icon="arrow-redo-outline" label="Share" onPress={() => shareVideo(video)} />
      </View>

      <View style={[styles.bottom, { bottom: 24 }]} pointerEvents="none">
        <Text style={styles.channel} numberOfLines={1}>
          {channel}
        </Text>
        <Text style={styles.desc} numberOfLines={2}>
          {description}
        </Text>
      </View>
    </View>
  );
});

function RailButton({
  icon,
  label,
  onPress,
  active,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  active?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.railBtn} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <View style={styles.railIcon}>
        <Ionicons name={icon} size={24} color={active ? "#3ea6ff" : "#fff"} />
      </View>
      <Text style={styles.railLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function YtShortsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const params = route.params ?? {};
  const query: string = params.query || DEFAULT_SHORTS_QUERY;

  const feed = useYtShorts(query);
  const [more, setMore] = useState<YtVideo[]>([]);
  const page = useRef(1);
  const exhausted = useRef(false);
  const loadingMore = useRef(false);

  const items = useMemo(() => {
    const seen = new Set<string>();
    const out: YtVideo[] = [];
    const source = [
      ...(Array.isArray(params.items) && params.items.length ? params.items : feed.data ?? []),
      ...more,
    ];
    for (const v of source) {
      if (!seen.has(v.id)) {
        seen.add(v.id);
        out.push(v);
      }
    }
    return out;
  }, [params.items, feed.data, more]);

  const [height, setHeight] = useState(0);
  const [activeIndex, setActiveIndex] = useState<number>(params.startIndex ?? 0);
  const listRef = useRef<FlatList<YtVideo>>(null);

  // Opening a Short from the Home shelf while this tab is already mounted.
  useEffect(() => {
    const start = params.startIndex ?? 0;
    setActiveIndex(start);
    if (height > 0) {
      listRef.current?.scrollToOffset({ offset: start * height, animated: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.startIndex, params.items]);

  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems.find((v) => v.isViewable && v.index != null);
    if (first?.index != null) setActiveIndex(first.index);
  }).current;
  const viewConfig = useRef({ itemVisiblePercentThreshold: 80 }).current;

  const loadMore = useCallback(async () => {
    if (loadingMore.current || exhausted.current) return;
    loadingMore.current = true;
    try {
      page.current += 1;
      const next = await fetchShorts(query, page.current);
      const known = new Set(items.map((v) => v.id));
      const fresh = next.filter((v) => !known.has(v.id));
      // The provider repeats its last page once it runs out.
      if (fresh.length === 0) exhausted.current = true;
      else setMore((prev) => [...prev, ...fresh]);
    } catch {
      exhausted.current = true;
    } finally {
      loadingMore.current = false;
    }
  }, [items, query]);

  return (
    <View
      style={styles.root}
      onLayout={(e) => setHeight(Math.round(e.nativeEvent.layout.height))}
    >
      {height > 0 && items.length > 0 ? (
        <FlatList
          ref={listRef}
          data={items}
          keyExtractor={(v) => v.id}
          pagingEnabled
          snapToInterval={height}
          snapToAlignment="start"
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          initialScrollIndex={Math.min(params.startIndex ?? 0, items.length - 1)}
          getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
          windowSize={3}
          maxToRenderPerBatch={2}
          initialNumToRender={1}
          removeClippedSubviews
          onViewableItemsChanged={onViewable}
          viewabilityConfig={viewConfig}
          onEndReachedThreshold={2}
          onEndReached={loadMore}
          renderItem={({ item, index }) => (
            <ShortItem
              video={item}
              height={height}
              playing={focused && index === activeIndex}
              near={Math.abs(index - activeIndex) <= 1}
              topInset={insets.top}
            />
          )}
        />
      ) : feed.isLoading ? (
        <View style={styles.center}>
          <Text style={styles.msg}>Loading Shorts…</Text>
        </View>
      ) : height > 0 ? (
        <View style={styles.center}>
          <Text style={styles.msg}>No Shorts found.</Text>
          <TouchableOpacity style={styles.retry} onPress={() => feed.refetch()}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={[styles.top, { paddingTop: insets.top }]} pointerEvents="box-none">
        <Text style={styles.topTitle}>Shorts</Text>
        <TouchableOpacity
          style={styles.topBtn}
          accessibilityLabel="Search"
          onPress={() => navigation.navigate("Search")}
        >
          <Ionicons name="search-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  msg: { color: "#fff", fontSize: 14 },
  retry: { backgroundColor: "#272727", paddingHorizontal: 18, paddingVertical: 10, borderRadius: 18 },
  retryText: { color: "#fff", fontWeight: "600" },
  top: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 16,
    paddingRight: 4,
  },
  topTitle: { flex: 1, color: "#fff", fontSize: 20, fontWeight: "700", paddingVertical: 12 },
  topBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  pauseWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  rail: { position: "absolute", right: 8, width: 56, alignItems: "center", gap: 18 },
  railBtn: { width: 56, alignItems: "center", gap: 4 },
  railIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  railLabel: { color: "#fff", fontSize: 12, fontWeight: "500" },
  bottom: { position: "absolute", left: 12, right: 84, gap: 8 },
  channel: { color: "#fff", fontSize: 15, fontWeight: "700" },
  desc: { color: "#fff", fontSize: 14, lineHeight: 19 },
});
