import React, { useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePlayerStore } from "@/store/usePlayerStore";

/**
 * Route shell for the persistent player. Playback itself lives in the global
 * PlayerOverlay so it survives navigating away (mini-player) and is never
 * remounted because this screen re-renders.
 */
export default function PlayerScreen({ navigation }: any) {
  const currentVideoUrl = usePlayerStore((s) => s.currentVideoUrl);
  const expand = usePlayerStore((s) => s.expand);
  const minimize = usePlayerStore((s) => s.minimize);

  useEffect(() => {
    if (currentVideoUrl) expand();
  }, [currentVideoUrl, expand]);

  useEffect(
    () => () => {
      minimize();
    },
    [minimize],
  );

  if (!currentVideoUrl) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No video selected</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={18} color="#fff" />
          <Text style={styles.backText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return <View style={styles.black} />;
}

const styles = StyleSheet.create({
  black: { flex: 1, backgroundColor: "#000" },
  empty: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  emptyText: { color: "#fff", fontSize: 16 },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#1a1a1a",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  backText: { color: "#fff", fontSize: 13, fontWeight: "700" },
});
