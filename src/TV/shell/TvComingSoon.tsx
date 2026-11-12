import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TV } from "../theme";

/** Placeholder for sections that arrive in a later phase. Not focusable. */
export default function TvComingSoon({
  title,
  icon,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.wrap}>
      <Ionicons name={icon} size={48} color={TV.muted} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.text}>Coming in the next update.</Text>
      <Text style={styles.text}>
        Press ◀ for the menu. Settings → Layout switches back to Movie Based.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: TV.safeX,
    gap: 8,
    backgroundColor: TV.bg,
  },
  title: { color: "#fff", fontSize: TV.text.title, fontWeight: "800", marginTop: 6 },
  text: { color: TV.muted, fontSize: TV.text.body, textAlign: "center" },
});
