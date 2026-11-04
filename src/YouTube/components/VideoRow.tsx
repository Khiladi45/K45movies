import React, { memo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Image } from "expo-image";
import { YT } from "../theme";
import type { YtVideo } from "../types";

export const ROW_THUMB_W = 168;
export const ROW_THUMB_H = 94;

type Props = {
  video: YtVideo;
  onPress: (video: YtVideo) => void;
  /** Optional trailing control, e.g. a download or remove button. */
  right?: React.ReactNode;
  /** Replaces the "views · time" line, e.g. with a download status. */
  statusLine?: React.ReactNode;
};

/** Thumbnail 16:9 on the left, title / channel / views on the right. */
function VideoRow({ video, onPress, right, statusLine }: Props) {
  const meta = [video.views, video.publishedTime].filter(Boolean).join(" · ");
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onPress(video)}
      style={styles.row}
      accessibilityRole="button"
      accessibilityLabel={video.title}
    >
      <View style={styles.thumbWrap}>
        <Image
          source={{ uri: video.image }}
          style={styles.thumb}
          contentFit="cover"
          transition={150}
        />
        {video.isLive ? (
          <View style={[styles.badge, styles.live]}>
            <Text style={styles.badgeText}>LIVE</Text>
          </View>
        ) : video.duration ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{video.duration}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          {video.title}
        </Text>
        {video.channelName ? (
          <Text style={styles.sub} numberOfLines={1}>
            {video.channelName}
          </Text>
        ) : null}
        {statusLine ??
          (meta ? (
            <Text style={styles.sub} numberOfLines={1}>
              {meta}
            </Text>
          ) : null)}
      </View>
      {right}
    </TouchableOpacity>
  );
}

export default memo(VideoRow);

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12, paddingHorizontal: 12, paddingVertical: 8 },
  thumbWrap: {
    width: ROW_THUMB_W,
    height: ROW_THUMB_H,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: YT.surface,
  },
  thumb: { width: "100%", height: "100%" },
  badge: {
    position: "absolute",
    right: 4,
    bottom: 4,
    backgroundColor: "rgba(0,0,0,0.8)",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  live: { backgroundColor: YT.red },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  info: { flex: 1, minWidth: 0, gap: 2 },
  title: { color: YT.text, fontSize: 14, fontWeight: "500", lineHeight: 18 },
  sub: { color: YT.muted, fontSize: 12, lineHeight: 16 },
});
