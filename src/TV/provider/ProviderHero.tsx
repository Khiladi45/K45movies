import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { usePostFocusStore } from "./postFocusStore";
import { TV } from "../theme";

/** Backdrop + title of the focused provider post (Provider Based home). */
export default function ProviderHero({
  height,
  providerName,
}: {
  height: number;
  providerName: string;
}) {
  const post = usePostFocusStore((s) => s.focused);
  return (
    <View style={[styles.hero, { height }]}>
      {post?.image ? (
        <Image
          source={{ uri: post.image }}
          style={styles.art}
          contentFit="cover"
          transition={200}
          recyclingKey={post.link}
        />
      ) : null}
      <LinearGradient
        colors={["rgba(11,11,11,0.97)", "rgba(11,11,11,0.75)", "rgba(11,11,11,0.15)"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={["rgba(11,11,11,0)", TV.bg]}
        locations={[0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.info}>
        <Text style={styles.provider}>{providerName}</Text>
        {post ? (
          <>
            <Text style={styles.title} numberOfLines={2}>
              {post.title}
            </Text>
            {post.catalogTitle ? <Text style={styles.meta}>{post.catalogTitle}</Text> : null}
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { width: "100%", backgroundColor: TV.bg, justifyContent: "flex-end" },
  // Poster art sits on the right; gradients keep text readable on the left.
  art: { position: "absolute", right: 0, top: 0, bottom: 0, width: "45%" },
  info: { paddingHorizontal: TV.safeX, paddingBottom: 14, maxWidth: "58%" },
  provider: {
    color: TV.muted,
    fontSize: TV.text.small,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: { color: "#fff", fontSize: TV.text.hero, fontWeight: "800", marginTop: 4 },
  meta: { color: TV.muted, fontSize: TV.text.body, marginTop: 6, fontWeight: "600" },
});
