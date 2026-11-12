// YouTube layout — TV Shorts player. A centred 9:16 player over a dimmed,
// blurred thumbnail. ▲ / ▼ = previous / next Short, OK = pause / play,
// ▶ = comments, Back = close comments, then leave. Only the active Short
// mounts a player; its neighbours' streams are prefetched.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, Pressable, StyleSheet, Text, View, useTVEventHandler, useWindowDimensions } from "react-native";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import YtPlayer from "@/YouTube/components/YtPlayer";
import { DEFAULT_SHORTS_QUERY, prefetchStreams } from "@/YouTube/api";
import { useYtShorts } from "@/YouTube/hooks";
import { useYtLibraryStore } from "@/YouTube/store";
import type { YtVideo } from "@/YouTube/types";
import { requestFocus } from "../focusMemory";
import { TV } from "../theme";
import { CommentsPanel } from "./TvYtPanels";
import { appendNew, shortsKey, stepShort } from "./ytWatch";

export function TvYtShortsPlayer({
  initial,
  startIndex = 0,
  query,
  onExit,
}: {
  initial: YtVideo[];
  startIndex?: number;
  query?: string;
  /** Back with no panel open; return true when handled. */
  onExit?: () => boolean;
}) {
  const shorts = useYtShorts(query || DEFAULT_SHORTS_QUERY);
  const [list, setList] = useState<YtVideo[]>(initial);
  useEffect(() => setList((l) => appendNew(l, shorts.data)), [shorts.data]);
  const [index, setIndex] = useState(Math.min(startIndex, Math.max(0, initial.length - 1)));
  const active = list[index];
  const [userPaused, setUserPaused] = useState(false);
  const [comments, setComments] = useState(false);
  const isFocused = useIsFocused();
  const catcherRef = useRef<View | null>(null);
  const { height } = useWindowDimensions();
  const playerH = height - TV.safeY * 2;
  const playerW = Math.round((playerH * 9) / 16);
  const saved = useYtLibraryStore((s) => !!active && s.saved.some((v) => v.id === active.id));

  // Neighbours load ahead; more Shorts are fetched near the end.
  useEffect(() => {
    for (const d of [-1, 1]) {
      const v = list[index + d];
      if (v) prefetchStreams(v.link);
    }
    if (index >= list.length - 3 && shorts.hasNextPage && !shorts.isFetchingNextPage) void shorts.fetchNextPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, list.length]);

  const go = (delta: number) => {
    setIndex((i) => stepShort(i, delta, list.length));
    setUserPaused(false);
  };
  const closeComments = () => {
    setComments(false);
    setTimeout(() => requestFocus(catcherRef), 60);
  };

  const onKey = useRef<(evt: any) => void>(() => {});
  onKey.current = (evt: any) => {
    if (!evt || comments || !isFocused) return;
    switch (shortsKey(evt.eventType, evt.eventKeyAction)) {
      case "prev":
        go(-1);
        return;
      case "next":
        go(1);
        return;
      case "comments":
        setComments(true);
        return;
      case "toggle":
        setUserPaused((p) => !p);
        return;
      default:
        return;
    }
  };
  const handler = useCallback((evt: any) => onKey.current(evt), []);
  useTVEventHandler(handler);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        if (comments) {
          closeComments();
          return true;
        }
        return onExit ? onExit() : false;
      });
      return () => sub.remove();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [comments, onExit]),
  );

  if (!active) {
    return (
      <View style={styles.screen}>
        <Text style={styles.empty}>{shorts.isLoading ? "Loading Shorts…" : "No Shorts to show."}</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Image source={{ uri: active.image }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={30} />
      <View style={[StyleSheet.absoluteFill, styles.dim]} />
      <View style={styles.stage}>
        <YtPlayer
          key={active.id}
          link={active.link}
          poster={active.image}
          controls="none"
          repeat
          resizeMode="cover"
          paused={userPaused || !isFocused}
          style={{ width: playerW, height: playerH, borderRadius: TV.radius }}
        />
        <View style={styles.side}>
          <Text style={styles.title} numberOfLines={4}>
            {active.title}
          </Text>
          <Text style={styles.channel} numberOfLines={1}>
            {[active.channelName, active.views].filter(Boolean).join(" · ")}
          </Text>
          {saved ? <Text style={styles.channel}>Saved</Text> : null}
          <Text style={styles.count}>{`${index + 1} / ${list.length}${shorts.hasNextPage ? "+" : ""}`}</Text>
          <View style={styles.hints}>
            <Text style={styles.hint}>▲ ▼  previous / next</Text>
            <Text style={styles.hint}>OK  {userPaused ? "play" : "pause"}</Text>
            <Text style={styles.hint}>▶  comments</Text>
          </View>
        </View>
      </View>
      {userPaused ? (
        <View style={styles.pausedBadge} pointerEvents="none">
          <Ionicons name="play" size={40} color="#fff" />
        </View>
      ) : null}
      {/* One focus target for the whole screen so the remote keeps working. */}
      {!comments ? (
        <Pressable
          ref={catcherRef}
          focusable
          hasTVPreferredFocus
          style={StyleSheet.absoluteFill}
          onPress={() => setUserPaused((p) => !p)}
          accessibilityLabel={active.title}
        />
      ) : null}
      {comments ? <CommentsPanel link={active.link} onClose={closeComments} /> : null}
    </View>
  );
}

/** Route "TvYtShorts": opened from a Shorts card with the list it came from. */
export default function TvYtShortsScreen({ route }: any) {
  const items: YtVideo[] = useMemo(() => route.params?.items ?? [], [route.params?.items]);
  return <TvYtShortsPlayer initial={items} startIndex={route.params?.startIndex ?? 0} query={route.params?.query} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000" },
  dim: { backgroundColor: "rgba(0,0,0,0.6)" },
  stage: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    paddingVertical: TV.safeY,
  },
  side: { width: 260, gap: 6 },
  title: { color: "#fff", fontSize: TV.text.row, fontWeight: "800" },
  channel: { color: TV.muted, fontSize: TV.text.body, fontWeight: "600" },
  count: { color: TV.muted, fontSize: TV.text.small, marginTop: 8 },
  hints: { marginTop: 16, gap: 4 },
  hint: { color: "rgba(255,255,255,0.7)", fontSize: TV.text.small, fontWeight: "600" },
  pausedBadge: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: { color: TV.muted, fontSize: TV.text.body, textAlign: "center", marginTop: 80 },
});
