import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  Modal,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useThemeStore } from "../store/useThemeStore";
import { useProviderStore } from "../store/useProviderStore";
import { useProviders } from "@/lib/providerApi";
import { ProviderManager } from "@/services/ProviderManager";
import { SandboxManager } from "@/services/SandboxManager";

// Enable LayoutAnimation on Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function AddProviders() {
  const { primaryColor } = useThemeStore();
  const {
    activeProvider,
    installedProviders,
    setActiveProvider,
    toggleInstall,
  } = useProviderStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [providerToDelete, setProviderToDelete] = useState<string | null>(null);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const { data: providers, isLoading, error } = useProviders();

  const withOpacity = (hex: string, opacityHex: string) =>
    `${hex}${opacityHex}`;

  const filteredProviders =
    providers?.filter((provider: any) =>
      provider.display_name.toLowerCase().includes(searchQuery.toLowerCase()),
    ) || [];

  const installedCount = installedProviders.length;
  const availableCount = Math.max((providers?.length ?? 0) - installedCount, 0);

  const handleProviderPress = async (item: any) => {
    const isInstalled = installedProviders.includes(item.value);
    if (!isInstalled) {
      try {
        setInstallingId(item.value);
        await ProviderManager.installProvider(item.value, item);
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        toggleInstall(item.value);
        setActiveProvider(item.value);
      } catch (e: any) {
        Alert.alert(
          "Install failed",
          e?.message || "Could not download this provider. Please try again.",
        );
      } finally {
        setInstallingId(null);
      }
    } else {
      setActiveProvider(item.value);
    }
  };

  const handleDeletePress = (value: string) => {
    setProviderToDelete(value);
    setDeleteModalVisible(true);
  };

  const confirmDelete = () => {
    if (providerToDelete) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      const id = providerToDelete;
      toggleInstall(id);
      SandboxManager.unloadProvider(id);
      ProviderManager.uninstallProviderFiles(id).catch(() => {});
      if (activeProvider === id) {
        const remaining = installedProviders.filter((p) => p !== id);
        if (remaining.length > 0) {
          setActiveProvider(remaining[0]);
        }
      }
      setDeleteModalVisible(false);
      setProviderToDelete(null);
    }
  };

  const getProviderIcon = (index: number) => {
    const icons = [
      "filmstrip",
      "movie-open",
      "video",
      "television",
      "play-circle",
      "youtube",
      "netflix",
      "vimeo",
      "radio",
      "web",
    ];
    return icons[index % icons.length];
  };

  const renderProviderCard = ({
    item,
    index,
  }: {
    item: any;
    index: number;
  }) => {
    const isInstalled = installedProviders.includes(item.value);
    const isActive = activeProvider === item.value;

    const hasCustomIcon =
      item.icon && typeof item.icon === "string" && item.icon.trim() !== "";
    const fallbackIconName = getProviderIcon(index);

    return (
      <Animated.View
        style={[
          styles.providerCard,
          {
            borderColor: isActive ? primaryColor : withOpacity("#ffffff", "15"),
            borderWidth: isActive ? 2 : 1,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.cardTouchable}
          onPress={() => handleProviderPress(item)}
          activeOpacity={0.8}
        >
          <View style={styles.cardContent}>
            <View style={styles.cardLeft}>
              {/* Icon Box */}
              <View
                style={[
                  styles.providerIconBox,
                  { backgroundColor: withOpacity(primaryColor, "20") },
                ]}
              >
                {hasCustomIcon ? (
                  <Image
                    source={{ uri: item.icon }}
                    style={styles.customIconImage}
                    resizeMode="contain"
                  />
                ) : (
                  <MaterialCommunityIcons
                    name={fallbackIconName as any}
                    size={24}
                    color={primaryColor}
                  />
                )}
              </View>

              {/* Provider Info */}
              <View style={styles.providerInfo}>
                <Text
                  style={[styles.providerName, { color: "#fff" }]}
                  numberOfLines={1}
                >
                  {item.display_name}
                </Text>
                <View style={styles.providerMeta}>
                  <Text style={styles.providerVersion}>v{item.version}</Text>
                  <Text style={styles.metaDot}>•</Text>
                  <Text style={styles.providerType}>{item.type}</Text>
                </View>

                {isInstalled && (
                  <View style={styles.badgeContainer}>
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
                        INSTALLED
                      </Text>
                    </View>
                    {isActive && (
                      <View style={[styles.badge, styles.activeBadge]}>
                        <Text style={styles.activeBadgeText}>ACTIVE</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </View>

            <View style={styles.cardRight}>
              {isActive ? (
                <View style={styles.activeIndicator}>
                  <Ionicons
                    name="checkmark-circle"
                    size={24}
                    color={primaryColor}
                  />
                </View>
              ) : !isInstalled ? (
                <TouchableOpacity
                  style={[
                    styles.installButton,
                    { backgroundColor: primaryColor },
                  ]}
                  onPress={() => handleProviderPress(item)}
                  disabled={installingId === item.value}
                  activeOpacity={0.8}
                >
                  {installingId === item.value ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.installButtonText}>Install</Text>
                  )}
                </TouchableOpacity>
              ) : null}

              {isInstalled && (
                <TouchableOpacity
                  style={styles.menuButton}
                  onPress={() => handleDeletePress(item.value)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="ellipsis-vertical" size={20} color="#ccc" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderHeader = () => (
    <>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Providers</Text>
          <Text style={styles.headerSubtitle}>
            Manage your streaming sources
          </Text>
        </View>
      </View>

      {/* Search */}
      <View
        style={[
          styles.searchContainer,
          {
            backgroundColor: withOpacity("#0a0a0a", "F0"),
            borderColor: withOpacity("#ffffff", "15"),
          },
        ]}
      >
        <Ionicons
          name="search"
          size={18}
          color="#666"
          style={styles.searchIcon}
        />
        <TextInput
          style={[styles.searchInput, { color: "#fff" }]}
          placeholder="Search providers..."
          placeholderTextColor="#666"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Ionicons name="close-circle" size={20} color="#666" />
          </TouchableOpacity>
        )}
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View
          style={[
            styles.statBox,
            {
              backgroundColor: withOpacity("#10b981", "12"),
              borderColor: withOpacity("#10b981", "35"),
            },
          ]}
        >
          <View
            style={[
              styles.statIconBox,
              { backgroundColor: withOpacity("#10b981", "25") },
            ]}
          >
            <MaterialCommunityIcons
              name="tray-arrow-down"
              size={22}
              color="#10b981"
            />
          </View>
          <View style={styles.statInfo}>
            <Text style={styles.statLabel}>Installed</Text>
            <Text style={[styles.statValue, { color: "#10b981" }]}>
              {installedCount}
            </Text>
          </View>
        </View>
        <View
          style={[
            styles.statBox,
            {
              backgroundColor: withOpacity("#007aff", "12"),
              borderColor: withOpacity("#007aff", "35"),
            },
          ]}
        >
          <View
            style={[
              styles.statIconBox,
              { backgroundColor: withOpacity("#007aff", "25") },
            ]}
          >
            <MaterialCommunityIcons
              name="cloud-download-outline"
              size={22}
              color="#007aff"
            />
          </View>
          <View style={styles.statInfo}>
            <Text style={styles.statLabel}>Available</Text>
            <Text style={[styles.statValue, { color: "#007aff" }]}>
              {availableCount}
            </Text>
          </View>
        </View>
      </View>

      {/* Your Providers Section */}
      {installedCount > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View
              style={[styles.sectionLine, { backgroundColor: primaryColor }]}
            />
            <Text style={[styles.sectionTitle, { color: "#fff" }]}>
              Your Providers ({installedCount})
            </Text>
          </View>

          {filteredProviders
            .filter((p: any) => installedProviders.includes(p.value))
            .map((item: any, index: number) => (
              <View key={item.value}>
                {renderProviderCard({ item, index })}
              </View>
            ))}
        </View>
      )}

      {/* More Providers Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View
            style={[styles.sectionLine, { backgroundColor: primaryColor }]}
          />
          <Text style={[styles.sectionTitle, { color: "#fff" }]}>
            More Providers
          </Text>
        </View>
      </View>
    </>
  );

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <View
          style={[
            styles.loadingSpinner,
            {
              borderColor: withOpacity(primaryColor, "30"),
              borderTopColor: primaryColor,
            },
          ]}
        />
        <Text style={[styles.emptyText, { color: "#888" }]}>Loading...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text style={[styles.emptyText, { color: "#ef4444", marginTop: 12 }]}>
          Failed to load
        </Text>
      </View>
    );
  }

  const moreProviders = filteredProviders.filter(
    (p: any) => !installedProviders.includes(p.value),
  );

  return (
    <View style={[styles.container, { backgroundColor: "#050505" }]}>
      <FlatList
        data={moreProviders}
        keyExtractor={(item: any) => item.value}
        renderItem={({ item, index }) =>
          renderProviderCard({ item, index: index + installedCount })
        }
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={48} color="#444" />
            <Text style={[styles.emptyText, { marginTop: 12 }]}>
              No more providers available
            </Text>
          </View>
        }
      />

      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: "#0a0a0a",
                borderColor: withOpacity(primaryColor, "30"),
              },
            ]}
          >
            <View style={styles.modalIcon}>
              <Ionicons name="warning" size={48} color="#ef4444" />
            </View>
            <Text style={[styles.modalTitle, { color: "#fff" }]}>
              Remove Provider?
            </Text>
            <Text style={[styles.modalText, { color: "#888" }]}>
              This will uninstall the provider. You can always reinstall it
              later.
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setDeleteModalVisible(false)}
              >
                <Text style={[styles.modalButtonText, { color: "#888" }]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.deleteButton]}
                onPress={confirmDelete}
              >
                <Ionicons
                  name="trash"
                  size={18}
                  color="#fff"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.modalButtonText}>Remove</Text>
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
  centerContent: { flex: 1, justifyContent: "center", alignItems: "center" },
  listContent: { paddingBottom: 40 },

  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16 },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.5,
  },
  headerSubtitle: { fontSize: 13, color: "#888", marginTop: 4 },

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    height: 48,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 15, height: "100%" },

  statsContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 12,
  },
  statBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  statIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  statInfo: {
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    color: "#888",
    fontWeight: "600",
    marginBottom: 2,
  },
  statValue: { fontSize: 22, fontWeight: "800" },

  section: { marginTop: 12, paddingHorizontal: 20, paddingBottom: 16 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionLine: { width: 3, height: 16, borderRadius: 2, marginRight: 10 },
  sectionTitle: { fontSize: 15, fontWeight: "700" },

  providerCard: {
    width: "95%",
    alignSelf: "center",
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: "#0a0a0a",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  cardTouchable: {
    padding: 16,
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardLeft: { flex: 1, flexDirection: "row", alignItems: "center" },
  providerIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  customIconImage: {
    width: 28,
    height: 28,
  },
  providerInfo: { flex: 1 },
  providerName: { fontSize: 15, fontWeight: "700", marginBottom: 3 },
  providerMeta: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  providerVersion: { fontSize: 12, color: "#888", fontWeight: "500" },
  metaDot: { fontSize: 12, color: "#555", marginHorizontal: 6 },
  providerType: {
    fontSize: 12,
    color: "#888",
    textTransform: "capitalize",
    fontWeight: "500",
  },

  badgeContainer: { flexDirection: "row", gap: 6 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: { fontSize: 9, fontWeight: "700", letterSpacing: 0.3 },
  activeBadge: { backgroundColor: "#10b981", borderColor: "#10b981" },
  activeBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.3,
  },

  cardRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  activeIndicator: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  installButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 70,
    alignItems: "center",
  },
  installButtonText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  menuButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingSpinner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    marginBottom: 12,
  },
  emptyState: { alignItems: "center", paddingVertical: 40 },
  emptyText: { fontSize: 14, color: "#666", fontWeight: "500" },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 20,
    borderWidth: 1,
    padding: 28,
    alignItems: "center",
  },
  modalIcon: { marginBottom: 20 },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 10,
    textAlign: "center",
  },
  modalText: {
    fontSize: 15,
    textAlign: "center",
    marginBottom: 28,
    lineHeight: 22,
  },
  modalButtons: { flexDirection: "row", gap: 12, width: "100%" },
  modalButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
  },
  cancelButton: { backgroundColor: "rgba(255, 255, 255, 0.1)" },
  deleteButton: { backgroundColor: "#ef4444" },
  modalButtonText: { fontSize: 15, fontWeight: "700" },
});

function withOpacity(hex: string, opacityHex: string) {
  return `${hex}${opacityHex}`;
}
