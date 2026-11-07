import React from "react";
import {
  Alert,
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeStore } from "@/store/useThemeStore";
import {
  useTmdbWatchlistStore,
  type TmdbWatchlistItem,
} from "@/store/useTmdbWatchlistStore";
import { PosterCard, useOpenTitle } from "../components/common";

const COLUMNS = 3;
const GAP = 14;
const CARD_WIDTH = Math.floor(
  (Dimensions.get("window").width - 32 - GAP * (COLUMNS - 1)) / COLUMNS,
);

/** Watchlist tab for the Movie Based layout (its own store). */
export default function TmdbWatchlistScreen({ navigation }: any) {
  const { primaryColor } = useThemeStore();
  const insets = useSafeAreaInsets();
  const open = useOpenTitle();
  const items = useTmdbWatchlistStore((s) => s.items);
  const remove = useTmdbWatchlistStore((s) => s.remove);

  const sorted = [...items].sort((a, b) => b.addedAt - a.addedAt);

  const confirmRemove = (item: TmdbWatchlistItem) => {
    Alert.alert("Remove from Watchlist?", `"${item.title}" will be removed.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => remove(item.key) },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>My Watchlist</Text>
          <View
            style={[
              styles.count,
              { backgroundColor: `${primaryColor}20`, borderColor: `${primaryColor}40` },
            ]}
          >
            <Text style={[styles.countText, { color: primaryColor }]}>
              {items.length}
            </Text>
          </View>
        </View>
        <Ionicons name="bookmark" size={26} color={primaryColor} />
      </View>

      {sorted.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="bookmark-outline" size={72} color="#444" />
          <Text style={styles.emptyTitle}>Your watchlist is empty</Text>
          <Text style={styles.emptyText}>
            Tap the + icon on any movie or series to save it here for later
          </Text>
          <TouchableOpacity
            style={[styles.explore, { backgroundColor: primaryColor }]}
            onPress={() => navigation.navigate("HomeTab")}
          >
            <Text style={styles.exploreText}>Explore Content</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList showsHorizontalScrollIndicator={false}
          data={sorted}
          numColumns={COLUMNS}
          keyExtractor={(item) => item.key}
          columnWrapperStyle={{ gap: GAP, paddingHorizontal: 16 }}
          contentContainerStyle={{ paddingBottom: 110, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={{ width: CARD_WIDTH, marginBottom: 18 }}>
              <PosterCard
                item={item}
                width={CARD_WIDTH}
                onPress={() => open(item)}
              />
              <TouchableOpacity
                style={styles.remove}
                onPress={() => confirmRemove(item)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel={`Remove ${item.title} from watchlist`}
              >
                <Ionicons name="close" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#050505" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerTitle: { fontSize: 26, fontWeight: "800", color: "#fff", letterSpacing: -0.5 },
  count: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
  countText: { fontSize: 12, fontWeight: "800" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 8 },
  emptyTitle: { color: "#fff", fontSize: 20, fontWeight: "700", marginTop: 8 },
  emptyText: { color: "#888", fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 14 },
  explore: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  exploreText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  remove: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.75)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
});
