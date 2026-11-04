import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
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
import { startDownload } from "@/services/downloadManager";
import { useYtWatch } from "../hooks";
import { useYtLibraryStore } from "../store";
import { YT } from "../theme";
import type { YtVideo } from "../types";
import { notify, shareVideo } from "../utils";
import YtPlayer, { YtPlayerHandle } from "../components/YtPlayer";

type Params = {
  video?: YtVideo;
  /** Used when only a link is known (e.g. a downloaded file). */
  link?: string;
  title?: string;
  /** Local file to play instead of streaming. */
  localUri?: string;
};

const RELATED_W = 220;

export default function YtVideoScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const params: Params = route.params ?? {};
  const link = params.video?.link ?? params.link ?? "";
  const playerRef = useRef<YtPlayerHandle>(null);
  const [expanded, setExpanded] = useState(false);

  const watch = useYtWatch(params.video, link, !params.localUri);
  const video: YtVideo | undefined = watch.data?.video ?? params.video;
  const title = video?.title ?? params.title ?? "Video";

  const saved = useYtLibraryStore((s) => (video ? s.isSaved(video.id) : false));
  const toggleSaved = useYtLibraryStore((s) => s.toggleSaved);

  const onSave = () => {
    if (!video) return;
    notify(toggleSaved(video) ? "Saved to Watchlist" : "Removed from Watchlist");
  };

  const onDownload = async () => {
    if (!video) return;
    const result = await startDownload({
      link: video.link,
      title: video.title,
      providerId: "youtube",
      type: "movie",
      image: video.image,
    });
    notify(result.ok ? "Download started" : result.error || "Couldn't start download");
  };

  const onPip = () => {
    if (!playerRef.current?.enterPip()) {
      notify("Picture-in-Picture isn't available on this device");
    }
  };

  const openRelated = useCallback(
    (item: YtVideo) =>
      item.isShort
        ? navigation.navigate("Shorts", { items: [item], startIndex: 0 })
        : navigation.push("YtVideo", { video: item }),
    [navigation],
  );

  const meta = [video?.views, video?.publishedTime].filter(Boolean).join(" · ");
  const related = watch.data?.related ?? [];
  const description = watch.data?.description ?? "";

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={{ width, height: Math.round((width * 9) / 16) }}>
        <YtPlayer
          ref={playerRef}
          link={link}
          localUri={params.localUri}
          controls
          style={StyleSheet.absoluteFill}
        />
        <TouchableOpacity
          style={[styles.playerBtn, { left: 4 }]}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-down" size={26} color="#fff" />
        </TouchableOpacity>
        <View style={styles.playerRight}>
          <TouchableOpacity
            style={styles.playerBtn}
            onPress={onPip}
            accessibilityLabel="Picture in picture"
          >
            <Ionicons name="albums-outline" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.playerBtn}
            onPress={() => playerRef.current?.enterFullscreen()}
            accessibilityLabel="Fullscreen"
          >
            <Ionicons name="expand-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <View style={styles.block}>
          <Text style={styles.title}>{title}</Text>
          {meta ? <Text style={styles.meta}>{meta}</Text> : null}
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

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.actions}
        >
          <ActionChip icon="share-social-outline" label="Share" onPress={() => video && shareVideo(video)} />
          <ActionChip
            icon={saved ? "bookmark" : "bookmark-outline"}
            label={saved ? "Saved" : "Save"}
            onPress={onSave}
          />
          {!params.localUri ? (
            <ActionChip icon="download-outline" label="Download" onPress={onDownload} />
          ) : null}
          {watch.data?.likes ? (
            <View style={styles.chip}>
              <Ionicons name="thumbs-up-outline" size={18} color={YT.text} />
              <Text style={styles.chipText}>{watch.data.likes}</Text>
            </View>
          ) : null}
        </ScrollView>

        {description ? (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setExpanded((v) => !v)}
            style={styles.description}
          >
            <Text style={styles.descText} numberOfLines={expanded ? undefined : 3}>
              {description}
            </Text>
            <Text style={styles.more}>{expanded ? "Show less" : "...more"}</Text>
          </TouchableOpacity>
        ) : null}

        {!params.localUri ? (
          <View style={styles.relatedHead}>
            <Text style={styles.relatedTitle}>Related videos</Text>
          </View>
        ) : null}
        {!params.localUri && watch.isLoading ? (
          <ActivityIndicator color={YT.red} style={{ marginTop: 16 }} />
        ) : null}
        {!params.localUri && related.length > 0 ? (
          <FlatList
            horizontal
            data={related}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.relatedList}
            renderItem={({ item }) => (
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.card}
                onPress={() => openRelated(item)}
                accessibilityRole="button"
                accessibilityLabel={item.title}
              >
                <View style={styles.cardThumb}>
                  <Image source={{ uri: item.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  {item.duration ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.duration}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.cardSub} numberOfLines={1}>
                  {item.channelName}
                </Text>
                <Text style={styles.cardSub} numberOfLines={1}>
                  {[item.views, item.publishedTime].filter(Boolean).join(" · ")}
                </Text>
              </TouchableOpacity>
            )}
          />
        ) : null}
        {!params.localUri && !watch.isLoading && related.length === 0 ? (
          <Text style={styles.none}>No related videos found.</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

function ActionChip({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.chip} onPress={onPress} accessibilityRole="button">
      <Ionicons name={icon} size={18} color={YT.text} />
      <Text style={styles.chipText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: YT.bg },
  playerBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  playerRight: { position: "absolute", right: 4, top: 0, flexDirection: "row" },
  block: { paddingHorizontal: 12, paddingTop: 12 },
  title: { color: YT.text, fontSize: 18, fontWeight: "700", lineHeight: 24 },
  meta: { color: YT.muted, fontSize: 12, paddingTop: 4 },
  channelRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingTop: 14 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: YT.surface },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  channel: { flex: 1, color: YT.text, fontSize: 14, fontWeight: "500" },
  actions: { paddingHorizontal: 12, paddingVertical: 14, gap: 8 },
  chip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: YT.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chipText: { color: YT.text, fontSize: 13, fontWeight: "500" },
  description: { marginHorizontal: 12, padding: 12, borderRadius: 12, backgroundColor: YT.surfaceAlt },
  descText: { color: YT.text, fontSize: 13, lineHeight: 18 },
  more: { color: YT.muted, fontSize: 13, paddingTop: 4 },
  relatedHead: { paddingHorizontal: 12, paddingTop: 18, paddingBottom: 10 },
  relatedTitle: { color: YT.text, fontSize: 16, fontWeight: "700" },
  relatedList: { paddingHorizontal: 12, gap: 12 },
  card: { width: RELATED_W },
  cardThumb: { width: RELATED_W, height: 124, borderRadius: 10, overflow: "hidden", backgroundColor: YT.surface },
  badge: { position: "absolute", right: 6, bottom: 6, backgroundColor: "rgba(0,0,0,0.8)", borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  cardTitle: { color: YT.text, fontSize: 14, fontWeight: "500", lineHeight: 18, paddingTop: 8 },
  cardSub: { color: YT.muted, fontSize: 12, paddingTop: 2 },
  none: { color: YT.muted, fontSize: 13, paddingHorizontal: 12 },
});
