import React, { forwardRef, memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import type { YtVideo } from "@/YouTube/types";
import Focusable from "../components/Focusable";
import { TV } from "../theme";

type CardProps = {
  video: YtVideo;
  onPress: (video: YtVideo) => void;
  onLongPress?: (video: YtVideo) => void;
  onFocus?: () => void;
  hasTVPreferredFocus?: boolean;
};

/** 16:9 video card: thumbnail with duration, title, channel · views. */
export const YtVideoCard = memo(
  forwardRef<View, CardProps>(function YtVideoCard(
    { video, onPress, onLongPress, onFocus, hasTVPreferredFocus },
    ref,
  ) {
    return (
      <View style={styles.card}>
        <Focusable
          ref={ref}
          grow
          hasTVPreferredFocus={hasTVPreferredFocus}
          style={styles.thumb}
          onPress={() => onPress(video)}
          onLongPress={onLongPress ? () => onLongPress(video) : undefined}
          onFocus={onFocus}
          accessibilityLabel={video.title}
        >
          <Image
            source={{ uri: video.image }}
            style={styles.image}
            contentFit="cover"
            transition={120}
            recyclingKey={video.id}
          />
          {video.isLive ? (
            <Text style={[styles.badge, styles.live]}>LIVE</Text>
          ) : video.duration ? (
            <Text style={styles.badge}>{video.duration}</Text>
          ) : null}
        </Focusable>
        <Text style={styles.title} numberOfLines={2}>
          {video.title}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {[video.channelName, video.views, video.publishedTime].filter(Boolean).join(" · ")}
        </Text>
      </View>
    );
  }),
);

/** 9:16 Shorts card. */
export const YtShortCard = memo(
  forwardRef<View, CardProps>(function YtShortCard(
    { video, onPress, onLongPress, onFocus, hasTVPreferredFocus },
    ref,
  ) {
    return (
      <View style={styles.short}>
        <Focusable
          ref={ref}
          grow
          hasTVPreferredFocus={hasTVPreferredFocus}
          style={styles.shortThumb}
          onPress={() => onPress(video)}
          onLongPress={onLongPress ? () => onLongPress(video) : undefined}
          onFocus={onFocus}
          accessibilityLabel={video.title}
        >
          <Image
            source={{ uri: video.image }}
            style={styles.image}
            contentFit="cover"
            transition={120}
            recyclingKey={video.id}
          />
        </Focusable>
        <Text style={styles.shortTitle} numberOfLines={2}>
          {video.title}
        </Text>
      </View>
    );
  }),
);

const styles = StyleSheet.create({
  card: { width: TV.ytCard.width },
  thumb: { width: TV.ytCard.width, height: TV.ytCard.height, overflow: "hidden", backgroundColor: TV.surface },
  image: { width: "100%", height: "100%", borderRadius: TV.radius - 2 },
  badge: {
    position: "absolute",
    right: 6,
    bottom: 6,
    color: "#fff",
    fontSize: TV.text.small,
    fontWeight: "700",
    backgroundColor: "rgba(0,0,0,0.8)",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  live: { backgroundColor: "#cc0000" },
  title: { color: "#fff", fontSize: TV.text.body, fontWeight: "700", marginTop: 6 },
  meta: { color: TV.muted, fontSize: TV.text.small, marginTop: 2 },
  short: { width: TV.ytShort.width },
  shortThumb: { width: TV.ytShort.width, height: TV.ytShort.height, overflow: "hidden", backgroundColor: TV.surface },
  shortTitle: { color: "#fff", fontSize: TV.text.small, fontWeight: "600", marginTop: 4 },
});
