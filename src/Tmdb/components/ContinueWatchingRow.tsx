import React, { memo } from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useThemeStore } from "@/store/useThemeStore";
import { useTmdbContinueWatchingStore } from "@/store/useTmdbContinueWatchingStore";
import { tmdbImage } from "@/lib/tmdbApi";
import { resumeTmdbItem } from "@/lib/resumePlayback";
import { RowHeader, useOpenTitle } from "./common";

const CARD_WIDTH = 168;
const CARD_HEIGHT = 96;

/** Continue Watching for the Movie Based layout (its own store). */
const ContinueWatchingRow = memo(function ContinueWatchingRow() {
  const items = useTmdbContinueWatchingStore((s) => s.items);
  const remove = useTmdbContinueWatchingStore((s) => s.remove);
  const { primaryColor } = useThemeStore();
  const open = useOpenTitle();

  if (items.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <RowHeader title="Continue Watching" />
      <FlatList showsVerticalScrollIndicator={false}
        data={items}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.key}
        ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
        renderItem={({ item }) => {
          const uri =
            tmdbImage(item.backdrop, "w500") || tmdbImage(item.poster, "w342");
          const progress =
            item.duration > 0
              ? Math.min(1, Math.max(0.04, item.position / item.duration))
              : 0.04;
          const subtitle =
            item.mediaType === "tv" && item.season != null
              ? `S${item.season} E${item.episode}`
              : "";
          return (
            <TouchableOpacity
              activeOpacity={0.9}
              style={{ width: CARD_WIDTH }}
              onPress={() => {
                // Entries saved with player state skip the Details page.
                if (!item.resume) return open(item);
                void resumeTmdbItem(item).then((started) => {
                  if (!started) open(item);
                });
              }}
              onLongPress={() => remove(item.key)}
            >
              <View style={styles.thumb}>
                {uri ? (
                  <Image
                    source={{ uri }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={200}
                  />
                ) : null}
                <View style={styles.playOverlay}>
                  <Ionicons name="play-circle" size={34} color="rgba(255,255,255,0.95)" />
                </View>
                <View style={styles.progressTrack}>
                  <View
                    style={{
                      width: `${progress * 100}%`,
                      height: "100%",
                      backgroundColor: primaryColor,
                    }}
                  />
                </View>
                <TouchableOpacity
                  style={styles.remove}
                  onPress={() => remove(item.key)}
                  hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                  accessibilityLabel={`Remove ${item.title} from Continue Watching`}
                >
                  <Ionicons name="close" size={13} color="#fff" />
                </TouchableOpacity>
              </View>
              <Text style={styles.title} numberOfLines={1}>
                {item.title}
              </Text>
              {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { marginBottom: 24, paddingLeft: 16 },
  thumb: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#111",
  },
  playOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  progressTrack: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  remove: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: "#ddd", fontSize: 12.5, marginTop: 6, fontWeight: "600" },
  sub: { color: "#888", fontSize: 11, marginTop: 1 },
});

export default ContinueWatchingRow;
