import React, { useState, useRef } from "react";
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
  Animated,
  FlatList,
  Dimensions,
  Modal,
  Image,
  TextInput,
  Keyboard,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useProviderStore } from "@/store/useProviderStore";
import { useProviders } from "@/lib/providerApi";
import { useThemeStore } from "@/store/useThemeStore";

// Enable LayoutAnimation on Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.8, 320);

export default function Header() {
  const navigation = useNavigation<any>();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [searchMode, setSearchMode] = useState(false);
  const [query, setQuery] = useState("");
  const drawerTranslateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const inputRef = useRef<TextInput>(null);

  const { primaryColor } = useThemeStore();
  const { activeProvider, installedProviders, setActiveProvider } =
    useProviderStore();
  const { data: allProviders } = useProviders();

  const activeProviderName =
    allProviders?.find((p: any) => p.value === activeProvider)?.display_name ||
    activeProvider;

  const withOpacity = (hex: string, opacityHex: string) =>
    `${hex}${opacityHex}`;

  const installedProviderDetails = installedProviders.map((installedValue) => {
    const fullDetails = allProviders?.find(
      (p: any) => p.value === installedValue,
    );
    return (
      fullDetails || {
        value: installedValue,
        display_name:
          installedValue.charAt(0).toUpperCase() + installedValue.slice(1),
        version: "1.0",
        type: "global",
      }
    );
  });

  // ---------- Drawer Logic ----------
  const openDrawer = () => {
    setDrawerVisible(true);
    setTimeout(() => {
      Animated.timing(drawerTranslateX, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }, 50);
  };

  const closeDrawer = () => {
    Animated.timing(drawerTranslateX, {
      toValue: -DRAWER_WIDTH,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setDrawerVisible(false));
  };

  const handleSelectProvider = (value: string) => {
    setActiveProvider(value);
    closeDrawer();
  };

  // ---------- Inline Search Logic ----------
  const openSearch = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSearchMode(true);
    setTimeout(() => inputRef.current?.focus(), 150);
  };

  const closeSearch = () => {
    Keyboard.dismiss();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setQuery("");
    setSearchMode(false);
  };

  const submitSearch = () => {
    const trimmed = query.trim();
    if (trimmed.length > 0) {
      Keyboard.dismiss();
      // ✅ Go to new full results page with the SELECTED provider
      navigation.navigate("SearchResults", {
        query: trimmed,
        providerId: activeProvider,
        providerName: activeProviderName,
      });
      closeSearch();
    }
  };

  return (
    <>
      {/* Header Bar */}
      <View style={styles.header}>
        {searchMode ? (
          /* ✅ INLINE SEARCH MODE (same place as header) */
          <View style={styles.searchRow}>
            <TouchableOpacity onPress={closeSearch} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>

            <View
              style={[
                styles.inlineSearchBox,
                { borderColor: withOpacity(primaryColor, "40") },
              ]}
            >
              <TextInput
                ref={inputRef}
                style={styles.inlineSearchInput}
                placeholder={`Search in ${activeProviderName}...`}
                placeholderTextColor="#777"
                value={query}
                onChangeText={setQuery}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                onSubmitEditing={submitSearch}
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: primaryColor }]}
              onPress={submitSearch}
            >
              <Ionicons name="search" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          /* ✅ ORIGINAL HEADER */
          <>
            <View style={styles.headerSide}>
              <TouchableOpacity onPress={openDrawer}>
                <Ionicons name="menu-outline" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={styles.headerSide}>
              <TouchableOpacity onPress={openSearch}>
                <Ionicons name="search-outline" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* LEFT-SIDE DRAWER MODAL */}
      <Modal
        visible={drawerVisible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeDrawer}
      >
        <View style={styles.modalContainer}>
          <Animated.View
            style={[
              styles.drawerContainer,
              {
                width: DRAWER_WIDTH,
                transform: [{ translateX: drawerTranslateX }],
              },
            ]}
          >
            <View style={styles.drawerHeader}>
              <Text style={styles.drawerTitle}>Select Provider</Text>
              <TouchableOpacity
                onPress={closeDrawer}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={installedProviderDetails}
              keyExtractor={(item) => item.value}
              contentContainerStyle={{ paddingVertical: 10 }}
              renderItem={({ item }) => {
                const isActive = item.value === activeProvider;
                const hasIcon =
                  item.icon &&
                  typeof item.icon === "string" &&
                  item.icon.trim() !== "";

                return (
                  <TouchableOpacity
                    style={[
                      styles.providerItem,
                      isActive && {
                        backgroundColor: `${primaryColor}1A`,
                        borderLeftColor: primaryColor,
                        borderLeftWidth: 3,
                        paddingLeft: 17,
                      },
                    ]}
                    onPress={() => handleSelectProvider(item.value)}
                  >
                    <View style={styles.providerInfoRow}>
                      {hasIcon && (
                        <Image
                          source={{ uri: item.icon }}
                          style={styles.providerIcon}
                        />
                      )}
                      <View style={styles.providerInfo}>
                        <Text
                          style={[
                            styles.providerName,
                            isActive && { color: primaryColor },
                          ]}
                          numberOfLines={1}
                        >
                          {item.display_name}
                        </Text>
                        <Text style={styles.providerMeta}>
                          v{item.version} • {item.type}
                        </Text>
                      </View>
                    </View>

                    {isActive && (
                      <Ionicons
                        name="checkmark-circle"
                        size={22}
                        color={primaryColor}
                      />
                    )}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyDrawer}>
                  <Ionicons
                    name="cloud-offline-outline"
                    size={40}
                    color="#444"
                  />
                  <Text style={styles.emptyText}>No providers installed</Text>
                </View>
              }
            />
          </Animated.View>

          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={closeDrawer}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#000",
    paddingVertical: 5,
    paddingHorizontal: 10,
    width: "100%",
    paddingTop: 45,
  },
  headerSide: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  // Inline Search Row
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    width: "100%",
    paddingVertical: 4,
  },
  backButton: {
    padding: 4,
  },
  inlineSearchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: "#111",
    paddingHorizontal: 12,
  },
  inlineSearchInput: {
    flex: 1,
    color: "#fff",
    fontSize: 14,
    height: "100%",
  },
  submitButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  // Drawer Styles
  modalContainer: {
    flex: 1,
    flexDirection: "row",
  },
  backdrop: {
    flex: 1,
  },
  drawerContainer: {
    height: "100%",
    backgroundColor: "#0a0a0a",
    paddingTop: 50,
    borderRightWidth: 1,
    borderRightColor: "#1a1a1a",
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 10,
  },
  drawerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
  },
  drawerTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  closeButton: { padding: 4 },
  providerItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  providerInfoRow: { flexDirection: "row", alignItems: "center", flex: 1 },
  providerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    marginRight: 14,
    backgroundColor: "#1a1a1a",
  },
  providerInfo: { flex: 1 },
  providerName: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 2,
  },
  providerMeta: { color: "#888", fontSize: 12 },
  emptyDrawer: { padding: 40, alignItems: "center", gap: 12 },
  emptyText: { color: "#666", fontSize: 14 },
});
