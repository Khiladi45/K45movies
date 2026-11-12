// YouTube layout — TV watch page. The player sits top-left (OK = full screen)
// next to the title, channel and Subscribe / Save / Autoplay / Comments, with
// "Up next" below. Full screen adds TvYtControls; the Quality / Captions /
// Speed / Comments panels reuse the player's focus-trapped SidePanel.
// Back: panel → full screen → previous page.
import React, { useCallback, useMemo, useRef, useState } from "react";
import { BackHandler, FlatList, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import YtPlayer, { type YtPlayerHandle, type YtPlayerState } from "@/YouTube/components/YtPlayer";
import { SPEEDS } from "@/YouTube/components/PlayerSettings";
import { useYtWatch } from "@/YouTube/hooks";
import { useYtLibraryStore, useYtSubsStore } from "@/YouTube/store";
import { useYtPlayerStore } from "@/YouTube/playerStore";
import type { YtVideo } from "@/YouTube/types";
import { useThemeStore } from "@/store/useThemeStore";
import Focusable from "../components/Focusable";
import { requestFocus } from "../focusMemory";
import { TV } from "../theme";
import { useRestoreTvFocus } from "../useRestoreTvFocus";
import TvYtControls, { type TvYtPanelKind } from "./TvYtControls";
import { CommentsPanel, OptionsPanel, type TvYtOption } from "./TvYtPanels";
import { useOpenYt } from "./TvYtHomeScreen";
import { YtShortCard, YtVideoCard } from "./YtTvCards";
import { createBus, nextAutoplay } from "./ytWatch";

const PLAYER_W = 480;
const PLAYER_H = 270;
const MAX_RELATED = 24;

export default function TvYtVideoScreen({ route }: any) {
  const first: YtVideo = route.params?.video;
  const startAt: number = route.params?.startAt ?? 0;
  const [current, setCurrent] = useState<YtVideo>(first);
  const isFocused = useIsFocused();
  const primaryColor = useThemeStore((s) => s.primaryColor);
  const watch = useYtWatch(current, current?.link || "");
  const info = watch.data?.video ? { ...current, ...watch.data.video } : current;
  const related = useMemo(() => (watch.data?.related ?? []).slice(0, MAX_RELATED), [watch.data]);
  const next = nextAutoplay(related, current?.id);
  const { openShorts } = useOpenYt();

  const playerRef = useRef<YtPlayerHandle | null>(null);
  const bus = useMemo(() => createBus<YtPlayerState | null>(null), []);
  const [fullscreen, setFullscreen] = useState(false);
  const [panel, setPanel] = useState<TvYtPanelKind | null>(null);
  const boxRef = useRef<View | null>(null);
  const commentsRef = useRef<View | null>(null);
  useRestoreTvFocus(boxRef);

  const saved = useYtLibraryStore((s) => s.saved.some((v) => v.id === current?.id));
  const toggleSaved = useYtLibraryStore((s) => s.toggleSaved);
  const subscribed = useYtSubsStore((s) => !!info?.channelName && s.channels.includes(info.channelName));
  const toggleSub = useYtSubsStore((s) => s.toggle);
  const autoplay = useYtPlayerStore((s) => s.autoplay);
  const toggleAutoplay = useYtPlayerStore((s) => s.toggleAutoplay);

  const focusBox = () => setTimeout(() => requestFocus(boxRef), 80);
  const exitFullscreen = () => {
    setFullscreen(false);
    focusBox();
  };
  const closePanel = () => {
    const wasComments = panel === "comments";
    setPanel(null);
    if (!fullscreen && wasComments) setTimeout(() => requestFocus(commentsRef), 60);
  };
  const playVideo = (video: YtVideo) => {
    setCurrent(video);
    bus.emit(null);
    if (!fullscreen) focusBox();
  };

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        if (panel) {
          closePanel();
          return true;
        }
        if (fullscreen) {
          exitFullscreen();
          return true;
        }
        return false;
      });
      return () => sub.remove();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [panel, fullscreen]),
  );

  const onEnd = () => {
    if (autoplay && next) playVideo(next);
  };

  const panelOptions = (kind: TvYtPanelKind): { title: string; note?: string; options: TvYtOption[] } => {
    const st = bus.get();
    const player = playerRef.current;
    if (kind === "quality") {
      return {
        title: "Quality",
        note: st?.canPickQuality ? undefined : "This video only offers automatic quality.",
        options: [
          { key: "auto", label: "Auto", detail: st?.playingHeight ? `Now ${st.playingHeight}p` : undefined, selected: !st?.height, onPress: () => player?.setQuality?.(0) },
          ...(st?.canPickQuality ? st.qualities : []).map((q) => ({
            key: String(q.height),
            label: q.label,
            selected: st?.height === q.height,
            onPress: () => player?.setQuality?.(q.height),
          })),
        ],
      };
    }
    if (kind === "captions") {
      return {
        title: "Captions",
        options: [
          { key: "off", label: "Off", selected: (st?.caption ?? -1) < 0, onPress: () => player?.setCaption?.(-1) },
          ...(st?.captions ?? []).map((c, i) => ({
            key: `${c.language}-${i}`,
            label: c.title || c.language,
            selected: st?.caption === i,
            onPress: () => player?.setCaption?.(i),
          })),
        ],
      };
    }
    return {
      title: "Speed",
      options: SPEEDS.map((r) => ({
        key: String(r),
        label: r === 1 ? "Normal" : `${r}x`,
        selected: (st?.speed ?? 1) === r,
        onPress: () => player?.setSpeed?.(r),
      })),
    };
  };

  if (!current) return <View style={styles.screen} />;

  const playerStyle = fullscreen ? StyleSheet.absoluteFill : styles.smallPlayer;
  const shortsInRelated = related.filter((r) => r.isShort);

  return (
    <View style={styles.screen}>
      <YtPlayer
        key={current.id}
        ref={playerRef}
        link={current.link}
        poster={current.image}
        title={info.title}
        channel={info.channelName}
        controls="none"
        streamInfo
        active
        paused={!isFocused}
        startAt={current.id === first?.id ? startAt : 0}
        fullscreen={fullscreen}
        style={playerStyle}
        onStateChange={bus.emit}
        onEnd={onEnd}
      />

      {!fullscreen ? (
        <View style={StyleSheet.absoluteFill}>
          <View style={styles.top}>
            {/* Transparent focus frame over the player: OK = full screen. */}
            <Focusable
              ref={boxRef}
              hasTVPreferredFocus
              style={styles.frame}
              onPress={() => setFullscreen(true)}
              accessibilityLabel="Full screen"
            >
              {(focused) =>
                focused ? (
                  <View style={styles.frameHint}>
                    <Ionicons name="expand" size={14} color="#fff" />
                    <Text style={styles.frameHintText}>OK for full screen</Text>
                  </View>
                ) : null
              }
            </Focusable>
            <View style={styles.info}>
              <Text style={styles.title} numberOfLines={3}>
                {info.title}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {[info.channelName, info.views, info.publishedTime, watch.data?.likes ? `👍 ${watch.data.likes}` : ""]
                  .filter(Boolean)
                  .join("  ·  ")}
              </Text>
              <View style={styles.actions}>
                {info.channelName ? (
                  <Focusable
                    style={[styles.button, !subscribed && { backgroundColor: primaryColor }]}
                    onPress={() => toggleSub(info.channelName)}
                  >
                    <Text style={styles.buttonText}>{subscribed ? "Subscribed" : "Subscribe"}</Text>
                  </Focusable>
                ) : null}
                <Focusable style={styles.button} onPress={() => toggleSaved(current)}>
                  <Ionicons name={saved ? "bookmark" : "bookmark-outline"} size={16} color="#fff" />
                  <Text style={styles.buttonText}>{saved ? "Saved" : "Save"}</Text>
                </Focusable>
                <Focusable style={styles.button} onPress={toggleAutoplay}>
                  <Ionicons name={autoplay ? "toggle" : "toggle-outline"} size={18} color="#fff" />
                  <Text style={styles.buttonText}>Autoplay {autoplay ? "on" : "off"}</Text>
                </Focusable>
                <Focusable ref={commentsRef} style={styles.button} onPress={() => setPanel("comments")}>
                  <Ionicons name="chatbubble-outline" size={16} color="#fff" />
                  <Text style={styles.buttonText}>Comments</Text>
                </Focusable>
              </View>
              {watch.data?.description ? (
                <Text style={styles.description} numberOfLines={4}>
                  {watch.data.description}
                </Text>
              ) : null}
            </View>
          </View>

          <Text style={styles.section}>Up next</Text>
          {watch.isLoading ? (
            <Text style={styles.muted}>Loading…</Text>
          ) : related.length === 0 ? (
            <Text style={styles.muted}>Nothing related found.</Text>
          ) : (
            <FlatList
              horizontal
              data={related}
              keyExtractor={(v) => v.id}
              removeClippedSubviews={false}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.related}
              renderItem={({ item }) =>
                item.isShort ? (
                  <YtShortCard
                    video={item}
                    onPress={(v) => openShorts(shortsInRelated, Math.max(0, shortsInRelated.indexOf(v)))}
                  />
                ) : (
                  <YtVideoCard video={item} onPress={playVideo} />
                )
              }
            />
          )}
        </View>
      ) : (
        <TvYtControls
          player={playerRef}
          bus={bus}
          title={info.title}
          channel={info.channelName}
          hasNext={!!next}
          onNext={() => next && playVideo(next)}
          onPanel={setPanel}
          panelOpen={!!panel}
        />
      )}

      {panel === "comments" ? (
        <CommentsPanel link={current.link} onClose={closePanel} />
      ) : panel ? (
        <OptionsPanel {...panelOptions(panel)} onClose={closePanel} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: TV.bg },
  smallPlayer: {
    position: "absolute",
    left: TV.safeX,
    top: TV.safeY,
    width: PLAYER_W,
    height: PLAYER_H,
    borderRadius: TV.radius,
  },
  top: { flexDirection: "row", gap: 20, paddingHorizontal: TV.safeX, paddingTop: TV.safeY },
  frame: { width: PLAYER_W, height: PLAYER_H, justifyContent: "flex-end", backgroundColor: "transparent" },
  frameHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    margin: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 4,
  },
  frameHintText: { color: "#fff", fontSize: TV.text.small, fontWeight: "700" },
  info: { flex: 1 },
  title: { color: "#fff", fontSize: TV.text.title, fontWeight: "800" },
  meta: { color: TV.muted, fontSize: TV.text.body, marginTop: 6, fontWeight: "600" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14 },
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    height: 36,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  buttonText: { color: "#fff", fontSize: TV.text.body, fontWeight: "700" },
  description: { color: "rgba(255,255,255,0.75)", fontSize: TV.text.small, marginTop: 12, lineHeight: 16 },
  section: {
    color: "#fff",
    fontSize: TV.text.row,
    fontWeight: "700",
    marginTop: 18,
    marginBottom: 8,
    marginLeft: TV.safeX,
  },
  related: { gap: TV.gap, paddingHorizontal: TV.safeX, paddingVertical: 6 },
  muted: { color: TV.muted, fontSize: TV.text.body, marginLeft: TV.safeX },
});
