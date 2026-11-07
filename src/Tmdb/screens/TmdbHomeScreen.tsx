import React, { useMemo } from "react";
import {
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Skeleton from "@/components/Skeleton";
import { useLayoutStore } from "@/store/useLayoutStore";
import { useTmdbWatchlistStore } from "@/store/useTmdbWatchlistStore";
import { NO_LANGUAGE, languageName } from "@/lib/languages";
import { useTmdbRow } from "@/hooks/useTmdb";
import {
  getDiscover,
  getNowPlaying,
  getOnTheAir,
  getPopular,
  getPopularInLanguage,
  getTopRated,
  getTrending,
  tmdbConfigured,
  tmdbImage,
  type TmdbItem,
} from "@/lib/tmdbApi";
import ContinueWatchingRow from "../components/ContinueWatchingRow";
import { MissingKeyNotice, TmdbRow, useOpenTitle } from "../components/common";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const HERO_WIDTH = SCREEN_WIDTH - 34;
const HERO_HEIGHT = 420;
const HERO_STEP = HERO_WIDTH + 16;

// A different "Discover" page each time the app starts.
const DISCOVER_PAGE = 1 + Math.floor(Math.random() * 10);

function Hero() {
  const open = useOpenTitle();
  const toggle = useTmdbWatchlistStore((s) => s.toggle);
  const saved = useTmdbWatchlistStore((s) => s.items);
  const { data, isLoading } = useTmdbRow("trending", getTrending);

  const items = useMemo(
    () => (data || []).filter((item) => item.backdrop || item.poster).slice(0, 8),
    [data],
  );

  if (isLoading) {
    return (
      <View style={styles.heroWrap}>
        <Skeleton style={{ width: HERO_WIDTH, height: HERO_HEIGHT, borderRadius: 28, marginLeft: 16 }} />
      </View>
    );
  }
  if (items.length === 0) return null;

  return (
    <View style={styles.heroWrap}>
      <FlatList showsVerticalScrollIndicator={false}
        data={items}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={HERO_STEP}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: 16 }}
        keyExtractor={(item) => `${item.mediaType}:${item.id}`}
        ItemSeparatorComponent={() => <View style={{ width: 16 }} />}
        renderItem={({ item }: { item: TmdbItem }) => {
          const uri = tmdbImage(item.poster, "w780") || tmdbImage(item.backdrop, "w780");
          const inList = saved.some(
            (entry) => entry.key === `${item.mediaType}:${item.id}`,
          );
          return (
            <TouchableOpacity
              activeOpacity={0.95}
              style={styles.heroCard}
              onPress={() => open(item)}
            >
              {uri ? (
                <Image
                  source={{ uri }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={250}
                />
              ) : null}
              <LinearGradient
                colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.25)", "rgba(0,0,0,0.8)", "rgba(0,0,0,0.99)"]}
                locations={[0, 0.45, 0.78, 1]}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.heroBadge}>
                <Ionicons name="flame" size={13} color="#fff" />
                <Text style={styles.heroBadgeText}>
                  {item.mediaType === "tv" ? "Trending Series" : "Trending Movie"}
                </Text>
              </View>
              <View style={styles.heroBottom}>
                <View style={{ flex: 1, paddingRight: 14 }}>
                  <Text style={styles.heroTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <View style={styles.heroMeta}>
                    {item.year ? <Text style={styles.heroMetaText}>{item.year}</Text> : null}
                    {item.rating ? (
                      <>
                        <Text style={styles.heroDot}>•</Text>
                        <Ionicons name="star" size={12} color="#facc15" />
                        <Text style={styles.heroMetaText}>{item.rating.toFixed(1)}</Text>
                      </>
                    ) : null}
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.heroRound}
                  onPress={() =>
                    toggle({
                      id: item.id,
                      mediaType: item.mediaType,
                      title: item.title,
                      poster: item.poster,
                      year: item.year,
                    })
                  }
                  hitSlop={8}
                  accessibilityLabel="Toggle watchlist"
                >
                  <Ionicons name={inList ? "checkmark" : "add"} size={22} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.heroRound, styles.heroPlay]}
                  onPress={() => open(item)}
                  accessibilityLabel="Open"
                >
                  <Ionicons name="play" size={18} color="#000" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

export default function TmdbHomeScreen() {
  const preferred = useLayoutStore((s) => s.preferredLanguage);
  const language = preferred !== NO_LANGUAGE ? preferred : null;
  const langName = languageName(language);

  if (!tmdbConfigured()) {
    return (
      <View style={styles.screen}>
        <MissingKeyNotice />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList showsHorizontalScrollIndicator={false}
        data={[0]}
        keyExtractor={() => "home"}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
        renderItem={() => (
          <View>
            <Hero />
            <ContinueWatchingRow />
            {language ? (
              <>
                <TmdbRow
                  title={`Popular ${langName} Movies`}
                  rowKey={`lang-movie-${language}`}
                  fetcher={(signal) => getPopularInLanguage("movie", language, signal)}
                />
                <TmdbRow
                  title={`Popular ${langName} Series`}
                  rowKey={`lang-tv-${language}`}
                  fetcher={(signal) => getPopularInLanguage("tv", language, signal)}
                />
              </>
            ) : null}
            <TmdbRow title="Trending This Week" rowKey="trending" fetcher={getTrending} />
            <TmdbRow title="Popular Movies" rowKey="popular-movie" fetcher={(s) => getPopular("movie", s)} />
            <TmdbRow title="Popular Series" rowKey="popular-tv" fetcher={(s) => getPopular("tv", s)} />
            <TmdbRow title="Now Playing" rowKey="now-playing" fetcher={getNowPlaying} />
            <TmdbRow title="On The Air" rowKey="on-the-air" fetcher={getOnTheAir} />
            <TmdbRow title="Top Rated Movies" rowKey="top-movie" fetcher={(s) => getTopRated("movie", s)} />
            <TmdbRow title="Top Rated Series" rowKey="top-tv" fetcher={(s) => getTopRated("tv", s)} />
            <TmdbRow
              title="Discover Movies"
              rowKey={`discover-movie-${DISCOVER_PAGE}`}
              fetcher={(s) => getDiscover("movie", DISCOVER_PAGE, s)}
            />
            <TmdbRow
              title="Discover Series"
              rowKey={`discover-tv-${DISCOVER_PAGE}`}
              fetcher={(s) => getDiscover("tv", DISCOVER_PAGE, s)}
            />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000" },
  heroWrap: { height: HERO_HEIGHT + 36, marginBottom: 14, paddingTop: 8 },
  heroCard: {
    width: HERO_WIDTH,
    height: HERO_HEIGHT,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: "#111",
  },
  heroBadge: {
    position: "absolute",
    top: 16,
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  heroBadgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  heroBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 20,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
  },
  heroTitle: { color: "#fff", fontSize: 26, fontWeight: "800", lineHeight: 32 },
  heroMeta: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
  heroMetaText: { color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: "500" },
  heroDot: { color: "rgba(255,255,255,0.5)", fontSize: 13 },
  heroRound: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(42,42,42,0.92)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.38)",
  },
  heroPlay: { backgroundColor: "#fff", borderColor: "rgba(255,255,255,0.7)" },
});
