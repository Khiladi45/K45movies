// TV title page for the Movie Based layout. Same data and play flow as the
// phone page (useMovieSources / useEpisodeSources + playSource), laid out for
// a remote: Play has the first focus and starts the best source (preferred
// language, closest to 1080p), with every source listed below it.
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useThemeStore } from "@/store/useThemeStore";
import { useTmdbWatchlistStore } from "@/store/useTmdbWatchlistStore";
import {
  continueKey,
  useTmdbContinueWatchingStore,
} from "@/store/useTmdbContinueWatchingStore";
import { useTmdbDetails, useTmdbSeason } from "@/hooks/useTmdb";
import {
  useEpisodeSources,
  useMovieSources,
  type ProviderStatus,
} from "@/hooks/useTitleSources";
import { languageName } from "@/lib/languages";
import { tmdbImage, type TmdbDetails } from "@/lib/tmdbApi";
import type { BridgeMedia, SourceOption } from "@/lib/titleBridge";
import { formatRuntime } from "@/Tmdb/components/common";
import { buildQueue, playTarget, usePlayback } from "@/Tmdb/playback";
import Focusable from "../components/Focusable";
import { PosterRow } from "../components/PosterRow";
import { useOpenTvTitle } from "./TvHomeScreen";
import { TV } from "../theme";
import { useRestoreTvFocus } from "../useRestoreTvFocus";
import { useDownloadsStore } from "@/store/useDownloadsStore";
import { useTvTitleDownload } from "../downloads/tvDownloads";
import { OFFLINE_SUFFIX, downloadedEpisodes } from "../downloads/tvDownloadMatch";

type Sources = {
  options: SourceOption[];
  providers: ProviderStatus[];
  loading: boolean;
  checkingAudio: boolean;
  noProviders: boolean;
};

type EpisodeSelection = { season: number; episode: number; name: string };

function statusLine(sources: Sources): string {
  if (sources.noProviders) return "No providers installed — add one in Settings.";
  const searching = sources.providers.filter(
    (p) => p.status === "searching" || p.status === "resolving",
  ).length;
  const parts: string[] = [];
  parts.push(`${sources.options.length} source${sources.options.length === 1 ? "" : "s"}`);
  if (searching > 0) parts.push(`searching ${searching} provider${searching === 1 ? "" : "s"}…`);
  if (sources.checkingAudio) parts.push("checking audio languages…");
  return parts.join("  ·  ");
}

const TvSourceRow = memo(function TvSourceRow({
  option,
  providerName,
  playing,
  onPlay,
}: {
  option: SourceOption;
  providerName: string;
  playing: boolean;
  onPlay: (option: SourceOption) => void;
}) {
  const langs = option.languages.map((code) => languageName(code)).filter(Boolean);
  return (
    <Focusable
      style={styles.source}
      onPress={() => onPlay(option)}
      accessibilityLabel={`Play ${option.label}`}
    >
      <View style={styles.sourceMain}>
        <Text style={styles.sourceLabel} numberOfLines={1}>
          {option.label}
        </Text>
        <Text style={styles.sourceMeta} numberOfLines={1}>
          {[
            providerName,
            option.height ? `${option.height}p` : "",
            option.sizeText || "",
            langs.length ? langs.join(", ") : option.multiAudio ? "Multi audio" : "",
          ]
            .filter(Boolean)
            .join("  ·  ")}
        </Text>
      </View>
      {playing ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Ionicons name="play" size={18} color="#fff" />
      )}
    </Focusable>
  );
});

function SourceList({
  sources,
  playingId,
  onPlay,
}: {
  sources: Sources;
  playingId: string | null;
  onPlay: (option: SourceOption) => void;
}) {
  const names = useMemo(
    () => Object.fromEntries(sources.providers.map((p) => [p.providerId, p.name])),
    [sources.providers],
  );
  // Stable callback so only new or changed rows re-render as providers answer.
  const onPlayRef = useRef(onPlay);
  onPlayRef.current = onPlay;
  const playStable = useCallback((option: SourceOption) => onPlayRef.current(option), []);
  return (
    <View style={styles.sources}>
      <Text style={styles.sectionTitle}>Sources</Text>
      <Text style={styles.status}>{statusLine(sources)}</Text>
      {sources.options.map((option) => (
        <TvSourceRow
          key={option.id}
          option={option}
          providerName={names[option.providerId] || option.providerId}
          playing={playingId === option.id}
          onPlay={playStable}
        />
      ))}
    </View>
  );
}

function Header({
  details,
  onPlay,
  playLabel,
  busy,
  stage,
  error,
  playRef,
  offline = false,
  download,
}: {
  playRef: RefObject<View | null>;
  details: TmdbDetails;
  onPlay: () => void;
  playLabel: string;
  busy: boolean;
  stage: string | null;
  error: string | null;
  /** Play opens the downloaded file (no internet needed). */
  offline?: boolean;
  /** TV downloads: the Download button next to My List. */
  download?: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void };
}) {
  const primaryColor = useThemeStore((s) => s.primaryColor);
  const saved = useTmdbWatchlistStore((s) =>
    s.items.some((item) => item.key === `${details.mediaType}:${details.id}`),
  );
  const toggle = useTmdbWatchlistStore((s) => s.toggle);
  const meta = [
    details.year,
    details.certification,
    details.mediaType === "movie"
      ? formatRuntime(details.runtime)
      : details.numberOfSeasons
        ? `${details.numberOfSeasons} Season${details.numberOfSeasons > 1 ? "s" : ""}`
        : "",
    details.rating ? `★ ${details.rating.toFixed(1)}` : "",
  ].filter(Boolean);

  return (
    <View style={styles.header}>
      <Text style={styles.title} numberOfLines={2}>
        {details.title}
      </Text>
      <Text style={styles.meta}>{meta.join("  ·  ")}</Text>
      {details.genres.length ? (
        <Text style={styles.genres}>{details.genres.slice(0, 4).join(" / ")}</Text>
      ) : null}
      {details.overview ? (
        <Text style={styles.overview} numberOfLines={4}>
          {details.overview}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <Focusable
          ref={playRef}
          hasTVPreferredFocus
          style={[styles.button, { backgroundColor: primaryColor }]}
          onPress={onPlay}
          accessibilityLabel={playLabel}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Ionicons name={offline ? "checkmark-done-circle" : "play"} size={18} color="#fff" />
          )}
          <Text style={styles.buttonText}>{playLabel}</Text>
        </Focusable>
        <Focusable
          style={styles.button}
          onPress={() =>
            toggle({
              id: details.id,
              mediaType: details.mediaType,
              title: details.title,
              poster: details.poster,
              year: details.year,
            })
          }
          accessibilityLabel="My List"
        >
          <Ionicons name={saved ? "checkmark" : "add"} size={18} color="#fff" />
          <Text style={styles.buttonText}>{saved ? "In My List" : "My List"}</Text>
        </Focusable>
        {download ? (
          <Focusable style={styles.button} onPress={download.onPress} accessibilityLabel={download.label}>
            <Ionicons name={download.icon} size={18} color="#fff" />
            <Text style={styles.buttonText}>{download.label}</Text>
          </Focusable>
        ) : null}
      </View>
      {stage ? <Text style={styles.stage}>{stage}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

/** Starts the first source as soon as one exists ("Play" pressed early). */
function usePlayWhenReady(
  sources: Sources,
  start: (option: SourceOption) => void,
  playingId: string | null,
) {
  const [wanted, setWanted] = useState(false);
  const first = sources.options[0];
  useEffect(() => {
    if (!wanted) return;
    if (first && !playingId) {
      setWanted(false);
      start(first);
    } else if (!first && !sources.loading) {
      setWanted(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted, first, sources.loading, playingId]);
  return { wanted, request: () => setWanted(true) };
}

function MovieBody({
  details,
  navigation,
  playRef,
}: {
  details: TmdbDetails;
  navigation: any;
  playRef: RefObject<View | null>;
}) {
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
  const { play, playingId, stage, error } = usePlayback(navigation);
  const target = useMemo(() => playTarget(details), [details]);
  const start = (option: SourceOption) => play(option, target, undefined, buildQueue(sources));
  const pending = usePlayWhenReady(sources, start, playingId);
  const open = useOpenTvTitle();
  const dl = useTvTitleDownload({
    tmdb: { id: details.id, mediaType: "movie" },
    title: details.title,
    image: tmdbImage(details.poster, "w342") || undefined,
    options: sources.options,
    loading: sources.loading,
    providerNames: useProviderNames(sources),
  });

  return (
    <>
      <Header
        playRef={playRef}
        details={details}
        offline={!!dl.offline}
        download={{ ...dl.button, onPress: dl.onPressDownload }}
        playLabel={
          dl.offline
            ? `Play${OFFLINE_SUFFIX}`
            : sources.options.length || !sources.loading
              ? "Play"
              : "Play when ready"
        }
        busy={!!playingId || pending.wanted}
        stage={stage || (pending.wanted ? "Finding the best source…" : null)}
        error={
          dl.message ||
          error ||
          (!dl.offline && !sources.loading && sources.options.length === 0 && !sources.noProviders
            ? "No source found for this title."
            : null)
        }
        onPlay={() => {
          // A downloaded copy plays from the file, without the internet.
          if (dl.offline && dl.playOffline()) return;
          const first = sources.options[0];
          if (first) start(first);
          else pending.request();
        }}
      />
      <SourceList sources={sources} playingId={playingId} onPlay={start} />
      <PosterRow title="More like this" items={details.similar} onOpen={open} reportFocus={false} />
      {dl.dialogs}
    </>
  );
}

function useProviderNames(sources: Sources): Record<string, string> {
  return useMemo(
    () => Object.fromEntries(sources.providers.map((p) => [p.providerId, p.name])),
    [sources.providers],
  );
}

function SeriesBody({
  details,
  navigation,
  playRef,
}: {
  details: TmdbDetails;
  navigation: any;
  playRef: RefObject<View | null>;
}) {
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
  const [season, setSeason] = useState<number>(() => resume?.season ?? seasons[0].number);
  const [selected, setSelected] = useState<EpisodeSelection | null>(() =>
    resume?.season && resume.episode
      ? { season: resume.season, episode: resume.episode, name: resume.episodeTitle || "" }
      : null,
  );
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
  const { data: seasonData, isLoading: seasonLoading } = useTmdbSeason(details.id, season);
  const episodes = seasonData?.episodes || [];

  // With nothing chosen yet, Play means the first episode of the first season.
  const current: EpisodeSelection =
    selected ?? {
      season: seasons[0].number,
      episode: 1,
      name: season === seasons[0].number ? episodes[0]?.name || "" : "",
    };
  const sources = useEpisodeSources(media, current.season, current.episode);
  const { play, playingId, stage, error } = usePlayback(navigation);
  const target = useMemo(() => playTarget(details, current), [details, current]);
  const start = (option: SourceOption) => play(option, target, undefined, buildQueue(sources));
  const pending = usePlayWhenReady(sources, start, playingId);
  const open = useOpenTvTitle();
  const still = (path: string | null) => tmdbImage(path, "w342") || tmdbImage(details.backdrop, "w342");
  const dl = useTvTitleDownload({
    tmdb: { id: details.id, mediaType: "tv", season: current.season, episode: current.episode },
    title: details.title,
    image: tmdbImage(details.poster, "w342") || undefined,
    episodeName: current.name,
    options: sources.options,
    loading: sources.loading,
    providerNames: useProviderNames(sources),
  });
  const jobs = useDownloadsStore((s) => s.jobs);
  const downloadedHere = useMemo(() => downloadedEpisodes(jobs, details.id, season), [jobs, details.id, season]);

  return (
    <>
      <Header
        playRef={playRef}
        details={details}
        offline={!!dl.offline}
        download={{ ...dl.button, onPress: dl.onPressDownload }}
        playLabel={`${resume && !selected ? "Continue" : "Play"} S${current.season} E${current.episode}${dl.offline ? OFFLINE_SUFFIX : ""}`}
        busy={!!playingId || pending.wanted}
        stage={stage || (pending.wanted ? "Finding the best source…" : null)}
        error={
          dl.message ||
          error ||
          (!dl.offline && !sources.loading && sources.options.length === 0 && !sources.noProviders
            ? "No source found for this episode."
            : null)
        }
        onPlay={() => {
          // A downloaded episode plays from the file, without the internet.
          if (dl.offline && dl.playOffline()) return;
          const first = sources.options[0];
          if (first) start(first);
          else pending.request();
        }}
      />

      <Text style={styles.sectionTitle}>Seasons</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {seasons.map((s) => (
          <Focusable
            key={s.number}
            style={[styles.chip, s.number === season ? styles.chipActive : null]}
            onPress={() => setSeason(s.number)}
            onFocus={() => setSeason(s.number)}
          >
            <Text style={styles.chipText}>{s.name || `Season ${s.number}`}</Text>
          </Focusable>
        ))}
      </ScrollView>

      <Text style={styles.sectionTitle}>Episodes</Text>
      {seasonLoading ? (
        <ActivityIndicator color="#fff" style={{ alignSelf: "flex-start", marginLeft: TV.safeX }} />
      ) : (
        <FlatList
          horizontal
          data={episodes}
          keyExtractor={(ep) => String(ep.number)}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          removeClippedSubviews={false}
          initialNumToRender={30}
          windowSize={41}
          renderItem={({ item: ep }) => {
            const active = current.season === season && current.episode === ep.number;
            const uri = still(ep.still);
            return (
              <Focusable
                grow
                style={[styles.episode, active ? styles.episodeActive : null]}
                onPress={() =>
                  setSelected({ season, episode: ep.number, name: ep.name })
                }
                accessibilityLabel={`Episode ${ep.number} ${ep.name}`}
              >
                {uri ? <Image source={{ uri }} style={styles.episodeImage} contentFit="cover" /> : null}
                <View style={styles.episodeShade} />
                <Text style={styles.episodeText} numberOfLines={2}>
                  {ep.number}. {ep.name}
                </Text>
                {downloadedHere.has(ep.number) ? (
                  <View style={styles.episodeBadge}>
                    <Ionicons name="checkmark-done" size={12} color="#fff" />
                  </View>
                ) : null}
              </Focusable>
            );
          }}
        />
      )}

      <SourceList sources={sources} playingId={playingId} onPlay={start} />
      <PosterRow title="More like this" items={details.similar} onOpen={open} reportFocus={false} />
      {dl.dialogs}
    </>
  );
}

export default function TvDetailScreen({ route, navigation }: any) {
  const { id, mediaType } = route.params || {};
  const { data, isError, isLoading } = useTmdbDetails(mediaType, id);
  const playRef = useRef<View | null>(null);
  // Back from the player: focus returns to where it was (else Play).
  useRestoreTvFocus(playRef);
  const backdrop = data ? tmdbImage(data.backdrop, "w780") : null;

  return (
    <View style={styles.screen}>
      {backdrop ? (
        <Image source={{ uri: backdrop }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : null}
      <LinearGradient
        colors={["rgba(11,11,11,0.97)", "rgba(11,11,11,0.85)", "rgba(11,11,11,0.55)"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      {isLoading ? (
        <ActivityIndicator color="#fff" size="large" style={{ flex: 1 }} />
      ) : isError || !data ? (
        <Text style={styles.error}>Could not load this title.</Text>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {data.mediaType === "tv" ? (
            <SeriesBody details={data} navigation={navigation} playRef={playRef} />
          ) : (
            <MovieBody details={data} navigation={navigation} playRef={playRef} />
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: TV.bg },
  content: { paddingTop: TV.safeY + 8, paddingBottom: 40 },
  header: { paddingHorizontal: TV.safeX, maxWidth: 620 },
  title: { color: "#fff", fontSize: TV.text.hero, fontWeight: "800" },
  meta: { color: TV.muted, fontSize: TV.text.body, marginTop: 6, fontWeight: "600" },
  genres: { color: "rgba(255,255,255,0.75)", fontSize: TV.text.small, marginTop: 4 },
  overview: { color: "rgba(255,255,255,0.88)", fontSize: TV.text.body, marginTop: 10, lineHeight: 19 },
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
  stage: { color: TV.muted, fontSize: TV.text.small, marginTop: 10 },
  error: { color: "#f87171", fontSize: TV.text.body, marginTop: 10, marginLeft: TV.safeX },
  sectionTitle: {
    color: "#fff",
    fontSize: TV.text.row,
    fontWeight: "700",
    marginTop: 20,
    marginBottom: 8,
    marginLeft: TV.safeX,
  },
  status: { color: TV.muted, fontSize: TV.text.small, marginBottom: 8 },
  sources: { paddingHorizontal: TV.safeX, maxWidth: 680 },
  source: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 6,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  sourceMain: { flex: 1 },
  sourceLabel: { color: "#fff", fontSize: TV.text.body, fontWeight: "700" },
  sourceMeta: { color: TV.muted, fontSize: TV.text.small, marginTop: 2 },
  chips: { gap: 10, paddingHorizontal: TV.safeX, paddingVertical: 6 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "rgba(255,255,255,0.1)" },
  chipActive: { backgroundColor: "rgba(255,255,255,0.28)" },
  chipText: { color: "#fff", fontSize: TV.text.body, fontWeight: "600" },
  episode: {
    width: TV.wide.width,
    height: TV.wide.height,
    overflow: "hidden",
    justifyContent: "flex-end",
    backgroundColor: TV.surface,
  },
  episodeActive: { borderColor: "rgba(255,255,255,0.6)" },
  episodeImage: { ...StyleSheet.absoluteFill, borderRadius: TV.radius - 2 },
  episodeShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.4)" },
  episodeBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    padding: 3,
    borderRadius: 10,
    backgroundColor: "rgba(34,197,94,0.9)",
  },
  episodeText: { color: "#fff", fontSize: TV.text.small, fontWeight: "700", padding: 8 },
});
