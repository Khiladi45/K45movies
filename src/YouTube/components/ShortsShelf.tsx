import React, { memo } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { YT } from "../theme";
import type { YtVideo } from "../types";

const CARD_W = 112;
const CARD_H = 199; // 9:16

type Props = {
  shorts: YtVideo[];
  onPress: (index: number) => void;
};

/** Horizontal "Shorts" shelf of 9:16 thumbnails. */
function ShortsShelf({ shorts, onPress }: Props) {
  if (shorts.length === 0) return null;
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Ionicons name="film" size={20} color={YT.red} />
        <Text style={styles.heading}>Shorts</Text>
      </View>
      <FlatList
        horizontal
        data={shorts}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => onPress(index)}
            style={styles.card}
            accessibilityRole="button"
            accessibilityLabel={`Short: ${item.title}`}
          >
            <View style={styles.thumbWrap}>
              <Image
                source={{ uri: item.image }}
                style={styles.thumb}
                contentFit="cover"
                transition={150}
              />
              <View style={styles.shade}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {item.title}
                </Text>
              </View>
            </View>
            {item.views ? (
              <Text style={styles.views} numberOfLines={1}>
                {item.views}
              </Text>
            ) : null}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

export default memo(ShortsShelf);

const styles = StyleSheet.create({
  wrap: { paddingTop: 12, paddingBottom: 4 },
  head: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingBottom: 10 },
  heading: { color: YT.text, fontSize: 18, fontWeight: "700" },
  list: { paddingHorizontal: 12, gap: 8 },
  card: { width: CARD_W },
  thumbWrap: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: YT.surface,
  },
  thumb: { width: "100%", height: "100%" },
  shade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 8,
    paddingTop: 24,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  cardTitle: { color: "#fff", fontSize: 13, fontWeight: "500", lineHeight: 16 },
  views: { color: YT.muted, fontSize: 12, paddingTop: 6 },
});
