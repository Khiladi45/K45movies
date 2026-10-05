import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Alert,
  Modal,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useWatchlistStore, WatchlistMovie } from "@/store/useWatchlistStore";
import { useThemeStore } from "@/store/useThemeStore";
import { useProviderStore } from "@/store/useProviderStore";

export default function Watchlist({ navigation }: any) {
  const { primaryColor } = useThemeStore();
  const { activeProvider } = useProviderStore();
  const { movies, removeFromWatchlist } = useWatchlistStore();
  const insets = useSafeAreaInsets();
  const [movieToDelete, setMovieToDelete] = useState<WatchlistMovie | null>(
    null,
  );

  const withOpacity = (hex: string, opacityHex: string) =>
    `${hex}${opacityHex}`;

  const sortedMovies = [...movies].sort((a, b) => b.addedAt - a.addedAt);

  const handlePress = (item: WatchlistMovie) => {
    navigation.navigate("Detail", {
      movie: {
        title: item.title,
        image: item.image,
        link: item.link,
        type: item.type || "movie",
      },
      providerId: item.providerId,
    });
  };

  const confirmRemove = (item: WatchlistMovie) => {
    setMovieToDelete(item);
  };

  const handleConfirmDelete = () => {
    if (movieToDelete) {
      removeFromWatchlist(movieToDelete.link);
      setMovieToDelete(null);
    }
  };

  const getTimeAgo = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return `${Math.floor(days / 30)} months ago`;
  };

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top, backgroundColor: "#050505" },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>My Watchlist</Text>
          <View
            style={[
              styles.countBadge,
              {
                backgroundColor: withOpacity(primaryColor, "20"),
                borderColor: withOpacity(primaryColor, "40"),
              },
            ]}
          >
            <Text style={[styles.countBadgeText, { color: primaryColor }]}>
              {movies.length}
            </Text>
          </View>
        </View>
        <Ionicons name="bookmark" size={26} color={primaryColor} />
      </View>

      {sortedMovies.length === 0 ? (
        /* Empty State */
        <View style={styles.emptyContainer}>
          <LinearGradient
            colors={[withOpacity(primaryColor, "15"), "transparent"]}
            style={styles.emptyGlow}
          />
          <View style={styles.emptyIconWrap}>
            <Ionicons name="bookmark-outline" size={72} color="#444" />
          </View>
          <Text style={styles.emptyTitle}>Your watchlist is empty</Text>
          <Text style={styles.emptySubtitle}>
            Tap the + icon on any movie or show to save it here for later
          </Text>
          <TouchableOpacity
            style={[styles.exploreButton, { backgroundColor: primaryColor }]}
            onPress={() => navigation.navigate("HomeTab")}
          >
            <Text style={styles.exploreButtonText}>Explore Content</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* Movies Grid */
        <FlatList
          data={sortedMovies}
          numColumns={3}
          keyExtractor={(item) => item.link}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => handlePress(item)}
              >
                <View style={styles.posterContainer}>
                  <Image source={{ uri: item.image }} style={styles.poster} />

                  {/* Delete button overlay */}
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => confirmRemove(item)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close" size={14} color="#fff" />
                  </TouchableOpacity>

                  {/* Provider badge */}
                  <View style={styles.providerBadge}>
                    <Text style={styles.providerBadgeText} numberOfLines={1}>
                      {item.providerId.toUpperCase()}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => handlePress(item)}
              >
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.cardMeta}>
                  Added {getTimeAgo(item.addedAt)}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      {/* Confirm Delete Modal */}
      <Modal
        visible={!!movieToDelete}
        transparent
        animationType="fade"
        onRequestClose={() => setMovieToDelete(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="bookmark-outline" size={40} color="#ef4444" />
            </View>
            <Text style={styles.modalTitle}>Remove from Watchlist?</Text>
            <Text style={styles.modalText} numberOfLines={2}>
              "{movieToDelete?.title}" will be removed from your watchlist.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setMovieToDelete(null)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalDeleteButton}
                onPress={handleConfirmDelete}
              >
                <Text style={styles.modalDeleteText}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.5,
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  countBadgeText: { fontSize: 12, fontWeight: "800" },

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyGlow: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    top: "25%",
  },
  emptyIconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#0a0a0a",
    borderWidth: 1,
    borderColor: "#1a1a1a",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtitle: {
    color: "#888",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  exploreButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  exploreButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  // Grid
  listContent: { paddingBottom: 100, paddingTop: 8 },
  columnWrapper: {
    justifyContent: "flex-start",
    paddingHorizontal: 16,
    gap: 20,
  },
  card: { width: "31%", marginBottom: 20 },
  posterContainer: {
    width: "100%",
    aspectRatio: 2 / 3,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
    position: "relative",
  },
  poster: { width: "100%", height: "100%" },
  deleteButton: {
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
  providerBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    backgroundColor: "rgba(0,0,0,0.75)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    maxWidth: "75%",
  },
  providerBadgeText: { color: "#fff", fontSize: 9, fontWeight: "700" },
  cardTitle: {
    color: "#fff",
    fontSize: 12,
    marginTop: 8,
    fontWeight: "600",
    lineHeight: 16,
  },
  cardMeta: { color: "#666", fontSize: 10, marginTop: 3, fontWeight: "500" },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#0f0f0f",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1a1a1a",
    padding: 24,
    alignItems: "center",
  },
  modalIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  modalTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  modalText: {
    color: "#888",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
  modalButtons: { flexDirection: "row", gap: 10, width: "100%" },
  modalCancelButton: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  modalCancelText: { color: "#ccc", fontSize: 14, fontWeight: "600" },
  modalDeleteButton: {
    flex: 1,
    backgroundColor: "#ef4444",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  modalDeleteText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
