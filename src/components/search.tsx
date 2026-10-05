import React, { useState, useEffect, useRef } from "react";
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  SafeAreaView,
  Keyboard,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeStore } from "../store/useThemeStore";
import { useProviderStore } from "../store/useProviderStore";
import { useSearch } from "../hooks/useSearch";

export default function GlobalSearch({ navigation }: any) {
  const { primaryColor } = useThemeStore();
  const { installedProviders, activeProvider } = useProviderStore();
  const [query, setQuery] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const inputRef = useRef<TextInput>(null);
  const insets = useSafeAreaInsets();

  const trending = [
    "Avatar",
    "Avengers",
    "Action",
    "Sci-Fi",
    "Comedy",
    "Horror",
    "Thriller",
  ];
  const withOpacity = (hex: string, opacityHex: string) =>
    `${hex}${opacityHex}`;

  // 🔒 Hide the bottom tab bar on this screen
  React.useEffect(() => {
    navigation.getParent()?.setOptions({ tabBarStyle: { display: "none" } });
    return () =>
      navigation.getParent()?.setOptions({ tabBarStyle: { display: "flex" } });
  }, [navigation]);

  // 🔁 Fetch search results ONLY when activeSearch changes (not on every keystroke)
  const { data: results, isLoading } = useSearch(
    activeSearch,
    installedProviders,
  );

  const handleSearch = () => {
    if (query.trim().length > 2) {
      Keyboard.dismiss();
      setActiveSearch(query);
    }
  };

  const clearSearch = () => {
    setQuery("");
    setActiveSearch("");
  };

  const handleTrendingPress = (term: string) => {
    setQuery(term);
    setActiveSearch(term);
  };

  // ✅ Navigate to DetailScreen with correct parameters
  const handleMoviePress = (item: any) => {
    navigation.navigate("Detail", {
      movie: {
        title: item.title,
        image: item.image,
        link: item.link,
        type: item.type || "movie",
      },
      providerId: item.providerId || activeProvider,
    });
  };

  // Group results by providerId for category-based display
  const groupedResults = React.useMemo(() => {
    if (!results || results.length === 0) return {};
    return results.reduce((acc: any, item: any) => {
      const provider = item.providerId || "Unknown";
      if (!acc[provider]) acc[provider] = [];
      acc[provider].push(item);
      return acc;
    }, {});
  }, [results]);

  const sectionKeys = Object.keys(groupedResults);

  return (
    <SafeAreaView
      style={[
        styles.container,
        { paddingTop: insets.top, backgroundColor: "#050505" },
      ]}
    >
      {/* 🔝 HEADER / SEARCH BAR */}
      <View style={styles.searchContainer}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>

        <View
          style={[
            styles.inputWrapper,
            { borderColor: withOpacity(primaryColor, "30") },
          ]}
        >
          <Ionicons
            name="search"
            size={20}
            color="#8b93a0"
            style={styles.searchIcon}
          />
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Search installed providers..."
            placeholderTextColor="#8b93a0"
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            onSubmitEditing={handleSearch}
            blurOnSubmit={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
              <Ionicons name="close-circle" size={22} color="#8b93a0" />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[styles.searchButton, { backgroundColor: primaryColor }]}
          onPress={handleSearch}
        >
          <Text style={styles.searchButtonText}>Search</Text>
        </TouchableOpacity>
      </View>

      {/* 📱 CONTENT AREA */}
      <FlatList
        style={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          activeSearch.length === 0 ? (
            <View style={styles.trendingContainer}>
              <View style={styles.trendingHeader}>
                <Text style={[styles.sectionTitle, { color: "#fff" }]}>
                  Trending Searches
                </Text>
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor: withOpacity(primaryColor, "20"),
                      borderColor: withOpacity(primaryColor, "40"),
                    },
                  ]}
                >
                  <Text style={[styles.badgeText, { color: primaryColor }]}>
                    {installedProviders.length} Providers
                  </Text>
                </View>
              </View>
              <View style={styles.tagsContainer}>
                {trending.map((term, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.tag,
                      { borderColor: withOpacity(primaryColor, "20") },
                    ]}
                    onPress={() => handleTrendingPress(term)}
                  >
                    <Ionicons
                      name="trending-up"
                      size={14}
                      color={primaryColor}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={[styles.tagText, { color: "#fff" }]}>
                      {term}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={primaryColor} />
              <Text style={[styles.loadingText, { color: "#888" }]}>
                Searching your providers...
              </Text>
            </View>
          ) : sectionKeys.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons
                name="movie-search-outline"
                size={64}
                color="#444"
              />
              <Text style={[styles.emptyText, { color: "#8b93a0" }]}>
                No results found for "{activeSearch}"
              </Text>
              <Text style={[styles.emptySubtext, { color: "#666" }]}>
                Try a different keyword or check your spelling
              </Text>
            </View>
          ) : null
        }
        data={sectionKeys}
        keyExtractor={(key) => key}
        renderItem={({ item: provider }) => {
          const items = groupedResults[provider];
          return (
            <View style={styles.categorySection}>
              <View style={styles.categoryHeader}>
                <MaterialCommunityIcons
                  name="web"
                  size={18}
                  color={primaryColor}
                />
                <Text style={[styles.categoryTitle, { color: primaryColor }]}>
                  {provider.toUpperCase()}
                </Text>
                <View
                  style={[
                    styles.categoryBadge,
                    { backgroundColor: withOpacity(primaryColor, "20") },
                  ]}
                >
                  <Text
                    style={[styles.categoryBadgeText, { color: primaryColor }]}
                  >
                    {items.length}
                  </Text>
                </View>
              </View>

              <FlatList
                data={items}
                numColumns={3}
                scrollEnabled={false}
                columnWrapperStyle={styles.columnWrapper}
                keyExtractor={(item: any, index) => item.link + index}
                renderItem={({ item }: { item: any }) => (
                  <TouchableOpacity
                    style={styles.card}
                    // ✅ Correct navigation to DetailScreen
                    onPress={() => handleMoviePress(item)}
                  >
                    <View style={styles.posterContainer}>
                      <Image
                        source={{ uri: item.image }}
                        style={styles.poster}
                      />
                    </View>
                    <Text
                      style={[styles.cardTitle, { color: "#fff" }]}
                      numberOfLines={2}
                    >
                      {item.title}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          );
        }}
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  backButton: { padding: 6 },
  inputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0a0a0a",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 48,
  },
  searchIcon: { marginRight: 8 },
  input: { flex: 1, color: "#fff", fontSize: 15, paddingVertical: 0 },
  clearButton: { padding: 4 },
  searchButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  searchButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  content: { flex: 1 },
  listContent: { paddingBottom: 40 },

  trendingContainer: { padding: 16, paddingTop: 10 },
  trendingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 20, fontWeight: "700" },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeText: { fontSize: 11, fontWeight: "700" },

  tagsContainer: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0a0a0a",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  tagText: { fontSize: 14, fontWeight: "500" },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 40,
  },
  loadingText: { marginTop: 12, fontSize: 14 },

  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    marginTop: 40,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: "center",
    fontWeight: "600",
  },
  emptySubtext: { fontSize: 14, marginTop: 8, textAlign: "center" },

  // Category Sections
  categorySection: { marginTop: 8, paddingHorizontal: 16, marginBottom: 24 },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: "800",
    flex: 1,
    letterSpacing: 0.5,
  },
  categoryBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  categoryBadgeText: { fontSize: 11, fontWeight: "700" },

  columnWrapper: { justifyContent: "flex-start", gap: 16 },
  card: { width: "31%", marginBottom: 16 },
  posterContainer: {
    position: "relative",
    width: "100%",
    aspectRatio: 2 / 3,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
  },
  poster: { width: "100%", height: "100%" },
  cardTitle: { fontSize: 13, marginTop: 8, fontWeight: "500", lineHeight: 18 },
});
