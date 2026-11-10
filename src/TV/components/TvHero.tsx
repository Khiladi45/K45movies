import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { tmdbImage } from "@/lib/tmdbApi";
import { useTvFocusStore } from "../focusStore";
import { TV } from "../theme";

/** Backdrop and info for the title the remote is on. */
export default function TvHero({ height }: { height: number }) {
  const item = useTvFocusStore((s) => s.focused);
  const uri = item ? tmdbImage(item.backdrop, "w780") || tmdbImage(item.poster, "w780") : null;
  return (
    <View style={[styles.hero, { height }]}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
      ) : null}
      <LinearGradient
        colors={["rgba(11,11,11,0.95)", "rgba(11,11,11,0.6)", "rgba(11,11,11,0)"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 0.75, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={["rgba(11,11,11,0)", TV.bg]}
        locations={[0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      {item ? (
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.meta}>
            {[
              item.mediaType === "tv" ? "Series" : "Movie",
              item.year,
              item.rating ? `★ ${item.rating.toFixed(1)}` : "",
            ]
              .filter(Boolean)
              .join("  ·  ")}
          </Text>
          {item.overview ? (
            <Text style={styles.overview} numberOfLines={3}>
              {item.overview}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { width: "100%", backgroundColor: TV.bg, justifyContent: "flex-end" },
  info: { paddingHorizontal: TV.safeX, paddingBottom: 14, maxWidth: "58%" },
  title: { color: "#fff", fontSize: TV.text.hero, fontWeight: "800" },
  meta: { color: TV.muted, fontSize: TV.text.body, marginTop: 6, fontWeight: "600" },
  overview: { color: "rgba(255,255,255,0.85)", fontSize: TV.text.body, marginTop: 8, lineHeight: 19 },
});
