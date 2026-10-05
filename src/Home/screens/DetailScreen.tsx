import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  StatusBar,
  Dimensions,
  Animated,
  Share,
  Alert,
  Easing,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePlayerStore } from "@/store/usePlayerStore";
import { useMeta, useStream, useEpisodes } from "@/hooks/useProvider";
import { useProviderStore } from "@/store/useProviderStore";
import { useWatchlistStore } from "@/store/useWatchlistStore";
import { useThemeStore } from "@/store/useThemeStore";
import SeasonList, { LinkItem } from "@/components/SeasonList";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const BACKDROP_HEIGHT = SCREEN_HEIGHT * 0.34; // ✅ slightly smaller

// ===== Skeleton Shimmer Primitive =====
function Shimmer({ style, width, height, borderRadius = 6 }: any) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [shimmerAnim]);

  const translateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-SCREEN_WIDTH, SCREEN_WIDTH],
  });

  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: "#1f1f1f",
          overflow: "hidden",
        },
        style,
      ]}
    >
      <Animated.View
        style={{
          ...StyleSheet.absoluteFill,
          transform: [{ translateX }],
        }}
      >
        <LinearGradient
          colors={["#1f1f1f", "#2a2a2a", "#1f1f1f"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ width: SCREEN_WIDTH * 1.2, height: "100%" }}
        />
      </Animated.View>
    </View>
  );
}

// ===== Full-page skeleton matching the real layout =====
function DetailSkeleton() {
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      {/* Backdrop skeleton */}
      <View style={styles.backdropWrap}>
        <View
          style={{ width: "100%", height: "100%", backgroundColor: "#1a1a1a" }}
        />
      </View>

      {/* Logo skeleton */}
      <View style={styles.logoWrap}>
        <Shimmer width={SCREEN_WIDTH * 0.55} height={58} borderRadius={6} />
      </View>

      {/* Meta row skeleton */}
      <View style={styles.metaRow}>
        <Shimmer width={44} height={12} borderRadius={4} />
        <View style={{ width: 12 }} />
        <Shimmer width={54} height={16} borderRadius={4} />
        <View style={{ width: 12 }} />
        <Shimmer width={52} height={12} borderRadius={4} />
        <View style={{ width: 12 }} />
        <Shimmer width={86} height={12} borderRadius={4} />
      </View>

      {/* Watch Now button skeleton */}
      <View style={styles.watchNowWrap}>
        <Shimmer width="100%" height={44} borderRadius={10} />
      </View>

      {/* Genre row skeleton */}
      <View style={{ ...styles.genreScroll, justifyContent: "center" }}>
        <Shimmer width={62} height={12} borderRadius={4} />
        <View style={{ width: 18 }} />
        <Shimmer width={72} height={12} borderRadius={4} />
        <View style={{ width: 18 }} />
        <Shimmer width={96} height={12} borderRadius={4} />
      </View>

      {/* Synopsis skeleton */}
      <View style={styles.synopsisWrap}>
        <Shimmer
          width="100%"
          height={11}
          borderRadius={4}
          style={{ marginBottom: 8 }}
        />
        <Shimmer
          width="100%"
          height={11}
          borderRadius={4}
          style={{ marginBottom: 8 }}
        />
        <Shimmer
          width="92%"
          height={11}
          borderRadius={4}
          style={{ marginBottom: 8 }}
        />
        <Shimmer width="70%" height={11} borderRadius={4} />
      </View>

      {/* Action row skeleton */}
      <View style={styles.actionRow}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.actionItem}>
            <Shimmer width={26} height={26} borderRadius={13} />
            <View style={{ height: 6 }} />
            <Shimmer width={52} height={10} borderRadius={4} />
          </View>
        ))}
      </View>

      {/* Episodes heading skeleton */}
      <View style={styles.contentSection}>
        <Shimmer
          width={110}
          height={16}
          borderRadius={6}
          style={{ marginBottom: 16 }}
        />
        <Shimmer
          width="100%"
          height={60}
          borderRadius={12}
          style={{ marginBottom: 10 }}
        />
        <Shimmer
          width="100%"
          height={60}
          borderRadius={12}
          style={{ marginBottom: 10 }}
        />
        <Shimmer width="100%" height={60} borderRadius={12} />
      </View>
    </ScrollView>
  );
}

// Format runtime: "133 min" → "2h 13m"
const formatRuntime = (val?: string | number) => {
  if (!val) return null;
  const mins =
    typeof val === "number"
      ? val
      : parseInt(String(val).match(/\d+/)?.[0] || "", 10);
  if (!mins || isNaN(mins)) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

export default function DetailScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const [rated, setRated] = useState(false);

  const slideAnim = useRef(new Animated.Value(40)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const globalActiveProvider = useProviderStore((s) => s.activeProvider);
  const providerId = route.params?.providerId || globalActiveProvider;
  const { primaryColor } = useThemeStore();
  const { movie } = route.params;
  const setVideo = usePlayerStore((s) => s.setVideo);

  const toggleWatchlist = useWatchlistStore((s) => s.toggleWatchlist);
  const watchlistMovies = useWatchlistStore((s) => s.movies);
  const inWatchlist = watchlistMovies.some((m) => m.link === movie.link);

  const { data: meta, isLoading: isMetaLoading } = useMeta(
    providerId,
    movie.link,
  );

  const [streamLink, setStreamLink] = useState("");
  const [streamType, setStreamType] = useState("movie");
  const [shouldFetchStream, setShouldFetchStream] = useState(false);
  const [isFetchingStream, setIsFetchingStream] = useState(false);
  const { refetch: fetchStream } = useStream(
    providerId,
    streamLink,
    streamType,
  );

  const [pendingEpisodesUrl, setPendingEpisodesUrl] = useState("");
  const { data: pendingEpisodes } = useEpisodes(providerId, pendingEpisodesUrl);

  const [extra, setExtra] = useState<any>(null);
  useEffect(() => {
    if (!meta) return;
    let cancelled = false;
    const type = (meta.type || movie.type) === "series" ? "series" : "movie";
    const apply = (m: any) => {
      if (!cancelled && m) setExtra(m);
    };
    if (meta.imdbId) {
      fetch(`https://v3-cinemeta.strem.io/meta/${type}/${meta.imdbId}.json`)
        .then((r) => r.json())
        .then((j) => apply(j?.meta))
        .catch(() => {});
    } else {
      fetch(
        `https://v3-cinemeta.strem.io/catalog/${type}/top/search=${encodeURIComponent(
          meta.title || movie.title,
        )}.json`,
      )
        .then((r) => r.json())
        .then((j) => apply(j?.metas?.[0]))
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [meta?.imdbId, meta?.type, meta?.title]);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 9,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }),
    ]).start();
  }, [slideAnim, fadeAnim]);

  useEffect(() => {
    if (!shouldFetchStream || !streamLink) return;
    const fetchAndPlay = async () => {
      setIsFetchingStream(true);
      const { data, error } = await fetchStream();
      setIsFetchingStream(false);
      setShouldFetchStream(false);
      if (error || !data) return;
      const streams: any[] = Array.isArray(data) ? data : [data];
      const first = streams[0];
      if (!first?.link) return;
      setVideo(first.link, streams, 0, {
        title: meta?.title || movie.title,
        episode: streamType === "series" ? "Now Playing" : undefined,
      });
      navigation.navigate("Player");
    };
    fetchAndPlay();
  }, [
    shouldFetchStream,
    streamLink,
    streamType,
    fetchStream,
    navigation,
    setVideo,
    meta,
    movie,
  ]);

  useEffect(() => {
    if (pendingEpisodesUrl && pendingEpisodes && pendingEpisodes.length > 0) {
      handlePlay(pendingEpisodes[0].link, "series", pendingEpisodes);
      setPendingEpisodesUrl("");
    }
  }, [pendingEpisodes, pendingEpisodesUrl]);

  const filteredLinkList: LinkItem[] = useMemo(() => {
    if (!meta?.linkList || meta.linkList.length === 0) {
      return [
        {
          title: "Default",
          directLinks: [
            {
              link: movie.link,
              title: meta?.title || "Play",
              type: meta?.type || "movie",
            },
          ],
        },
      ];
    }
    return meta.linkList;
  }, [meta?.linkList, meta?.title, meta?.type, movie.link]);

  const handlePlay = (link: string, type: string, episodeData: any[]) => {
    setStreamLink(link);
    setStreamType(type);
    setShouldFetchStream(true);
  };

  const handleWatchNow = () => {
    const list = meta?.linkList;
    if (!list || list.length === 0) {
      handlePlay(movie.link, meta?.type || "movie", []);
      return;
    }
    const first = list[0];
    if (first.directLinks && first.directLinks.length > 0) {
      const item = first.directLinks[0];
      handlePlay(item.link, item.type || "series", first.directLinks);
    } else if (first.episodesLink) {
      setPendingEpisodesUrl(first.episodesLink);
    }
  };

  const handleToggleWatchlist = () => {
    toggleWatchlist({
      link: movie.link,
      title: movie.title,
      image: movie.image,
      providerId,
      type: movie.type,
    });
  };

  const handleShare = () => {
    Share.share({
      message: `${meta?.title || movie.title} — Watch now on K45Movies!`,
      title: meta?.title || movie.title,
    }).catch(() => {});
  };

  // ✅ Show SKELETON instead of spinner when loading
  if (isMetaLoading || !meta) {
    return (
      <View style={styles.container}>
        <StatusBar
          barStyle="light-content"
          backgroundColor="transparent"
          translucent
        />
        <DetailSkeleton />
        {/* Close button still visible during skeleton */}
        <View
          style={[styles.topBar, { paddingTop: insets.top + 10 }]}
          pointerEvents="box-none"
        >
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            style={styles.closeBtn}
          >
            <Ionicons
              name="close"
              size={26}
              color="#fff"
              style={{
                textShadowColor: "rgba(0,0,0,0.8)",
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 4,
              }}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const backdrop =
    extra?.background || meta.backdrop || meta.image || movie.image;
  const logo = extra?.logo;
  const poster = meta.image || movie.image;

  const metaItems: { text?: string; badge?: string }[] = [];
  if (meta.year) metaItems.push({ text: String(meta.year) });
  const cert = extra?.certification || meta.certification;
  if (cert) metaItems.push({ badge: cert });
  const runtime = formatRuntime(
    extra?.runtime || meta.runtime || meta.duration,
  );
  if (runtime) metaItems.push({ text: runtime });
  const languages = extra?.languages || meta.languages;
  if (languages) {
    const count = Array.isArray(languages) ? languages.length : null;
    metaItems.push({ text: count ? `${count} Languages` : String(languages) });
  }

  const genreList: string[] = Array.isArray(meta.genre)
    ? meta.genre
    : typeof meta.genre === "string"
      ? meta.genre
          .split(",")
          .map((g: string) => g.trim())
          .filter(Boolean)
      : [];

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      <Animated.View
        style={{
          flex: 1,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {/* 🎬 FULL-WIDTH BACKDROP */}
          <View style={styles.backdropWrap}>
            <Image
              source={{ uri: backdrop }}
              style={styles.backdropImage}
              resizeMode="cover"
            />
          </View>

          {/* 🏷 CENTERED LOGO */}
          <View style={styles.logoWrap}>
            {logo ? (
              <Image
                source={{ uri: logo }}
                style={styles.logoImage}
                resizeMode="contain"
              />
            ) : (
              <Text style={styles.logoFallbackTitle} numberOfLines={2}>
                {meta.title}
              </Text>
            )}
          </View>

          {/* 📋 META ROW */}
          {metaItems.length > 0 && (
            <View style={styles.metaRow}>
              {metaItems.map((item, i) => (
                <View key={i} style={styles.metaItemWrap}>
                  {i > 0 && <Text style={styles.metaDot}>·</Text>}
                  {item.badge ? (
                    <View style={styles.certBadge}>
                      <Text style={styles.certBadgeText}>{item.badge}</Text>
                    </View>
                  ) : (
                    <Text style={styles.metaText}>{item.text}</Text>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* ▶ WATCH NOW */}
          <View style={styles.watchNowWrap}>
            <TouchableOpacity
              style={styles.watchNowButton}
              onPress={handleWatchNow}
              disabled={isFetchingStream}
              activeOpacity={0.85}
            >
              {isFetchingStream ? (
                <ActivityIndicator color="#0B0B0F" size="small" />
              ) : (
                <>
                  <Ionicons name="play" size={16} color="#0B0B0F" />
                  <Text style={styles.watchNowText}>Watch Now</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* 🎭 GENRES */}
          {genreList.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.genreScroll}
            >
              {genreList.map((g, i) => (
                <View key={i} style={styles.genreItemWrap}>
                  {i > 0 && <View style={styles.genreDivider} />}
                  <Text style={styles.genreText}>{g}</Text>
                </View>
              ))}
            </ScrollView>
          )}

          {/* 📖 SYNOPSIS */}
          <View style={styles.synopsisWrap}>
            <Text style={styles.synopsisText}>
              {meta.synopsis ||
                meta.description ||
                "No description available for this title."}
            </Text>
          </View>

          {/* 🔧 ACTION ROW */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.actionItem}
              onPress={handleToggleWatchlist}
            >
              <Ionicons
                name={inWatchlist ? "checkmark" : "add"}
                size={22}
                color={inWatchlist ? "#10b981" : "#F2F2F2"}
              />
              <Text style={styles.actionLabel}>Watchlist</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionItem} onPress={handleShare}>
              <Ionicons name="arrow-redo-outline" size={22} color="#F2F2F2" />
              <Text style={styles.actionLabel}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() =>
                Alert.alert("Download", "Download manager coming soon!")
              }
            >
              <Ionicons name="download-outline" size={22} color="#F2F2F2" />
              <Text style={styles.actionLabel}>Download</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => setRated(!rated)}
            >
              <Ionicons
                name={rated ? "heart" : "heart-outline"}
                size={22}
                color={rated ? primaryColor : "#F2F2F2"}
              />
              <Text style={styles.actionLabel}>Rate</Text>
            </TouchableOpacity>
          </View>

          {/* 🎬 EPISODES / SERVERS */}
          <View style={styles.contentSection}>
            <SeasonList
              key={`${providerId}-${movie.link}`}
              linkList={filteredLinkList}
              providerValue={providerId}
              metaTitle={meta.title}
              sortKey={movie.link}
              poster={poster}
              onPlay={handlePlay}
              fetchingLink={isFetchingStream ? streamLink : null}
            />
          </View>
        </ScrollView>
      </Animated.View>

      {/* ✕ CLOSE */}
      <View
        style={[styles.topBar, { paddingTop: insets.top + 10 }]}
        pointerEvents="box-none"
      >
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          style={styles.closeBtn}
        >
          <Ionicons
            name="close"
            size={26}
            color="#fff"
            style={{
              textShadowColor: "rgba(0,0,0,0.8)",
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 4,
            }}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#141414" },

  // ✕ Close
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    paddingHorizontal: 16,
    zIndex: 10,
  },
  closeBtn: { padding: 4 },

  // 🎬 Backdrop (smaller)
  backdropWrap: {
    width: "100%",
    height: BACKDROP_HEIGHT,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
  },
  backdropImage: { width: "100%", height: "100%" },

  // 🏷 Logo (smaller)
  logoWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
    minHeight: 72,
    paddingHorizontal: 40,
  },
  logoImage: { width: "60%", height: 72 },
  logoFallbackTitle: {
    color: "#fff",
    fontSize: 21,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -0.3,
  },

  // 📋 Meta row (smaller)
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    marginTop: 14,
    paddingHorizontal: 16,
  },
  metaItemWrap: { flexDirection: "row", alignItems: "center" },
  metaDot: {
    color: "#8A8A8A",
    fontSize: 14,
    fontWeight: "700",
    marginHorizontal: 7,
  },
  metaText: { color: "#fff", fontSize: 13.5, fontWeight: "700" },
  certBadge: {
    backgroundColor: "#616161",
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  certBadgeText: { color: "#fff", fontSize: 11.5, fontWeight: "700" },

  // ▶ Watch Now (smaller)
  watchNowWrap: { paddingHorizontal: 16, marginTop: 18 },
  watchNowButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 44,
    borderRadius: 8,
    backgroundColor: "#E6E6F0",
  },
  watchNowText: { color: "#0B0B0F", fontSize: 15, fontWeight: "800" },

  // 🎭 Genres (smaller)
  genreScroll: { paddingHorizontal: 16, marginTop: 22, alignItems: "center" },
  genreItemWrap: { flexDirection: "row", alignItems: "center" },
  genreDivider: {
    width: 1.2,
    height: 16,
    backgroundColor: "#3D3D3D",
    marginHorizontal: 11,
  },
  genreText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  // 📖 Synopsis (smaller)
  synopsisWrap: { paddingHorizontal: 16, marginTop: 12 },
  synopsisText: { color: "#9E9E9E", fontSize: 13.5, lineHeight: 21 },

  // 🔧 Action row (smaller)
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    marginTop: 28,
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  actionItem: { alignItems: "center", minWidth: 56 },
  actionLabel: { color: "#B3B3B3", fontSize: 12, marginTop: 6 },

  contentSection: { paddingHorizontal: 16 },
});
