import React, { useCallback, useMemo } from "react";
import { FlatList, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useNavigation } from "@react-navigation/native";
import { useLayoutStore } from "@/store/useLayoutStore";
import { useTmdbContinueWatchingStore } from "@/store/useTmdbContinueWatchingStore";
import { resumeTmdbItem } from "@/lib/resumePlayback";
import { tmdbConfigured, tmdbImage, type TmdbItem } from "@/lib/tmdbApi";
import { homeRows } from "@/Tmdb/homeRows";
import Focusable from "../components/Focusable";
import TvHero from "../components/TvHero";
import { TmdbFetchRow } from "../components/PosterRow";
import { TV } from "../theme";

export function useOpenTvTitle() {
  const navigation = useNavigation<any>();
  return useCallback(
    (item: Pick<TmdbItem, "id" | "mediaType" | "title">) =>
      navigation.navigate("TmdbDetail", {
        id: item.id,
        mediaType: item.mediaType,
        title: item.title,
      }),
    [navigation],
  );
}

function ContinueRow({ onOpen }: { onOpen: (item: any) => void }) {
  const items = useTmdbContinueWatchingStore((s) => s.items);
  if (items.length === 0) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowTitle}>Continue Watching</Text>
      <FlatList
        horizontal
        data={items}
        keyExtractor={(item) => item.key}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        removeClippedSubviews={false}
        renderItem={({ item, index }) => {
          const uri = tmdbImage(item.backdrop, "w500") || tmdbImage(item.poster, "w342");
          const progress = item.duration > 0 ? Math.min(1, item.position / item.duration) : 0;
          return (
            <Focusable
              grow
              hasTVPreferredFocus={index === 0}
              style={styles.wide}
              onPress={() => {
                // Entries saved with player state skip the details page.
                if (!item.resume) return onOpen(item);
                void resumeTmdbItem(item).then((started) => {
                  if (!started) onOpen(item);
                });
              }}
              accessibilityLabel={`Continue ${item.title}`}
            >
              {uri ? <Image source={{ uri }} style={styles.wideImage} contentFit="cover" /> : null}
              <View style={styles.wideShade} />
              <Text style={styles.wideTitle} numberOfLines={1}>
                {item.title}
                {item.season ? `  S${item.season} E${item.episode}` : ""}
              </Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
              </View>
            </Focusable>
          );
        }}
      />
    </View>
  );
}

export default function TvHomeScreen() {
  const preferred = useLayoutStore((s) => s.preferredLanguage);
  const rows = useMemo(() => homeRows(preferred), [preferred]);
  const open = useOpenTvTitle();
  const hasContinue = useTmdbContinueWatchingStore((s) => s.items.length > 0);

  if (!tmdbConfigured()) {
    return (
      <View style={styles.center}>
        <Text style={styles.notice}>TMDB key missing — this build cannot load titles.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <TvHero height={210} />
      <ScrollView style={styles.rows} showsVerticalScrollIndicator={false}>
        <ContinueRow onOpen={open} />
        {rows.map((row, index) => (
          <TmdbFetchRow
            key={row.rowKey}
            title={row.title}
            rowKey={row.rowKey}
            fetcher={row.fetcher}
            onOpen={open}
            firstHasFocus={!hasContinue && index === 0}
          />
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: TV.bg },
  rows: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: TV.bg },
  notice: { color: "#fff", fontSize: TV.text.row },
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
  wideTitle: {
    color: "#fff",
    fontSize: TV.text.small,
    fontWeight: "700",
    paddingHorizontal: 8,
    marginBottom: 6,
  },
  progressTrack: { height: 3, backgroundColor: "rgba(255,255,255,0.25)" },
  progressFill: { height: 3, backgroundColor: "#e50914" },
});
