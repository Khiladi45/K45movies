import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useThemeStore } from "@/store/useThemeStore";

/**
 * Home header for the Movie Based layout. The provider header (provider drawer
 * + provider search) is not rendered in this layout.
 */
export default function MovieHeader() {
  const navigation = useNavigation<any>();
  const { primaryColor } = useThemeStore();

  return (
    <View style={styles.header}>
      <View style={styles.brand}>
        <View style={[styles.accent, { backgroundColor: primaryColor }]} />
        <Text style={styles.title}>K45 Movies</Text>
      </View>
      <TouchableOpacity
        onPress={() => navigation.navigate("Search")}
        hitSlop={10}
        accessibilityLabel="Search movies and series"
      >
        <Ionicons name="search-outline" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#000",
    paddingVertical: 5,
    paddingHorizontal: 14,
    width: "100%",
    paddingTop: 45,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  accent: { width: 4, height: 20, borderRadius: 2 },
  title: { color: "#fff", fontSize: 20, fontWeight: "800", letterSpacing: -0.3 },
});
