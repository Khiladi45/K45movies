import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  BackHandler,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useYtComments, useYtWatch } from "../hooks";
import { useYtLibraryStore } from "../store";
import { useYtPlayerStore, useYtUiStore } from "../playerStore";
import { YT } from "../theme";
import type { YtVideo } from "../types";
import { lockOrientation, notify, setImmersive, shareVideo, unlockOrientation } from "../utils";
import YtPlayer, { YtPlayerHandle } from "../components/YtPlayer";
import VideoRow from "../components/VideoRow";
import CommentsSheet from "../components/CommentsSheet";
import { RowSkeleton } from "../components/Skeletons";

type Params = {
  video?: YtVideo;
  /** Used when only a link is known (e.g. a downloaded file). */
  link?: string;
  title?: string;
  /** Local file to play instead of streaming. */
  localUri?: string;
  /** Resume position in seconds (from the mini player). */
  startAt?: number;
};

const ROW_H = 110;

export default function YtVideoScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const params: Params = route.params ?? {};
  const playerRef = useRef<YtPlayerHandle>(null);

  const [current, setCurrent] = useState<YtVideo | undefined>(params.video);
  const link = current?.link ?? params.link ?? "";
  const [expanded, setExpanded] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);

  const openMenu = useYtUiStore((s) => s.openMenu);
  const openDownload = useYtUiStore((s) => s.openDownload);
  const setMini = useYtPlayerStore((s) => s.setMini);
  const clearMini = useYtPlayerStore((s) => s.clearMini);

  const watch = useYtWatch(current, link, !params.localUri);
  const video: YtVideo | undefined = watch.data?.video ?? current;
  const title = video?.title ?? params.title ?? "Video";
  const related = watch.data?.related ?? [];
  const comments = useYtComments(link, undefined, !params.localUri && !!link);
  const commentCount = comments.data?.pages[0]?.count;
  const firstComment = comments.data?.pages[0]?.comments[0];

  const saved = useYtLibraryStore((s) => (video ? s.isSaved(video.id) : false));
  const toggleSaved = useYtLibraryStore((s) => s.toggleSaved);
  const [liked, setLiked] = useState(false);

  // Opening the page takes over from the mini player.
  useEffect(() => {
    clearMini();
  }, [clearMini]);

  useEffect(() => {
    setLiked(false);
    setExpanded(false);
  }, [link]);

  // Fullscreen = landscape, no status bar, no navigation bar.
  useEffect(() => {
    if (!fullscreen) return;
    lockOrientation(true);
    setImmersive(true);
    return () => {
      setImmersive(false);
      lockOrientation(false);
    };
  }, [fullscreen]);

  // Leave the orientation as the app had it.
  useEffect(
    () => () => {
      setImmersive(false);
      unlockOrientation();
    },
    [],
  );

  useEffect(() => {
    if (!fullscreen) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      setFullscreen(false);
      return true;
    });
    return () => sub.remove();
  }, [fullscreen]);

  const minimize = useCallback(() => {
    if (fullscreen) setFullscreen(false);
    if (video && !params.localUri) setMini(video, playerRef.current?.position() ?? 0);
    navigation.goBack();
  }, [fullscreen, video, params.localUri, setMini, navigation]);

  const play = useCallback((item: YtVideo) => {
    if (item.isShort) {
      navigation.navigate("Tabs", { screen: "Shorts", params: { items: [item], startIndex: 0 } });
    } else {
      setCurrent(item);
    }
  }, [navigation]);

  // Autoplay: when this video ends, the first related video starts.
  const playNext = useCallback(() => {
    const next = related.find((r) => !r.isShort);
    if (next) setCurrent(next);
  }, [related]);

  const meta = [video?.views, video?.publishedTime].filter(Boolean).join(" · ");
  const playerHeight = Math.round((width * 9) / 16);

  const header = (
    <View>
      <View style={styles.block}>
        <Text style={styles.title}>{title}</Text>
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
        {watch.data?.description ? (
          <TouchableOpacity activeOpacity={0.8} onPress={() => setExpanded((v) => !v)}>
            <Text style={styles.desc} numberOfLines={expanded ? undefined : 2}>
              {watch.data.description}
            </Text>
            <Text style={styles.more}>{expanded ? "Show less" : "...more"}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.channelRow}>
        {video?.channelAvatar ? (
          <Image source={{ uri: video.channelAvatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Ionicons name="person" size={20} color={YT.muted} />
          </View>
        )}
        <Text style={styles.channel} numberOfLines={1}>
          {video?.channelName || "Channel"}
        </Text>
      </View>

      <View style={styles.actions}>
        <Action
          icon={liked ? "thumbs-up" : "thumbs-up-outline"}
          label={watch.data?.likes || "Like"}
          active={liked}
          onPress={() => setLiked((v) => !v)}
        />
        <Action icon="arrow-redo-outline" label="Share" onPress={() => video && shareVideo(video)} />
        {!params.localUri ? (
          <Action icon="download-outline" label="Download" onPress={() => video && openDownload(video)} />
        ) : null}
        <Action
          icon={saved ? "bookmark" : "bookmark-outline"}
          label={saved ? "Saved" : "Save"}
          active={saved}
          onPress={() => video && notify(toggleSaved(video) ? "Saved to Watchlist" : "Removed from Watchlist")}
        />
      </View>

      {!params.localUri ? (
        <TouchableOpacity style={styles.commentsCard} activeOpacity={0.8} onPress={() => setCommentsOpen(true)}>
          <Text style={styles.commentsHead}>
            Comments{commentCount ? `  ${commentCount}` : ""}
          </Text>
          {comments.isLoading ? (
            <View style={styles.skeletonLine} />
          ) : firstComment ? (
            <Text style={styles.commentPreview} numberOfLines={2}>
              {firstComment.text}
            </Text>
          ) : (
            <Text style={styles.commentPreview}>Tap to view comments</Text>
          )}
        </TouchableOpacity>
      ) : null}

      {!params.localUri ? <Text style={styles.relatedTitle}>Related videos</Text> : null}
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: fullscreen ? 0 : insets.top }]}>
      <View style={fullscreen ? styles.full : { width, height: playerHeight }}>
        <YtPlayer
          ref={playerRef}
          link={link}
          localUri={params.localUri}
          controls="full"
          zoomable
          fullscreen={fullscreen}
          startAt={params.startAt}
          style={StyleSheet.absoluteFill}
          onEnd={playNext}
          onNext={related.length ? playNext : undefined}
          onToggleFullscreen={() => setFullscreen((v) => !v)}
          onMinimize={minimize}
        />
      </View>

      <FlatList
        data={params.localUri ? [] : related}
        keyExtractor={(v) => v.id}
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <VideoRow
            video={item}
            onPress={play}
            right={
              <TouchableOpacity hitSlop={10} onPress={() => openMenu(item)} accessibilityLabel="More options">
                <Ionicons name="ellipsis-vertical" size={18} color={YT.text} />
              </TouchableOpacity>
            }
          />
        )}
        getItemLayout={(_, index) => ({ length: ROW_H, offset: ROW_H * index, index })}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={9}
        removeClippedSubviews
        ListEmptyComponent={
          params.localUri ? null : watch.isLoading ? (
            <RowSkeleton />
          ) : (
            <Text style={styles.none}>No related videos found.</Text>
          )
        }
        ListFooterComponent={<View style={{ height: insets.bottom + 24 }} />}
      />

      <CommentsSheet visible={commentsOpen} onClose={() => setCommentsOpen(false)} link={link} />
    </View>
  );
}

function Action({
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
    <TouchableOpacity style={styles.action} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name={icon} size={22} color={active ? YT.blue : YT.text} />
      <Text style={[styles.actionText, active && { color: YT.blue }]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: YT.bg },
  full: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 20, backgroundColor: "#000" },
  block: { paddingHorizontal: 12, paddingTop: 12 },
  title: { color: YT.text, fontSize: 18, fontWeight: "700", lineHeight: 24 },
  meta: { color: YT.muted, fontSize: 12, paddingTop: 4 },
  desc: { color: YT.text, fontSize: 13, lineHeight: 18, paddingTop: 8 },
  more: { color: YT.muted, fontSize: 13, paddingTop: 2 },
  channelRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingTop: 14 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: YT.surface },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  channel: { flex: 1, color: YT.text, fontSize: 14, fontWeight: "500" },
  actions: { flexDirection: "row", paddingHorizontal: 8, paddingTop: 14, paddingBottom: 6 },
  action: { flex: 1, alignItems: "center", gap: 4, paddingVertical: 6 },
  actionText: { color: YT.text, fontSize: 12 },
  commentsCard: { marginHorizontal: 12, marginTop: 8, padding: 12, borderRadius: 12, backgroundColor: YT.surfaceAlt, gap: 6 },
  commentsHead: { color: YT.text, fontSize: 14, fontWeight: "700" },
  commentPreview: { color: YT.text, fontSize: 13, lineHeight: 18 },
  skeletonLine: { height: 12, width: "70%", borderRadius: 4, backgroundColor: "#2a2a2a" },
  relatedTitle: { color: YT.text, fontSize: 16, fontWeight: "700", paddingHorizontal: 12, paddingTop: 18, paddingBottom: 6 },
  none: { color: YT.muted, fontSize: 13, paddingHorizontal: 12 },
});
