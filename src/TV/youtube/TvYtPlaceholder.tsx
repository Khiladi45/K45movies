// Temporary YouTube pages until their phase lands (watch page: 3b, Shorts: 3c).
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import Focusable from "../components/Focusable";
import { TV } from "../theme";

export default function TvYtPlaceholder({ route, navigation }: any) {
  const video = route.params?.video || route.params?.items?.[route.params?.startIndex ?? 0];
  return (
    <View style={styles.screen}>
      {video?.image ? <Image source={{ uri: video.image }} style={styles.thumb} contentFit="cover" /> : null}
      <Text style={styles.title} numberOfLines={2}>
        {video?.title || "YouTube"}
      </Text>
      <Text style={styles.text}>Playback for this page arrives in the next update.</Text>
      <Focusable hasTVPreferredFocus style={styles.button} onPress={() => navigation.goBack()}>
        <Text style={styles.buttonText}>Back</Text>
      </Focusable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: TV.bg },
  thumb: { width: TV.ytCard.width * 1.4, height: TV.ytCard.height * 1.4, borderRadius: TV.radius },
  title: { color: "#fff", fontSize: TV.text.title, fontWeight: "800", maxWidth: 600, textAlign: "center" },
  text: { color: TV.muted, fontSize: TV.text.body },
  button: { paddingHorizontal: 18, height: 40, justifyContent: "center", backgroundColor: "rgba(255,255,255,0.14)" },
  buttonText: { color: "#fff", fontSize: TV.text.body, fontWeight: "700" },
});
