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
import { useYtLibraryStore, useYtSubsStore } from "../store";
import { useYtPlayerStore, useYtUiStore } from "../playerStore";
import { YT } from "../theme";
import type { YtVideo } from "../types";
import {
  lockOrientation,
  notify,
  restoreBrightness,
  setImmersive,
  shareVideo,
  unlockOrientation,
} from "../utils";
import YtPlayer, { YtPlayerHandle } from "../components/YtPlayer";
import VideoCard from "../components/VideoCard";
import CommentsSheet from "../components/CommentsSheet";
import YtSheet from "../components/YtSheet";
import { FeedSkeleton } from "../components/Skeletons";

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

type IconName = React.ComponentProps<typeof Ionicons>["name"];

export default function YtVideoScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { width, height: winHeight } = useWindowDimensions();
  const params: Params = route.params ?? {};
  const playerRef = useRef<YtPlayerHandle>(null);

  const [current, setCurrent] = useState<YtVideo | undefined>(params.video);
  const link = current?.link ?? params.link ?? "";
  const [fullscreen, setFullscreen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  const openMenu = useYtUiStore((s) => s.openMenu);
  const openDownload = useYtUiStore((s) => s.openDownload);
  const setMini = useYtPlayerStore((s) => s.setMini);
  const clearMini = useYtPlayerStore((s) => s.clearMini);
  const autoplay = useYtPlayerStore((s) => s.autoplay);

  const watch = useYtWatch(current, link, !params.localUri);
  const video: YtVideo | undefined = watch.data?.video ?? current;
  const title = video?.title ?? params.title ?? "Video";
  const related = watch.data?.related ?? [];
  const comments = useYtComments(link, undefined, !params.localUri && !!link);
  const commentCount = comments.data?.pages[0]?.count;
  const firstComment = comments.data?.pages[0]?.comments[0];

  const saved = useYtLibraryStore((s) => (video ? s.isSaved(video.id) : false));
  const toggleSaved = useYtLibraryStore((s) => s.toggleSaved);
  const subscribed = useYtSubsStore((s) => (video?.channelName ? s.channels.includes(video.channelName) : false));
  const toggleSub = useYtSubsStore((s) => s.toggle);
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);

  useEffect(() => {
    clearMini();
  }, [clearMini]);

  useEffect(() => {
    setLiked(false);
    setDisliked(false);
    setInfoOpen(false);
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

  useEffect(
    () => () => {
      setImmersive(false);
      unlockOrientation();
      restoreBrightness();
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

  const play = useCallback(
    (item: YtVideo) => {
      if (item.isShort) navigation.navigate("Tabs", { screen: "Shorts", params: { items: [item], startIndex: 0 } });
      else setCurrent(item);
    },
    [navigation],
  );

  const nextVideo = related.find((r) => !r.isShort);
  const playNext = useCallback(() => {
    if (nextVideo) setCurrent(nextVideo);
  }, [nextVideo]);
  // Only autoplay when the toggle is on.
  const onEnd = useCallback(() => {
    if (autoplay) playNext();
  }, [autoplay, playNext]);

  const meta = [video?.views, video?.publishedTime].filter(Boolean).join("  ");
  const likes = watch.data?.likes;
  const playerHeight = Math.round((width * 9) / 16);

  const fullscreenExtra = (
    <View style={styles.fsRow}>
      <View style={styles.fsActions}>
        <Glyph icon={liked ? "thumbs-up" : "thumbs-up-outline"} onPress={() => { setLiked((v) => !v); setDisliked(false); }} />
        <Glyph icon={disliked ? "thumbs-down" : "thumbs-down-outline"} onPress={() => { setDisliked((v) => !v); setLiked(false); }} />
        <Glyph icon="chatbox-ellipses-outline" onPress={() => { setFullscreen(false); setCommentsOpen(true); }} />
        <Glyph icon={saved ? "bookmark" : "bookmark-outline"} onPress={() => video && notify(toggleSaved(video) ? "Saved to Watchlist" : "Removed from Watchlist")} />
        <Glyph icon="arrow-redo-outline" onPress={() => video && shareVideo(video)} />
      </View>
      {nextVideo ? (
        <TouchableOpacity style={styles.moreVideos} onPress={() => setFullscreen(false)} accessibilityLabel="More videos">
          <Text style={styles.moreText}>More videos</Text>
          <Image source={{ uri: nextVideo.image }} style={styles.moreThumb} contentFit="cover" />
        </TouchableOpacity>
      ) : null}
    </View>
  );

  const header = (
    <View>
      <TouchableOpacity activeOpacity={0.85} onPress={() => setInfoOpen(true)} style={styles.block}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta} numberOfLines={1}>
            {[video?.channelName ? `${video.channelName}` : "", likes ? `${likes} likes` : "", meta].filter(Boolean).join("  ")}
          </Text>
          <Text style={styles.moreLink}>  more</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.channelRow}>
        {video?.channelAvatar ? (
          <Image source={{ uri: video.channelAvatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Ionicons name="person" size={20} color={YT.muted} />
          </View>
        )}
        <TouchableOpacity
          style={[styles.subscribe, subscribed && styles.subscribed]}
          onPress={() => {
            if (!video?.channelName) return;
            notify(toggleSub(video.channelName) ? `Subscribed to ${video.channelName}` : "Unsubscribed");
          }}
          accessibilityRole="button"
        >
          <Text style={[styles.subscribeText, subscribed && { color: YT.text }]}>{subscribed ? "Subscribed" : "Subscribe"}</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <Glyph icon={liked ? "thumbs-up" : "thumbs-up-outline"} onPress={() => { setLiked((v) => !v); setDisliked(false); }} active={liked} />
        <Glyph icon={disliked ? "thumbs-down" : "thumbs-down-outline"} onPress={() => { setDisliked((v) => !v); setLiked(false); }} active={disliked} />
        <Glyph icon="arrow-redo-outline" onPress={() => video && shareVideo(video)} />
        {!params.localUri ? <Glyph icon="download-outline" onPress={() => video && openDownload(video)} /> : null}
        <Glyph icon="ellipsis-horizontal" onPress={() => video && openMenu(video)} />
      </View>

      {!params.localUri ? (
        <TouchableOpacity style={styles.commentsCard} activeOpacity={0.8} onPress={() => setCommentsOpen(true)}>
          <Text style={styles.commentsHead}>
            Comments{commentCount ? <Text style={styles.commentsCount}>  {commentCount}</Text> : null}
          </Text>
          {comments.isLoading ? (
            <View style={styles.skeletonLine} />
          ) : firstComment ? (
            <View style={styles.preview}>
              {firstComment.authorAvatar ? (
                <Image source={{ uri: firstComment.authorAvatar }} style={styles.previewAvatar} />
              ) : (
                <View style={[styles.previewAvatar, styles.avatarFallback]} />
              )}
              <Text style={styles.commentPreview} numberOfLines={2}>
                {firstComment.text}
              </Text>
            </View>
          ) : (
            <Text style={styles.commentPreview}>Tap to view comments</Text>
          )}
        </TouchableOpacity>
      ) : null}

      {!params.localUri && watch.isLoading ? <FeedSkeleton count={2} /> : null}
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
          poster={video?.image}
          title={title}
          channel={video?.channelName}
          extra={fullscreenExtra}
          style={StyleSheet.absoluteFill}
          onEnd={onEnd}
          onNext={nextVideo ? playNext : undefined}
          onToggleFullscreen={() => setFullscreen((v) => !v)}
          onMinimize={minimize}
        />
      </View>

      <FlatList showsHorizontalScrollIndicator={false}
        data={params.localUri ? [] : related}
        keyExtractor={(v) => v.id}
        ListHeaderComponent={header}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => <VideoCard video={item} onPress={play} onMenu={openMenu} />}
        initialNumToRender={3}
        maxToRenderPerBatch={4}
        windowSize={7}
        removeClippedSubviews
        ListEmptyComponent={
          params.localUri || watch.isLoading ? null : <Text style={styles.none}>No related videos found.</Text>
        }
        ListFooterComponent={<View style={{ height: insets.bottom + 24 }} />}
      />

      <CommentsSheet visible={commentsOpen} onClose={() => setCommentsOpen(false)} link={link} />

      <YtSheet visible={infoOpen} onClose={() => setInfoOpen(false)} title="Description" heightRatio={Math.min(0.7, 560 / winHeight)}>
        <View style={{ flex: 1 }}>
          <FlatList showsHorizontalScrollIndicator={false}
            data={[0]}
            keyExtractor={() => "d"}
            showsVerticalScrollIndicator={false}
            renderItem={() => (
              <View style={{ padding: 16, gap: 10 }}>
                <Text style={styles.infoTitle}>{title}</Text>
                <Text style={styles.meta}>
                  {[likes ? `${likes} likes` : "", video?.views, video?.publishedTime].filter(Boolean).join("  ·  ")}
                </Text>
                <Text style={styles.infoBody}>{watch.data?.description || "No description."}</Text>
              </View>
            )}
          />
        </View>
      </YtSheet>
    </View>
  );
}

function Glyph({ icon, onPress, active }: { icon: IconName; onPress: () => void; active?: boolean }) {
  return (
    <TouchableOpacity style={styles.glyph} onPress={onPress} accessibilityRole="button" hitSlop={4}>
      <Ionicons name={icon} size={24} color={active ? YT.blue : YT.text} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: YT.bg },
  full: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 20, backgroundColor: "#000" },
  block: { paddingHorizontal: 12, paddingTop: 12 },
  title: { color: YT.text, fontSize: 18, fontWeight: "700" },
  metaRow: { flexDirection: "row", alignItems: "center", paddingTop: 4 },
  meta: { flexShrink: 1, color: YT.muted, fontSize: 13 },
  moreLink: { color: YT.text, fontSize: 13, fontWeight: "600" },
  channelRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: YT.surface, marginRight: 6 },
  avatarFallback: { alignItems: "center", justifyContent: "center", backgroundColor: "#3a3a3a" },
  subscribe: { height: 36, paddingHorizontal: 16, borderRadius: 18, backgroundColor: "#f1f1f1", alignItems: "center", justifyContent: "center" },
  subscribed: { backgroundColor: YT.surface },
  subscribeText: { color: "#0f0f0f", fontSize: 14, fontWeight: "600" },
  glyph: { width: 38, height: 40, alignItems: "center", justifyContent: "center" },
  commentsCard: { marginHorizontal: 12, marginTop: 10, marginBottom: 14, padding: 12, borderRadius: 12, backgroundColor: YT.surfaceAlt, gap: 8 },
  commentsHead: { color: YT.text, fontSize: 15, fontWeight: "600" },
  commentsCount: { color: YT.muted, fontSize: 13, fontWeight: "400" },
  preview: { flexDirection: "row", alignItems: "center", gap: 10 },
  previewAvatar: { width: 26, height: 26, borderRadius: 13 },
  commentPreview: { flex: 1, color: YT.text, fontSize: 13, lineHeight: 18 },
  skeletonLine: { height: 12, width: "70%", borderRadius: 4, backgroundColor: "#2a2a2a" },
  none: { color: YT.muted, fontSize: 13, paddingHorizontal: 12 },
  infoTitle: { color: YT.text, fontSize: 17, fontWeight: "700", lineHeight: 23 },
  infoBody: { color: YT.text, fontSize: 14, lineHeight: 20 },
  fsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  fsActions: { flexDirection: "row", alignItems: "center", gap: 14 },
  moreVideos: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 10, paddingVertical: 4, paddingLeft: 12, paddingRight: 4 },
  moreText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  moreThumb: { width: 64, height: 36, borderRadius: 6 },
});
