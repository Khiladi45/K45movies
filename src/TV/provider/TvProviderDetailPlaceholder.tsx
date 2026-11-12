// Temporary Provider Based detail page (Phase 2a). Replaced by the real
// TvProviderDetailScreen (info, seasons/episodes, Play) in Phase 2c.
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import Focusable from "../components/Focusable";
import { TV } from "../theme";

export default function TvProviderDetailPlaceholder({ route, navigation }: any) {
  const post = route.params?.post || {};
  return (
    <View style={styles.screen}>
      {post.image ? <Image source={{ uri: post.image }} style={styles.poster} contentFit="cover" /> : null}
      <View style={styles.info}>
        <Text style={styles.title}>{post.title || "Title"}</Text>
        <Text style={styles.text}>The details page and Play arrive in the next update.</Text>
        <Focusable hasTVPreferredFocus style={styles.button} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonText}>Back</Text>
        </Focusable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
    paddingHorizontal: TV.safeX * 2,
    backgroundColor: TV.bg,
  },
  poster: { width: TV.poster.width * 1.6, height: TV.poster.height * 1.6, borderRadius: TV.radius },
  info: { flex: 1, gap: 10 },
  title: { color: "#fff", fontSize: TV.text.hero, fontWeight: "800" },
  text: { color: TV.muted, fontSize: TV.text.body },
  button: {
    alignSelf: "flex-start",
    paddingHorizontal: 18,
    height: 40,
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  buttonText: { color: "#fff", fontSize: TV.text.body, fontWeight: "700" },
});
