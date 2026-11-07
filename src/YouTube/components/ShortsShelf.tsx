import React, { memo } from "react";
import { StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { YT } from "../theme";
import type { YtVideo } from "../types";

type Props = {
  shorts: YtVideo[];
  /** Index of each short inside the full Shorts list (for the Shorts player). */
  startIndex: number;
  onPress: (index: number) => void;
};

const GAP = 8;
const PAD = 12;

/** "Shorts" shelf: a 2-column grid of 9:16 cards. No horizontal scrolling. */
function ShortsShelf({ shorts, startIndex, onPress }: Props) {
  const { width } = useWindowDimensions();
  if (shorts.length === 0) return null;
  const cardW = (width - PAD * 2 - GAP) / 2;
  const cardH = Math.round((cardW * 16) / 9);
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Ionicons name="film" size={20} color={YT.red} />
        <Text style={styles.heading}>Shorts</Text>
      </View>
      <View style={styles.grid}>
        {shorts.map((short, i) => (
          <TouchableOpacity
            key={short.id}
            activeOpacity={0.85}
            style={{ width: cardW }}
            onPress={() => onPress(startIndex + i)}
            accessibilityRole="button"
            accessibilityLabel={short.title}
          >
            <View style={{ width: cardW, height: cardH, borderRadius: 12, overflow: "hidden", backgroundColor: YT.surface }}>
              <Image source={{ uri: short.image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
              <View style={styles.shade} />
              <Text style={styles.title} numberOfLines={2}>
                {short.title}
              </Text>
            </View>
            {short.views ? (
              <Text style={styles.views} numberOfLines={1}>
                {short.views}
              </Text>
            ) : null}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export default memo(ShortsShelf);

const styles = StyleSheet.create({
  wrap: { paddingBottom: 18, paddingTop: 4 },
  head: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: PAD, paddingBottom: 10 },
  heading: { color: YT.text, fontSize: 18, fontWeight: "700" },
  grid: { flexDirection: "row", gap: GAP, paddingHorizontal: PAD },
  shade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 80, backgroundColor: "rgba(0,0,0,0.35)" },
  title: { position: "absolute", left: 8, right: 8, bottom: 8, color: "#fff", fontSize: 13, fontWeight: "600" },
  views: { color: YT.muted, fontSize: 12, marginTop: 5 },
});
