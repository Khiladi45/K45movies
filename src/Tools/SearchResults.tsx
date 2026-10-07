import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeStore } from "@/store/useThemeStore";
import { useSearch } from "@/hooks/useSearch";
import Skeleton from "@/components/Skeleton";

export default function SearchResults({ route, navigation }: any) {
  const { query, providerId, providerName } = route.params;
  const { primaryColor } = useThemeStore();
  const insets = useSafeAreaInsets();

  const withOpacity = (hex: string, opacityHex: string) =>
    `${hex}${opacityHex}`;

  // ✅ Search ONLY the selected provider
  const { data: results, isLoading } = useSearch(
    query,
    providerId ? [providerId] : undefined,
  );

  const handlePress = (item: any) => {
    navigation.navigate("Detail", {
      movie: {
        title: item.title,
        image: item.image,
        link: item.link,
        type: item.type || "movie",
      },
      providerId: item.providerId || providerId,
    });
  };

  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [fade]);

  return (
    <Animated.View
      style={[styles.container, { paddingTop: insets.top, opacity: fade }]}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>

        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Results for "{query}"
          </Text>
          <View
            style={[
              styles.providerBadge,
              {
                backgroundColor: withOpacity(primaryColor, "20"),
                borderColor: withOpacity(primaryColor, "40"),
              },
            ]}
          >
            <Text
              style={[styles.providerBadgeText, { color: primaryColor }]}
              numberOfLines={1}
            >
              {(providerName || providerId || "").toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.skeletonGrid}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={styles.card}>
              <Skeleton
                style={{ width: "100%", aspectRatio: 2 / 3, borderRadius: 12 }}
              />
              <Skeleton
                style={{
                  width: "82%",
                  height: 12,
                  borderRadius: 4,
                  marginTop: 8,
                }}
              />
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={results || []}
          numColumns={3}
          keyExtractor={(item: any, index) => item.link || `${index}`}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="search-outline" size={48} color="#444" />
              <Text style={[styles.emptyText, { color: "#888" }]}>
                No results found for "{query}"
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => handlePress(item)}
              activeOpacity={0.8}
            >
              <View style={styles.posterBox}>
                <Image source={{ uri: item.image }} style={styles.poster} />
              </View>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {item.title}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#050505" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backButton: { padding: 4 },
  headerInfo: { flex: 1 },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  providerBadge: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  providerBadgeText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyText: { fontSize: 15, marginTop: 12, textAlign: "center" },
  skeletonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  listContent: { paddingBottom: 40, paddingTop: 8 },
  columnWrapper: { justifyContent: "space-between", paddingHorizontal: 16 },
  card: { width: "31%", marginBottom: 18 },
  posterBox: {
    width: "100%",
    aspectRatio: 2 / 3,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#141414",
  },
  poster: { width: "100%", height: "100%" },
  cardTitle: {
    color: "#fff",
    fontSize: 12,
    marginTop: 6,
    fontWeight: "500",
    lineHeight: 16,
  },
});
