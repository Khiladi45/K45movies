// Provider Based layout — TV detail page. Same data as the phone DetailScreen
// (useMeta / useEpisodes for the provider link) laid out for a remote: info,
// a big Play button (first focus), Watchlist, then the seasons/qualities and
// their episodes or links as focusable rows. Playback goes through the
// global player (useTvProviderPlayback).
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useEpisodes, useMeta } from "@/hooks/useProvider";
import { useThemeStore } from "@/store/useThemeStore";
import { useWatchlistStore } from "@/store/useWatchlistStore";
import Focusable from "../components/Focusable";
import { TV } from "../theme";
import { useRestoreTvFocus } from "../useRestoreTvFocus";
import { entryLabel, isSeriesInfo, linkListOf } from "./providerMeta";
import { useTvProviderPlayback } from "./useTvProviderPlayback";

const MAX_ITEMS = 200;

export default function TvProviderDetailScreen({ route }: any) {
  const post = route.params?.post || {};
  const providerId: string = route.params?.providerId || "";
  const primaryColor = useThemeStore((s) => s.primaryColor);
  const { data: info, isLoading, isError, refetch } = useMeta(providerId, post.link);
  const list = useMemo(() => linkListOf(info, post), [info, post]);
  const series = isSeriesInfo(info, post);
  const [entryIndex, setEntryIndex] = useState(0);
  const entry = list[Math.min(entryIndex, list.length - 1)];
  const needsEpisodes = !!entry?.episodesLink && !(entry?.directLinks?.length);
  const episodesQuery = useEpisodes(providerId, needsEpisodes ? entry?.episodesLink || "" : "");
  const items: { link: string; title?: string; type?: string }[] = useMemo(() => {
    const raw = needsEpisodes ? episodesQuery.data : entry?.directLinks;
    return (Array.isArray(raw) ? raw : []).filter((x: any) => x && x.link).slice(0, MAX_ITEMS);
  }, [needsEpisodes, episodesQuery.data, entry]);

  const { play, playingLink, error } = useTvProviderPlayback({ info, post, providerId });
  const playRef = useRef<View | null>(null);
  useRestoreTvFocus(playRef);

  const saved = useWatchlistStore((s) => s.movies.some((m) => m.link === post.link));
  const toggleWatchlist = useWatchlistStore((s) => s.toggleWatchlist);

  const playItem = (index: number) => {
    const item = items[index];
    if (!item) return;
    play(item.link, item.type || (series ? "series" : "movie"), {
      qualityIndex: Math.min(entryIndex, list.length - 1),
      itemIndex: index,
      items,
    });
  };

  // "Play" pressed while a season's episodes are still loading: start the
  // first episode as soon as they arrive.
  const [wantPlay, setWantPlay] = useState(false);
  useEffect(() => {
    if (wantPlay && items.length > 0) {
      setWantPlay(false);
      playItem(0);
    } else if (wantPlay && needsEpisodes && episodesQuery.isError) {
      setWantPlay(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantPlay, items.length, episodesQuery.isError]);

  const onPlay = () => {
    if (items.length > 0) playItem(0);
    else if (needsEpisodes) setWantPlay(true);
  };

  const backdrop = info?.background || info?.backdrop || info?.image || post.image;
  const poster = info?.poster || info?.image || post.image;
  const title = info?.title || post.title || "Title";
  const synopsis = info?.synopsis || info?.description || "";
  const metaLine = [
    info?.year,
    info?.genre,
    info?.runtime || info?.duration,
    Array.isArray(info?.languages) ? info.languages.join(", ") : info?.languages,
  ]
    .filter(Boolean)
    .map(String)
    .join("  ·  ");

  return (
    <View style={styles.screen}>
      {backdrop ? <Image source={{ uri: backdrop }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
      <LinearGradient
        colors={["rgba(11,11,11,0.97)", "rgba(11,11,11,0.88)", "rgba(11,11,11,0.6)"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      {isLoading ? (
        <ActivityIndicator color="#fff" size="large" style={{ flex: 1 }} />
      ) : isError ? (
        <View style={styles.center}>
          <Text style={styles.error}>Could not load this title.</Text>
          <Focusable hasTVPreferredFocus style={styles.button} onPress={() => refetch()}>
            <Text style={styles.buttonText}>Retry</Text>
          </Focusable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.top}>
            {poster ? <Image source={{ uri: poster }} style={styles.poster} contentFit="cover" /> : null}
            <View style={styles.info}>
              <Text style={styles.title} numberOfLines={2}>
                {title}
              </Text>
              {metaLine ? <Text style={styles.meta}>{metaLine}</Text> : null}
              {synopsis ? (
                <Text style={styles.synopsis} numberOfLines={4}>
                  {synopsis}
                </Text>
              ) : null}
              <View style={styles.actions}>
                <Focusable
                  ref={playRef}
                  hasTVPreferredFocus
                  style={[styles.button, { backgroundColor: primaryColor }]}
                  onPress={onPlay}
                  accessibilityLabel="Play"
                >
                  {playingLink || wantPlay ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Ionicons name="play" size={18} color="#fff" />
                  )}
                  <Text style={styles.buttonText}>
                    {series && items[0] ? `Play ${items[0].title || "Episode 1"}` : "Play"}
                  </Text>
                </Focusable>
                <Focusable
                  style={styles.button}
                  onPress={() =>
                    toggleWatchlist({
                      link: post.link,
                      title,
                      image: poster,
                      providerId,
                      type: info?.type || post.type,
                    })
                  }
                  accessibilityLabel="Watchlist"
                >
                  <Ionicons name={saved ? "checkmark" : "add"} size={18} color="#fff" />
                  <Text style={styles.buttonText}>{saved ? "In Watchlist" : "Watchlist"}</Text>
                </Focusable>
              </View>
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </View>
          </View>

          {list.length > 1 ? (
            <>
              <Text style={styles.section}>{series ? "Seasons" : "Qualities"}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                {list.map((item, index) => (
                  <Focusable
                    key={`${entryLabel(item, index)}-${index}`}
                    style={[styles.chip, index === entryIndex ? { backgroundColor: primaryColor } : null]}
                    onPress={() => setEntryIndex(index)}
                    onFocus={() => setEntryIndex(index)}
                  >
                    <Text style={styles.chipText} numberOfLines={1}>
                      {entryLabel(item, index)}
                    </Text>
                  </Focusable>
                ))}
              </ScrollView>
            </>
          ) : null}

          <Text style={styles.section}>{series ? "Episodes" : "Links"}</Text>
          {needsEpisodes && episodesQuery.isLoading ? (
            <ActivityIndicator color="#fff" style={{ alignSelf: "flex-start", marginLeft: TV.safeX }} />
          ) : needsEpisodes && episodesQuery.isError ? (
            <Focusable style={[styles.row, styles.retry]} onPress={() => episodesQuery.refetch()}>
              <Text style={styles.rowTitle}>Couldn't load episodes — press OK to retry</Text>
            </Focusable>
          ) : items.length === 0 ? (
            <Text style={styles.empty}>Nothing to play in this entry.</Text>
          ) : (
            <View style={styles.rows}>
              {items.map((item, index) => (
                <Focusable
                  key={`${item.link}-${index}`}
                  style={styles.row}
                  onPress={() => playItem(index)}
                  accessibilityLabel={`Play ${item.title || `Item ${index + 1}`}`}
                >
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {item.title || (series ? `Episode ${index + 1}` : `Link ${index + 1}`)}
                  </Text>
                  {playingLink === item.link ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Ionicons name="play" size={16} color="#fff" />
                  )}
                </Focusable>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: TV.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  content: { paddingTop: TV.safeY + 8, paddingBottom: 40 },
  top: { flexDirection: "row", gap: 20, paddingHorizontal: TV.safeX },
  poster: { width: TV.poster.width * 1.4, height: TV.poster.height * 1.4, borderRadius: TV.radius },
  info: { flex: 1, maxWidth: 560 },
  title: { color: "#fff", fontSize: TV.text.hero, fontWeight: "800" },
  meta: { color: TV.muted, fontSize: TV.text.body, marginTop: 6, fontWeight: "600" },
  synopsis: { color: "rgba(255,255,255,0.88)", fontSize: TV.text.body, marginTop: 10, lineHeight: 19 },
  actions: { flexDirection: "row", gap: 12, marginTop: 16 },
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    height: 40,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  buttonText: { color: "#fff", fontSize: TV.text.body, fontWeight: "700" },
  error: { color: "#f87171", fontSize: TV.text.body, marginTop: 10 },
  section: {
    color: "#fff",
    fontSize: TV.text.row,
    fontWeight: "700",
    marginTop: 20,
    marginBottom: 8,
    marginLeft: TV.safeX,
  },
  chips: { gap: 10, paddingHorizontal: TV.safeX, paddingVertical: 6 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "rgba(255,255,255,0.1)", maxWidth: 260 },
  chipText: { color: "#fff", fontSize: TV.text.body, fontWeight: "600" },
  rows: { paddingHorizontal: TV.safeX, maxWidth: 700, gap: 6 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  retry: { marginHorizontal: TV.safeX, alignSelf: "flex-start" },
  rowTitle: { flex: 1, color: "#fff", fontSize: TV.text.body, fontWeight: "600" },
  empty: { color: TV.muted, fontSize: TV.text.body, marginLeft: TV.safeX },
});
