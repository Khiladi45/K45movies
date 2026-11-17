// Provider Based layout — TV Home. Same data as the phone Home (useCatalog /
// usePosts for the active provider, useContinueWatchingStore, useProviderStore)
// laid out for a remote: hero for the focused poster, Continue Watching,
// a provider switcher row, then one row per catalog with "See all".
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useNavigation } from "@react-navigation/native";
import { useCatalog } from "@/hooks/useProvider";
import { useProviderStore } from "@/store/useProviderStore";
import { useContinueWatchingStore } from "@/store/useContinueWatchingStore";
import { useThemeStore } from "@/store/useThemeStore";
import { resumeProviderItem } from "@/lib/resumePlayback";
import { useInstalledProviderNames } from "@/components/PriorityProviderPicker";
import Focusable from "../components/Focusable";
import { TV } from "../theme";
import ProviderHero from "./ProviderHero";
import { PostRow } from "./PostRow";
import { rowsToLoad, validCatalogs, type ProviderPost } from "./posts";
import { usePostFocusStore } from "./postFocusStore";

/** Opens the TV provider detail page for a post. */
export function useOpenProviderPost() {
  const navigation = useNavigation<any>();
  return useCallback(
    (post: ProviderPost) =>
      navigation.navigate("TvProviderDetail", {
        post: { title: post.title, link: post.link, image: post.image, type: post.type },
        providerId: post.providerId,
      }),
    [navigation],
  );
}

function ContinueRow() {
  const items = useContinueWatchingStore((s) => s.items);
  const open = useOpenProviderPost();
  if (items.length === 0) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowTitle}>Continue Watching</Text>
      <FlatList
        horizontal
        data={items.slice(0, TV.rowLimit)}
        keyExtractor={(item) => item.link}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        removeClippedSubviews={false}
        renderItem={({ item }) => {
          const progress = item.duration > 0 ? Math.min(1, item.position / item.duration) : 0;
          const openDetail = () =>
            open({ title: item.title, link: item.link, image: item.image, type: item.type, providerId: item.providerId });
          return (
            <Focusable
              grow
              style={styles.wide}
              onPress={() => {
                // Saved player state resumes straight into the player.
                if (!item.resume) return openDetail();
                void resumeProviderItem(item).then((started) => {
                  if (!started) openDetail();
                });
              }}
              accessibilityLabel={`Continue ${item.title}`}
            >
              {item.image ? (
                <Image source={{ uri: item.image }} style={styles.wideImage} contentFit="cover" />
              ) : null}
              <View style={styles.wideShade} />
              <Text style={styles.wideTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${progress * 100}%` }]} />
              </View>
            </Focusable>
          );
        }}
      />
    </View>
  );
}

/** Installed providers; OK makes one the active provider (like the phone rail). */
function ProviderSwitcher() {
  const providers = useInstalledProviderNames();
  const activeProvider = useProviderStore((s) => s.activeProvider);
  const setActiveProvider = useProviderStore((s) => s.setActiveProvider);
  const primaryColor = useThemeStore((s) => s.primaryColor);
  if (providers.length <= 1) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowTitle}>Providers</Text>
      <FlatList
        horizontal
        data={providers}
        keyExtractor={(p) => p.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        removeClippedSubviews={false}
        renderItem={({ item }) => {
          const active = item.id === activeProvider;
          return (
            <Focusable
              style={[styles.chip, active ? { backgroundColor: primaryColor } : null]}
              onPress={() => setActiveProvider(item.id)}
              accessibilityLabel={`Switch to ${item.name}`}
            >
              <Text style={styles.chipText} numberOfLines={1}>
                {item.name}
              </Text>
            </Focusable>
          );
        }}
      />
    </View>
  );
}

export default function TvProviderHomeScreen() {
  const activeProvider = useProviderStore((s) => s.activeProvider);
  const installed = useProviderStore((s) => s.installedProviders);
  const providers = useInstalledProviderNames();
  const navigation = useNavigation<any>();
  const open = useOpenProviderPost();
  const { data: catalogs, isLoading, isError, refetch } = useCatalog(activeProvider);
  const rows = useMemo(() => validCatalogs(catalogs), [catalogs]);

  // Load rows near the focus only: the first 3, then 2 past the focused one.
  const [focusedRow, setFocusedRow] = useState(0);
  const onRowFocus = useCallback(
    (index: number) => setFocusedRow((current) => (index > current ? index : current)),
    [],
  );
  useEffect(() => {
    // New provider: start again at the top with a fresh hero.
    setFocusedRow(0);
    usePostFocusStore.getState().setFocused(null);
  }, [activeProvider]);

  const onSeeAll = useCallback(
    (catalog: { title: string; filter: string }) =>
      navigation.navigate("TvCategory", {
        providerId: activeProvider,
        filter: catalog.filter,
        title: catalog.title,
      }),
    [navigation, activeProvider],
  );

  const providerName =
    providers.find((p) => p.id === activeProvider)?.name || activeProvider || "Provider";

  if (installed.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.notice}>No providers installed.</Text>
        <Text style={styles.sub}>Open Providers in the menu (◀) to install one.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ProviderHero height={190} providerName={providerName} />
      <ScrollView style={styles.rows} showsVerticalScrollIndicator={false}>
        <ContinueRow />
        <ProviderSwitcher />
        {isLoading ? (
          <ActivityIndicator color="#fff" style={{ marginTop: 20 }} />
        ) : isError ? (
          <Focusable style={styles.retry} onPress={() => refetch()} hasTVPreferredFocus>
            <Text style={styles.retryText}>Couldn't load {providerName} — press OK to retry</Text>
          </Focusable>
        ) : rows.length === 0 ? (
          <Text style={styles.sub}>This provider has no categories.</Text>
        ) : (
          rows.map((catalog, index) => (
            <PostRow
              key={`${activeProvider}:${catalog.filter || catalog.id}:${index}`}
              providerId={activeProvider}
              catalog={catalog}
              rowIndex={index}
              enabled={index < rowsToLoad(focusedRow)}
              onOpen={open}
              onSeeAll={onSeeAll}
              onRowFocus={onRowFocus}
              seedHero={index === 0}
            />
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: TV.bg },
  rows: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: TV.bg, gap: 6 },
  notice: { color: "#fff", fontSize: TV.text.row, fontWeight: "700" },
  sub: { color: TV.muted, fontSize: TV.text.body, marginLeft: TV.safeX },
  row: { marginBottom: 18 },
  rowTitle: {
    color: "#fff",
    fontSize: TV.text.row,
    fontWeight: "700",
    marginBottom: 8,
    marginLeft: TV.safeX,
  },
  list: { gap: TV.gap, paddingHorizontal: TV.safeX, paddingVertical: 6 },
  wide: {
    width: TV.wide.width,
    height: TV.wide.height,
    overflow: "hidden",
    backgroundColor: TV.surface,
    justifyContent: "flex-end",
  },
  wideImage: { ...StyleSheet.absoluteFill, borderRadius: TV.radius - 2 },
  wideShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.35)" },
  wideTitle: { color: "#fff", fontSize: TV.text.small, fontWeight: "700", paddingHorizontal: 8, marginBottom: 6 },
  track: { height: 3, backgroundColor: "rgba(255,255,255,0.25)" },
  fill: { height: 3, backgroundColor: "#e50914" },
  chip: {
    width: TV.providerChip.width,
    height: TV.providerChip.height,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  chipText: { color: "#fff", fontSize: TV.text.body, fontWeight: "700" },
  retry: {
    alignSelf: "flex-start",
    marginLeft: TV.safeX,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(239,68,68,0.15)",
  },
  retryText: { color: "#fca5a5", fontSize: TV.text.body, fontWeight: "600" },
});
