import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  Modal,
  StyleSheet,
  ScrollView,
  Alert,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useEpisodes } from "@/hooks/useProvider";
import { useThemeStore } from "@/store/useThemeStore";
import { createMMKV } from "react-native-mmkv";

const mmkv = createMMKV();

export interface DirectLink {
  link: string;
  title?: string;
  type?: string;
  description?: string;
  image?: string;
}

export interface LinkItem {
  title?: string;
  episodesLink?: string;
  directLinks?: DirectLink[];
  quality?: string;
}

interface SeasonListProps {
  linkList: LinkItem[];
  providerValue: string;
  metaTitle: string;
  sortKey: string;
  poster?: string;
  onPlay: (link: string, type: string, episodeData: any[]) => void;
  onDownload?: (link: string, title: string, type: string) => void;
  fetchingLink?: string | null;
}

export default function SeasonList({
  linkList,
  providerValue,
  metaTitle,
  sortKey,
  poster,
  onPlay,
  onDownload,
  fetchingLink,
}: SeasonListProps) {
  const { primaryColor } = useThemeStore();

  const [activeSeason, setActiveSeason] = useState<LinkItem>(
    linkList?.[0] || ({} as LinkItem),
  );
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [details, setDetails] = useState<any>(null);

  const sortOrderKey = `episodeSortOrder:${providerValue}:${sortKey}`;
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(() =>
    mmkv.getString(sortOrderKey) === "desc" ? "desc" : "asc",
  );

  const { data: episodeData, isLoading: episodeLoading } = useEpisodes(
    providerValue,
    activeSeason?.episodesLink || "",
  );
  const episodeList: any[] = (episodeData as any[]) || [];

  const filteredAndSortedEpisodes = useMemo(() => {
    if (!episodeList || !Array.isArray(episodeList)) return [];
    let episodes = episodeList.filter((e) => e && e.title && e.link);
    if (searchText.trim()) {
      episodes = episodes.filter((e) =>
        e.title.toLowerCase().includes(searchText.toLowerCase()),
      );
    }
    if (sortOrder === "desc") episodes = [...episodes].reverse();
    return episodes;
  }, [episodeList, searchText, sortOrder]);

  const filteredAndSortedDirectLinks = useMemo(() => {
    if (!activeSeason?.directLinks || !Array.isArray(activeSeason.directLinks))
      return [];
    let links = activeSeason.directLinks.filter((l) => l && l.title && l.link);
    if (searchText.trim()) {
      links = links.filter((l) =>
        l.title?.toLowerCase().includes(searchText.toLowerCase()),
      );
    }
    if (sortOrder === "desc") links = [...links].reverse();
    return links;
  }, [activeSeason?.directLinks, searchText, sortOrder]);

  const totalCount =
    filteredAndSortedEpisodes.length + filteredAndSortedDirectLinks.length;

  const toggleSortOrder = () => {
    const next = sortOrder === "asc" ? "desc" : "asc";
    setSortOrder(next);
    mmkv.set(sortOrderKey, next);
  };

  const handleSeasonChange = (item: LinkItem) => {
    setActiveSeason(item);
    setSearchText("");
    setDropdownVisible(false);
  };

  const getKey = (item: LinkItem) =>
    item.episodesLink || item.directLinks?.[0]?.link || item.title || "";

  const renderRow = (item: any, index: number, isEpisode: boolean) => {
    const data = isEpisode
      ? filteredAndSortedEpisodes
      : filteredAndSortedDirectLinks;

    const displayTitle =
      item.title?.trim() ||
      (!isEpisode &&
      activeSeason?.directLinks &&
      activeSeason.directLinks.length > 1
        ? `${activeSeason?.title || "Episode"} ${index + 1}`
        : activeSeason?.title && activeSeason.title.toLowerCase() !== "default"
          ? activeSeason.title
          : "Play");

    const type = item.type || (isEpisode ? "series" : "movie");
    const isFetching = fetchingLink === item.link;
    const hasDescription = !!item.description?.trim();

    return (
      <View key={`${item.link}-${index}`} style={styles.rowWrap}>
        <View style={styles.row}>
          <TouchableOpacity
            style={styles.rowPress}
            activeOpacity={0.65}
            onPress={() => onPlay(item.link, type, data)}
          >
            {item.image ? (
              <View style={styles.thumbBox}>
                <Image
                  source={{ uri: item.image || poster }}
                  style={styles.thumbImage}
                  resizeMode="cover"
                />
                <View style={styles.thumbPlayOverlay}>
                  {isFetching ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="play" size={14} color="#fff" />
                  )}
                </View>
              </View>
            ) : (
              <View style={styles.indexBadge}>
                <Text style={styles.indexBadgeText}>{index + 1}</Text>
              </View>
            )}

            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {displayTitle}
              </Text>
              {hasDescription && (
                <Text style={styles.rowDesc} numberOfLines={1}>
                  {item.description}
                </Text>
              )}
            </View>

            {isFetching ? (
              <ActivityIndicator size="small" color={primaryColor} />
            ) : (
              <Ionicons name="play-circle" size={26} color={primaryColor} />
            )}
          </TouchableOpacity>

          <View style={styles.rowActions}>
            {hasDescription && (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() =>
                  setDetails({
                    title: displayTitle,
                    description: item.description.trim(),
                    image: item.image,
                  })
                }
              >
                <Ionicons
                  name="information-circle-outline"
                  size={20}
                  color="#999"
                />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() =>
                onDownload
                  ? onDownload(item.link, displayTitle, type)
                  : Alert.alert("Download", "Download manager coming soon!")
              }
            >
              <Ionicons name="download-outline" size={20} color="#999" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  if (!linkList || linkList.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>No Streams Available</Text>
      </View>
    );
  }

  return (
    <View>
      {linkList.length > 1 && (
        <TouchableOpacity
          style={[styles.dropdownButton, { borderColor: `${primaryColor}55` }]}
          onPress={() => setDropdownVisible(true)}
        >
          <View style={styles.dropdownContent}>
            <MaterialCommunityIcons
              name={
                activeSeason?.episodesLink
                  ? "television-play"
                  : "high-definition"
              }
              size={20}
              color={primaryColor}
            />
            <Text style={styles.dropdownText} numberOfLines={1}>
              {activeSeason?.title || "Select"}
            </Text>
          </View>
          <Ionicons name="chevron-down" size={20} color="#fff" />
        </TouchableOpacity>
      )}

      {(totalCount > 2 || searchText.length > 0) && (
        <View style={styles.controlsRow}>
          <View style={styles.searchBox}>
            <MaterialCommunityIcons
              name="magnify"
              size={20}
              color={primaryColor}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Find episode"
              placeholderTextColor="#666"
              value={searchText}
              onChangeText={setSearchText}
              returnKeyType="search"
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={() => setSearchText("")}>
                <Ionicons name="close-circle" size={18} color="#666" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity style={styles.sortButton} onPress={toggleSortOrder}>
            <MaterialCommunityIcons
              name={sortOrder === "asc" ? "sort-ascending" : "sort-descending"}
              size={22}
              color="#fff"
            />
          </TouchableOpacity>
        </View>
      )}

      {activeSeason?.episodesLink && episodeLoading && (
        <View style={styles.loaderRow}>
          <ActivityIndicator size="small" color={primaryColor} />
          <Text style={styles.loaderText}>Loading episodes...</Text>
        </View>
      )}

      <View style={styles.listWrap}>
        {filteredAndSortedEpisodes.map((item, index) =>
          renderRow(item, index, true),
        )}

        {filteredAndSortedDirectLinks.map((item, index) =>
          renderRow(item, index, false),
        )}

        {totalCount === 0 && !episodeLoading && (
          <View style={styles.emptyWrap}>
            <Ionicons name="cloud-offline-outline" size={40} color="#333" />
            <Text style={styles.emptyText}>No stream found</Text>
          </View>
        )}
      </View>

      <Modal
        visible={dropdownVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDropdownVisible(false)}
      >
        <TouchableOpacity
          style={styles.dropdownOverlay}
          activeOpacity={1}
          onPress={() => setDropdownVisible(false)}
        >
          <View style={styles.dropdownModal}>
            <View style={styles.dropdownModalHeader}>
              <Text style={styles.dropdownModalTitle}>
                Select Season / Quality
              </Text>
              <TouchableOpacity onPress={() => setDropdownVisible(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.dropdownList}
              showsVerticalScrollIndicator={false}
            >
              {linkList.map((item, idx) => {
                const isSelected = getKey(item) === getKey(activeSeason);
                return (
                  <TouchableOpacity
                    key={getKey(item) + idx}
                    style={[
                      styles.dropdownItem,
                      isSelected && {
                        backgroundColor: primaryColor,
                        borderColor: primaryColor,
                      },
                    ]}
                    onPress={() => handleSeasonChange(item)}
                  >
                    <Text
                      style={[
                        styles.dropdownItemText,
                        isSelected && { color: "#fff", fontWeight: "800" },
                      ]}
                    >
                      {item.title || "Unknown"}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark" size={20} color="#fff" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={!!details}
        transparent
        animationType="fade"
        onRequestClose={() => setDetails(null)}
      >
        <TouchableOpacity
          style={styles.dropdownOverlay}
          activeOpacity={1}
          onPress={() => setDetails(null)}
        >
          <View style={styles.detailsModal}>
            {details?.image && (
              <Image
                source={{ uri: details.image }}
                style={styles.detailsImage}
              />
            )}
            <Text style={styles.detailsTitle}>{details?.title}</Text>
            <ScrollView style={{ maxHeight: 260 }}>
              <Text style={styles.detailsDesc}>{details?.description}</Text>
            </ScrollView>
            <TouchableOpacity
              style={[styles.detailsClose, { backgroundColor: primaryColor }]}
              onPress={() => setDetails(null)}
            >
              <Text style={styles.detailsCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyWrap: { alignItems: "center", paddingVertical: 32, gap: 8 },
  emptyText: { color: "#888", fontSize: 14, fontWeight: "600" },

  dropdownButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0a0a0a",
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  dropdownContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  dropdownText: { color: "#fff", fontSize: 15, fontWeight: "700", flex: 1 },

  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1a1a1a",
    backgroundColor: "#0a0a0a",
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: { flex: 1, color: "#fff", fontSize: 14, height: "100%" },
  sortButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#1a1a1a",
    alignItems: "center",
    justifyContent: "center",
  },

  loaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 20,
  },
  loaderText: { color: "#888", fontSize: 13 },

  listWrap: { gap: 8, marginTop: 4 },
  rowWrap: { width: "100%" },
  row: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0a0a0a",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#151515",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  rowPress: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  thumbBox: {
    width: 96,
    height: 54,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
  },
  thumbImage: { width: "100%", height: "100%" },
  thumbPlayOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  indexBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#1a1a1a",
    alignItems: "center",
    justifyContent: "center",
  },
  indexBadgeText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  rowInfo: { flex: 1 },
  rowTitle: { color: "#fff", fontSize: 14, fontWeight: "600", marginBottom: 3 },
  rowDesc: { color: "#777", fontSize: 12 },
  rowActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  actionBtn: { padding: 8 },

  dropdownOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  dropdownModal: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#0f0f0f",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1a1a1a",
    maxHeight: "70%",
    overflow: "hidden",
  },
  dropdownModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
  },
  dropdownModalTitle: { color: "#fff", fontSize: 17, fontWeight: "700" },
  dropdownList: { padding: 8 },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#1a1a1a",
  },
  dropdownItemText: { flex: 1, color: "#ccc", fontSize: 15, fontWeight: "600" },

  detailsModal: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#0f0f0f",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1a1a1a",
    padding: 20,
  },
  detailsImage: {
    width: "100%",
    height: 180,
    borderRadius: 12,
    marginBottom: 14,
  },
  detailsTitle: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 8,
  },
  detailsDesc: {
    color: "#aaa",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  detailsClose: { paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  detailsCloseText: { color: "#fff", fontWeight: "700" },
});
