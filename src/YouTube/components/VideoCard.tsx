import React, { memo } from "react";
import { StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { YT } from "../theme";
import type { YtVideo } from "../types";

type Props = {
  video: YtVideo;
  onPress: (video: YtVideo) => void;
  onMenu: (video: YtVideo) => void;
};

const initialOf = (name: string) => (name.trim()[0] || "Y").toUpperCase();

/** Home-feed card: full-width 16:9 thumbnail, then avatar, title, 3-dot menu. */
function VideoCard({ video, onPress, onMenu }: Props) {
  const { width } = useWindowDimensions();
  const sub = [video.channelName, video.views, video.publishedTime].filter(Boolean).join(" · ");
  return (
    <View style={styles.card}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => onPress(video)}
        accessibilityRole="button"
        accessibilityLabel={video.title}
      >
        <View style={{ width, height: (width * 9) / 16, backgroundColor: YT.surface }}>
          <Image
            source={{ uri: video.image }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={150}
          />
          {video.isLive ? (
            <View style={[styles.badge, { backgroundColor: YT.red }]}>
              <Text style={styles.badgeText}>LIVE</Text>
            </View>
          ) : video.duration ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{video.duration}</Text>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
      <View style={styles.meta}>
        {video.channelAvatar ? (
          <Image source={{ uri: video.channelAvatar }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarText}>{initialOf(video.channelName)}</Text>
          </View>
        )}
        <TouchableOpacity style={styles.texts} activeOpacity={0.8} onPress={() => onPress(video)}>
          <Text style={styles.title} numberOfLines={2}>
            {video.title}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            {sub}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          hitSlop={10}
          style={styles.more}
          onPress={() => onMenu(video)}
          accessibilityRole="button"
          accessibilityLabel="More options"
        >
          <Ionicons name="ellipsis-vertical" size={20} color={YT.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default memo(VideoCard);

const styles = StyleSheet.create({
  card: { marginBottom: 18 },
  badge: {
    position: "absolute",
    right: 8,
    bottom: 8,
    backgroundColor: "rgba(0,0,0,0.8)",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  meta: { flexDirection: "row", paddingHorizontal: 12, paddingTop: 10, gap: 12 },
  avatar: { width: 36, height: 36, borderRadius: 18, marginTop: 2 },
  avatarFallback: { backgroundColor: "#3a3a3a", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontWeight: "700" },
  texts: { flex: 1, minWidth: 0, gap: 3 },
  title: { color: YT.text, fontSize: 15, lineHeight: 20, fontWeight: "500" },
  sub: { color: YT.muted, fontSize: 12.5 },
  more: { width: 28, alignItems: "center", paddingTop: 2 },
});
