// Details screen for the Movie Based layout. Metadata comes from TMDB; streams
// come from the user's installed providers (see lib/titleBridge.ts) and are
// played by the app's existing player.
//
//   movie  → backdrop + title page with a language-sorted quality list
//   series → poster header, season chips, episode cards, and a quality sheet
//            for the episode the user picks

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Modal,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Skeleton from "@/components/Skeleton";
import { useThemeStore } from "@/store/useThemeStore";
import { useTmdbWatchlistStore } from "@/store/useTmdbWatchlistStore";
import {
  continueKey,
  useTmdbContinueWatchingStore,
} from "@/store/useTmdbContinueWatchingStore";
import { useTmdbDetails, useTmdbSeason } from "@/hooks/useTmdb";
import { useEpisodeSources, useMovieSources } from "@/hooks/useTitleSources";
import { playSource, type PlayTarget } from "@/lib/tmdbPlayback";
import {
  tmdbImage,
  type TmdbDetails,
  type TmdbEpisode,
  type TmdbItem,
  type TmdbMediaType,
} from "@/lib/tmdbApi";
import type { BridgeMedia, SourceOption } from "@/lib/titleBridge";
import SourcesPanel from "../components/SourcesPanel";
import { PosterCard, RowHeader, formatRuntime } from "../components/common";

// ---- shared helpers --------------------------------------------------------

type PlayQueue = {
  options: SourceOption[];
  providerNames?: Record<string, string>;
  unchecked?: number;
};

/** Everything the list knows now, handed to the player as its stream queue. */
function buildQueue(sources: {
  options: SourceOption[];
  providers: { providerId: string; name: string; status: string }[];
}): PlayQueue {
  return {
    options: sources.options,
    providerNames: Object.fromEntries(
      sources.providers.map((p) => [p.providerId, p.name]),
    ),
    unchecked: sources.providers.filter(
      (p) => p.status === "searching" || p.status === "resolving",
    ).length,
  };
}

function usePlayback(navigation: any) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  const play = useCallback(
    async (
      option: SourceOption,
      target: PlayTarget,
      onOpen?: () => void,
      queue?: PlayQueue,
    ) => {
      if (busy.current) return;
      busy.current = true;
      const controller = new AbortController();
      abort.current = controller;
      setError(null);
      setPlayingId(option.id);
      try {
        await playSource(option, target, {
          openPlayer: () => {
            onOpen?.();
            if (navigation.isFocused()) navigation.navigate("Player");
          },
          onStage: setStage,
          signal: controller.signal,
        }, queue);
      } catch (e: any) {
        if (!controller.signal.aborted) {
          setError(e?.message || "Could not start playback.");
        }
      } finally {
        busy.current = false;
        setPlayingId(null);
        setStage(null);
      }
    },
    [navigation],
  );

  return { play, playingId, stage, error, clearError: () => setError(null) };
}

function useDetailActions(details: TmdbDetails) {
  const saved = useTmdbWatchlistStore((s) =>
    s.items.some((item) => item.key === `${details.mediaType}:${details.id}`),
  );
  const toggle = useTmdbWatchlistStore((s) => s.toggle);
  return {
    saved,
    toggleWatchlist: () =>
      toggle({
        id: details.id,
        mediaType: details.mediaType,
        title: details.title,
        poster: details.poster,
        year: details.year,
      }),
    share: () =>
      Share.share({
        message: `${details.title} — Watch now on K45Movies!`,
        title: details.title,
      }).catch(() => {}),
    trailer: details.trailerKey
      ? () =>
          Linking.openURL(
            `https://www.youtube.com/watch?v=${details.trailerKey}`,
          ).catch(() => {})
      : null,
  };
}

function playTarget(
  details: TmdbDetails,
  episode?: { season: number; episode: number; name: string },
): PlayTarget {
  return {
    mediaType: details.mediaType,
    id: details.id,
    title: details.title,
    imageUrl: tmdbImage(details.poster, "w500") || undefined,
    poster: details.poster,
    backdrop: details.backdrop,
    season: episode?.season,
    episode: episode?.episode,
    episodeTitle: episode?.name || undefined,
  };
}

function CloseButton({ onPress, top }: { onPress: () => void; top: number }) {
  return (
    <View style={[styles.topBar, { paddingTop: top }]} pointerEvents="box-none">
      <View style={{ flex: 1 }} />
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={styles.closeBtn}
        accessibilityLabel="Close"
      >
        <Ionicons name="close" size={26} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

function ErrorBanner({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <View style={styles.errorBanner}>
      <Ionicons name="alert-circle-outline" size={18} color="#F87171" />
      <Text style={styles.errorText} numberOfLines={3}>
        {message}
      </Text>
      <TouchableOpacity onPress={onClose} hitSlop={8}>
        <Ionicons name="close" size={18} color="#9A9A9A" />
      </TouchableOpacity>
    </View>
  );
}

function ActionRow({ details }: { details: TmdbDetails }) {
  const { primaryColor } = useThemeStore();
  const { saved, toggleWatchlist, share, trailer } = useDetailActions(details);
  return (
    <View style={styles.actionRow}>
      <TouchableOpacity style={styles.actionItem} onPress={toggleWatchlist}>
        <Ionicons
          name={saved ? "checkmark" : "add"}
          size={22}
          color={saved ? "#10b981" : "#F2F2F2"}
        />
        <Text style={styles.actionLabel}>Watchlist</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.actionItem} onPress={share}>
        <Ionicons name="arrow-redo-outline" size={22} color="#F2F2F2" />
        <Text style={styles.actionLabel}>Share</Text>
      </TouchableOpacity>
      {trailer ? (
        <TouchableOpacity style={styles.actionItem} onPress={trailer}>
          <Ionicons name="logo-youtube" size={22} color={primaryColor} />
          <Text style={styles.actionLabel}>Trailer</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function CastRow({ details }: { details: TmdbDetails }) {
  if (details.cast.length === 0) return null;
  return (
    <View style={styles.section}>
      <RowHeader title="Cast" />
      <FlatList showsVerticalScrollIndicator={false}
        data={details.cast}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(person) => String(person.id)}
        ItemSeparatorComponent={() => <View style={{ width: 14 }} />}
        renderItem={({ item }) => {
          const uri = tmdbImage(item.photo, "w185");
          return (
            <View style={styles.castItem}>
              <View style={styles.castPhoto}>
                {uri ? (
                  <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                ) : (
                  <Ionicons name="person" size={26} color="#444" />
                )}
              </View>
              <Text style={styles.castName} numberOfLines={2}>
                {item.name}
              </Text>
              {item.character ? (
                <Text style={styles.castRole} numberOfLines={1}>
                  {item.character}
                </Text>
              ) : null}
            </View>
          );
        }}
      />
    </View>
  );
}

function SimilarRow({ details, navigation }: { details: TmdbDetails; navigation: any }) {
  if (details.similar.length === 0) return null;
  return (
    <View style={styles.section}>
      <RowHeader title={details.mediaType === "tv" ? "More Like This" : "Similar Movies"} />
      <FlatList showsVerticalScrollIndicator={false}
        data={details.similar}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item: TmdbItem) => `${item.mediaType}:${item.id}`}
        ItemSeparatorComponent={() => <View style={{ width: 14 }} />}
        renderItem={({ item }) => (
          <PosterCard
            item={item}
            width={112}
            onPress={() =>
              navigation.push("TmdbDetail", {
                id: item.id,
                mediaType: item.mediaType,
                title: item.title,
              })
            }
          />
        )}
      />
    </View>
  );
}

function GenreLine({ genres }: { genres: string[] }) {
  if (genres.length === 0) return null;
  return (
    <ScrollView showsVerticalScrollIndicator={false}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.genreScroll}
    >
      {genres.map((genre, i) => (
        <View key={genre} style={styles.genreItem}>
          {i > 0 ? <View style={styles.genreDivider} /> : null}
          <Text style={styles.genreText}>{genre}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

// ---- movie -----------------------------------------------------------------

function MovieDetail({ details, navigation }: { details: TmdbDetails; navigation: any }) {
  const insets = useSafeAreaInsets();
  const { primaryColor } = useThemeStore();

  const media = useMemo<BridgeMedia>(
    () => ({
      mediaType: "movie",
      title: details.title,
      originalTitle: details.originalTitle,
      year: details.year,
    }),
    [details.title, details.originalTitle, details.year],
  );
  const sources = useMovieSources(media);
  const { play, playingId, stage, error, clearError } = usePlayback(navigation);
  const target = useMemo(() => playTarget(details), [details]);

  const first = sources.options[0];
  // "Play first": tapping Watch Now before any provider answered starts the
  // first stream the moment it shows up.
  const [wantPlay, setWantPlay] = useState(false);
  useEffect(() => {
    if (wantPlay && first && !playingId) {
      setWantPlay(false);
      play(first, target, undefined, buildQueue(sources));
    } else if (wantPlay && !first && !sources.loading) {
      setWantPlay(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantPlay, first, sources.loading, playingId]);
  const backdrop =
    tmdbImage(details.backdrop, "w780") || tmdbImage(details.poster, "w780");

  const metaItems: { text?: string; badge?: string }[] = [];
  if (details.year) metaItems.push({ text: details.year });
  if (details.certification) metaItems.push({ badge: details.certification });
  const runtime = formatRuntime(details.runtime);
  if (runtime) metaItems.push({ text: runtime });
  if (details.rating) metaItems.push({ text: `★ ${details.rating.toFixed(1)}` });

  let watchLabel = "Watch Now";
  const noStreams = !first && !sources.loading && !sources.noProviders;
  if (playingId) watchLabel = stage || "Preparing…";
  else if (wantPlay && !first) watchLabel = "Finding streams…";
  else if (noStreams) watchLabel = "No streams found";
  else if (sources.noProviders) watchLabel = "No providers installed";

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <ScrollView showsHorizontalScrollIndicator={false} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={styles.movieBackdrop}>
          {backdrop ? (
            <Image source={{ uri: backdrop }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : null}
          <LinearGradient
            colors={["rgba(20,20,20,0)", "rgba(20,20,20,0.55)", "#141414"]}
            locations={[0.45, 0.8, 1]}
            style={StyleSheet.absoluteFill}
          />
        </View>

        <View style={styles.titleWrap}>
          <Text style={styles.movieTitle} numberOfLines={3}>
            {details.title}
          </Text>
          {details.tagline ? (
            <Text style={styles.tagline} numberOfLines={2}>
              {details.tagline}
            </Text>
          ) : null}
        </View>

        {metaItems.length > 0 ? (
          <View style={styles.metaRow}>
            {metaItems.map((item, i) => (
              <View key={i} style={styles.metaItem}>
                {i > 0 ? <Text style={styles.metaDot}>·</Text> : null}
                {item.badge ? (
                  <View style={styles.certBadge}>
                    <Text style={styles.certText}>{item.badge}</Text>
                  </View>
                ) : (
                  <Text style={styles.metaText}>{item.text}</Text>
                )}
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.watchWrap}>
          <TouchableOpacity
            style={[
              styles.watchBtn,
              (noStreams || sources.noProviders || !!playingId) && styles.watchBtnDim,
            ]}
            disabled={noStreams || sources.noProviders || !!playingId || wantPlay}
            activeOpacity={0.85}
            onPress={() =>
              first
                ? play(first, target, undefined, buildQueue(sources))
                : setWantPlay(true)
            }
          >
            {playingId || wantPlay ? (
              <ActivityIndicator size="small" color="#0B0B0F" />
            ) : (
              <Ionicons name="play" size={16} color="#0B0B0F" />
            )}
            <Text style={styles.watchText}>{watchLabel}</Text>
          </TouchableOpacity>
          {error ? <ErrorBanner message={error} onClose={clearError} /> : null}
        </View>

        <GenreLine genres={details.genres} />

        <View style={styles.synopsisWrap}>
          <Text style={styles.synopsis}>
            {details.overview || "No description available for this title."}
          </Text>
        </View>

        <ActionRow details={details} />

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <View style={[styles.accent, { backgroundColor: primaryColor }]} />
            <Text style={styles.sectionTitle}>Qualities</Text>
          </View>
          <View style={{ paddingRight: 16 }}>
            <SourcesPanel
              options={sources.options}
              providers={sources.providers}
              loading={sources.loading}
              checkingAudio={sources.checkingAudio}
              preferredCode={sources.preferredCode}
              noProviders={sources.noProviders}
              playingId={playingId}
              stage={stage}
              onPlay={(option) => play(option, target, undefined, buildQueue(sources))}
            />
          </View>
        </View>

        <CastRow details={details} />
        <SimilarRow details={details} navigation={navigation} />
      </ScrollView>
      <CloseButton onPress={() => navigation.goBack()} top={insets.top + 10} />
    </View>
  );
}

// ---- series ----------------------------------------------------------------

type EpisodeSelection = { season: number; episode: number; name: string };

const todayIso = () => new Date().toISOString().slice(0, 10);

function EpisodeCard({
  episode,
  fallback,
  onPress,
}: {
  episode: TmdbEpisode;
  fallback: string | null;
  onPress: () => void;
}) {
  const { primaryColor } = useThemeStore();
  const still = tmdbImage(episode.still, "w342") || fallback;
  const upcoming = !!episode.airDate && episode.airDate > todayIso();
  const runtime = formatRuntime(episode.runtime);
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={upcoming}
      onPress={onPress}
      style={[styles.episode, upcoming && { opacity: 0.55 }]}
    >
      <View style={styles.still}>
        {still ? (
          <Image source={{ uri: still }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : null}
        <View style={styles.stillOverlay}>
          <Ionicons
            name={upcoming ? "time-outline" : "play"}
            size={upcoming ? 20 : 16}
            color="#fff"
          />
        </View>
        <View style={[styles.epBadge, { backgroundColor: primaryColor }]}>
          <Text style={styles.epBadgeText}>E{episode.number}</Text>
        </View>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.epTitle} numberOfLines={1}>
          {episode.name}
        </Text>
        <Text style={styles.epMeta} numberOfLines={1}>
          {upcoming
            ? `Airs ${episode.airDate}`
            : [runtime, episode.airDate].filter(Boolean).join(" · ")}
        </Text>
        {episode.overview ? (
          <Text style={styles.epOverview} numberOfLines={2}>
            {episode.overview}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

function SeriesDetail({ details, navigation }: { details: TmdbDetails; navigation: any }) {
  const insets = useSafeAreaInsets();
  const { primaryColor } = useThemeStore();
  const resume = useTmdbContinueWatchingStore((s) =>
    s.items.find((item) => item.key === continueKey("tv", details.id)),
  );

  const seasons = useMemo(
    () =>
      details.seasons.length > 0
        ? details.seasons
        : [{ number: 1, name: "Season 1", episodeCount: 0, airYear: "", poster: null }],
    [details.seasons],
  );
  const [season, setSeason] = useState<number>(
    () => resume?.season ?? seasons[0].number,
  );
  const [selected, setSelected] = useState<EpisodeSelection | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const media = useMemo<BridgeMedia>(
    () => ({
      mediaType: "tv",
      title: details.title,
      originalTitle: details.originalTitle,
      year: details.year,
      numberOfSeasons: details.numberOfSeasons || seasons.length,
    }),
    [details.title, details.originalTitle, details.year, details.numberOfSeasons, seasons.length],
  );

  // Provider search starts as soon as the page opens, so quality rows appear
  // quickly once an episode is picked.
  const sources = useEpisodeSources(
    media,
    selected?.season ?? null,
    selected?.episode ?? null,
  );
  const { play, playingId, stage, error, clearError } = usePlayback(navigation);
  const {
    data: seasonData,
    isLoading: seasonLoading,
    isError: seasonError,
    refetch: refetchSeason,
  } = useTmdbSeason(details.id, season);

  const poster = tmdbImage(details.poster, "w342");
  const backdrop =
    tmdbImage(details.backdrop, "w780") || tmdbImage(details.poster, "w780");
  const episodeFallback = tmdbImage(details.backdrop, "w342");

  const openEpisode = (choice: EpisodeSelection) => {
    clearError();
    setSelected(choice);
    setSheetOpen(true);
  };

  const target = useMemo(
    () => (selected ? playTarget(details, selected) : playTarget(details)),
    [details, selected],
  );

  const playLabel = resume
    ? `Continue S${resume.season} E${resume.episode}`
    : `Play S${seasons[0].number} E1`;

  const metaBits = [
    details.year,
    details.certification,
    details.numberOfSeasons
      ? `${details.numberOfSeasons} Season${details.numberOfSeasons > 1 ? "s" : ""}`
      : "",
    details.rating ? `★ ${details.rating.toFixed(1)}` : "",
  ].filter(Boolean);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <ScrollView showsHorizontalScrollIndicator={false} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={styles.seriesBackdrop}>
          {backdrop ? (
            <Image source={{ uri: backdrop }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : null}
          <LinearGradient
            colors={["rgba(20,20,20,0.1)", "rgba(20,20,20,0.7)", "#141414"]}
            locations={[0.2, 0.75, 1]}
            style={StyleSheet.absoluteFill}
          />
        </View>

        <View style={styles.seriesHead}>
          <View style={styles.seriesPoster}>
            {poster ? (
              <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : null}
          </View>
          <View style={{ flex: 1, justifyContent: "flex-end" }}>
            <View style={[styles.typePill, { borderColor: `${primaryColor}99` }]}>
              <Text style={[styles.typePillText, { color: primaryColor }]}>SERIES</Text>
            </View>
            <Text style={styles.seriesTitle} numberOfLines={3}>
              {details.title}
            </Text>
            <Text style={styles.seriesMeta} numberOfLines={2}>
              {metaBits.join("  ·  ")}
            </Text>
            {details.status ? (
              <Text style={styles.seriesStatus}>{details.status}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.watchWrap}>
          <TouchableOpacity
            style={styles.watchBtn}
            activeOpacity={0.85}
            onPress={() =>
              openEpisode(
                resume && resume.season != null && resume.episode != null
                  ? {
                      season: resume.season,
                      episode: resume.episode,
                      name: resume.episodeTitle || "",
                    }
                  : { season: seasons[0].number, episode: 1, name: "" },
              )
            }
          >
            <Ionicons name="play" size={16} color="#0B0B0F" />
            <Text style={styles.watchText}>{playLabel}</Text>
          </TouchableOpacity>
          {error && !sheetOpen ? <ErrorBanner message={error} onClose={clearError} /> : null}
        </View>

        <GenreLine genres={details.genres} />

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setExpanded((value) => !value)}
          style={styles.synopsisWrap}
        >
          <Text style={styles.synopsis} numberOfLines={expanded ? undefined : 4}>
            {details.overview || "No description available for this title."}
          </Text>
          {details.overview.length > 180 ? (
            <Text style={[styles.more, { color: primaryColor }]}>
              {expanded ? "Show less" : "More"}
            </Text>
          ) : null}
        </TouchableOpacity>

        <ActionRow details={details} />

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <View style={[styles.accent, { backgroundColor: primaryColor }]} />
            <Text style={styles.sectionTitle}>Seasons</Text>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingRight: 16 }}
          >
            {seasons.map((item) => {
              const active = item.number === season;
              return (
                <TouchableOpacity
                  key={item.number}
                  activeOpacity={0.8}
                  onPress={() => setSeason(item.number)}
                  style={[
                    styles.seasonChip,
                    active && { backgroundColor: primaryColor, borderColor: primaryColor },
                  ]}
                >
                  <Text style={[styles.seasonName, active && { color: "#fff" }]}>
                    Season {item.number}
                  </Text>
                  {item.episodeCount > 0 ? (
                    <Text style={[styles.seasonCount, active && { color: "rgba(255,255,255,0.8)" }]}>
                      {item.episodeCount} episodes
                    </Text>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={{ marginTop: 14, paddingRight: 16, gap: 10 }}>
            {seasonLoading
              ? [0, 1, 2].map((i) => (
                  <Skeleton key={i} style={{ height: 92, borderRadius: 14 }} />
                ))
              : null}
            {seasonError ? (
              <TouchableOpacity onPress={() => refetchSeason()} style={styles.retry}>
                <Ionicons name="refresh-outline" size={15} color="#ef4444" />
                <Text style={styles.retryText}>Couldn't load episodes — tap to retry</Text>
              </TouchableOpacity>
            ) : null}
            {seasonData?.episodes.map((episode) => (
              <EpisodeCard
                key={episode.number}
                episode={episode}
                fallback={episodeFallback}
                onPress={() =>
                  openEpisode({ season, episode: episode.number, name: episode.name })
                }
              />
            ))}
          </View>
        </View>

        <CastRow details={details} />
        <SimilarRow details={details} navigation={navigation} />
      </ScrollView>
      <CloseButton onPress={() => navigation.goBack()} top={insets.top + 10} />

      <Modal
        visible={sheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetOpen(false)}
      >
        <View style={styles.sheetRoot}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setSheetOpen(false)}
          />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle} numberOfLines={1}>
                  {details.title}
                </Text>
                <Text style={styles.sheetSub} numberOfLines={1}>
                  {selected
                    ? `Season ${selected.season} · Episode ${selected.episode}${
                        selected.name ? ` · ${selected.name}` : ""
                      }`
                    : ""}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSheetOpen(false)} hitSlop={10}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            {error ? <ErrorBanner message={error} onClose={clearError} /> : null}
            <ScrollView showsHorizontalScrollIndicator={false} showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
              <SourcesPanel
                options={sources.options}
                providers={sources.providers}
                loading={sources.loading}
                checkingAudio={sources.checkingAudio}
                preferredCode={sources.preferredCode}
                noProviders={sources.noProviders}
                playingId={playingId}
                stage={stage}
                emptyText="This episode wasn't found in your installed providers. Some providers file each season under a different title."
                onPlay={(option) =>
                  play(option, target, () => setSheetOpen(false), buildQueue(sources))
                }
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ---- screen ----------------------------------------------------------------

export default function TmdbDetailScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { primaryColor } = useThemeStore();
  const { id, mediaType } = route.params as {
    id: number;
    mediaType: TmdbMediaType;
    title?: string;
  };
  const { data, isError, refetch, isRefetching } = useTmdbDetails(mediaType, id);

  if (!data) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        {isError ? (
          <View style={styles.centerWrap}>
            <Ionicons name="cloud-offline-outline" size={52} color="#666" />
            <Text style={styles.centerText}>Couldn't load the details for this title.</Text>
            <TouchableOpacity
              style={[styles.retryBtn, { backgroundColor: primaryColor }]}
              onPress={() => refetch()}
              disabled={isRefetching}
            >
              <Text style={styles.retryBtnText}>{isRefetching ? "Retrying…" : "Retry"}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <Skeleton style={{ width: "100%", height: 300 }} />
            <Skeleton style={{ width: "60%", height: 26, borderRadius: 6, alignSelf: "center", marginTop: 18 }} />
            <Skeleton style={{ width: "86%", height: 90, borderRadius: 10, alignSelf: "center", marginTop: 24 }} />
          </View>
        )}
        <CloseButton onPress={() => navigation.goBack()} top={insets.top + 10} />
      </View>
    );
  }

  return data.mediaType === "tv" ? (
    <SeriesDetail key={`tv-${data.id}`} details={data} navigation={navigation} />
  ) : (
    <MovieDetail key={`movie-${data.id}`} details={data} navigation={navigation} />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#141414" },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    paddingHorizontal: 16,
    zIndex: 10,
  },
  closeBtn: {
    padding: 4,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  centerWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, paddingHorizontal: 40 },
  centerText: { color: "#aaa", fontSize: 14, textAlign: "center", fontWeight: "500" },
  retryBtn: { paddingHorizontal: 30, paddingVertical: 11, borderRadius: 12 },
  retryBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  // shared
  section: { marginTop: 26, paddingLeft: 16 },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  accent: { width: 4, height: 18, borderRadius: 2 },
  sectionTitle: { color: "#fff", fontSize: 19, fontWeight: "700" },
  watchWrap: { paddingHorizontal: 16, marginTop: 18, gap: 10 },
  watchBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: "#F2F2F2",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  watchBtnDim: { opacity: 0.7 },
  watchText: { color: "#0B0B0F", fontSize: 15, fontWeight: "800" },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(248,113,113,0.1)",
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.3)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  errorText: { flex: 1, color: "#fca5a5", fontSize: 12.5 },
  genreScroll: { paddingHorizontal: 16, paddingTop: 16, alignItems: "center" },
  genreItem: { flexDirection: "row", alignItems: "center" },
  genreDivider: { width: 1, height: 12, backgroundColor: "#444", marginHorizontal: 10 },
  genreText: { color: "#bdbdbd", fontSize: 13, fontWeight: "500" },
  synopsisWrap: { paddingHorizontal: 16, marginTop: 14 },
  synopsis: { color: "#cfcfcf", fontSize: 14, lineHeight: 21 },
  more: { fontSize: 12.5, fontWeight: "700", marginTop: 6 },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 20,
    marginHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#2a2a2a",
  },
  actionItem: { alignItems: "center", gap: 4, minWidth: 64 },
  actionLabel: { color: "#cfcfcf", fontSize: 11.5, fontWeight: "500" },
  castItem: { width: 82 },
  castPhoto: {
    width: 70,
    height: 70,
    borderRadius: 35,
    overflow: "hidden",
    alignSelf: "center",
    backgroundColor: "#1a1a1a",
    alignItems: "center",
    justifyContent: "center",
  },
  castName: { color: "#ddd", fontSize: 11.5, fontWeight: "600", textAlign: "center", marginTop: 7 },
  castRole: { color: "#777", fontSize: 10.5, textAlign: "center", marginTop: 1 },

  // movie
  movieBackdrop: { width: "100%", height: 320, backgroundColor: "#1a1a1a" },
  titleWrap: { alignItems: "center", paddingHorizontal: 32, marginTop: -34 },
  movieTitle: { color: "#fff", fontSize: 26, fontWeight: "800", textAlign: "center", letterSpacing: -0.3 },
  tagline: { color: "#8a8a8a", fontSize: 12.5, fontStyle: "italic", textAlign: "center", marginTop: 6 },
  metaRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", flexWrap: "wrap", marginTop: 12, paddingHorizontal: 16 },
  metaItem: { flexDirection: "row", alignItems: "center" },
  metaDot: { color: "#666", marginHorizontal: 8, fontSize: 16 },
  metaText: { color: "#bdbdbd", fontSize: 13, fontWeight: "500" },
  certBadge: { borderWidth: 1, borderColor: "#666", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  certText: { color: "#bdbdbd", fontSize: 11, fontWeight: "700" },

  // series
  seriesBackdrop: { width: "100%", height: 230, backgroundColor: "#1a1a1a" },
  seriesHead: { flexDirection: "row", gap: 14, paddingHorizontal: 16, marginTop: -92 },
  seriesPoster: {
    width: 108,
    height: 162,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  typePill: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginBottom: 6,
  },
  typePillText: { fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  seriesTitle: { color: "#fff", fontSize: 22, fontWeight: "800", lineHeight: 27 },
  seriesMeta: { color: "#bdbdbd", fontSize: 12.5, marginTop: 6 },
  seriesStatus: { color: "#22c55e", fontSize: 12, fontWeight: "700", marginTop: 4 },
  seasonChip: {
    borderWidth: 1.5,
    borderColor: "#262626",
    backgroundColor: "#0a0a0a",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  seasonName: { color: "#ddd", fontSize: 14, fontWeight: "700" },
  seasonCount: { color: "#777", fontSize: 11, marginTop: 2 },
  episode: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#0a0a0a",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#151515",
    padding: 10,
  },
  still: {
    width: 128,
    height: 74,
    borderRadius: 9,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
  },
  stillOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  epBadge: {
    position: "absolute",
    top: 5,
    left: 5,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  epBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  epTitle: { color: "#fff", fontSize: 14, fontWeight: "700" },
  epMeta: { color: "#777", fontSize: 11.5, marginTop: 2 },
  epOverview: { color: "#9a9a9a", fontSize: 12, lineHeight: 17, marginTop: 5 },
  retry: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    backgroundColor: "rgba(239,68,68,0.1)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  retryText: { color: "#ef4444", fontSize: 12.5, fontWeight: "600" },

  // quality sheet
  sheetRoot: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: {
    backgroundColor: "#0f0f0f",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: "#1a1a1a",
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#333",
    marginBottom: 12,
  },
  sheetHead: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  sheetTitle: { color: "#fff", fontSize: 17, fontWeight: "800" },
  sheetSub: { color: "#8a8a8a", fontSize: 12.5, marginTop: 2 },
});
