import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  AppState,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import Video, {
  BufferingStrategyType,
  ResizeMode,
  SelectedTrackType,
  SelectedVideoTrackType,
  TextTrackType,
} from "react-native-video";
import { LinearGradient } from "expo-linear-gradient";
import {
  Ionicons,
  MaterialCommunityIcons,
  MaterialIcons,
} from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createMMKV } from "react-native-mmkv";
import { usePlayerStore } from "@/store/usePlayerStore";
import { usePreferencesStore } from "@/store/usePreferencesStore";
import { useThemeStore } from "@/store/useThemeStore";
import { useContinueWatchingStore } from "@/store/useContinueWatchingStore";
import {
  prepareSubtitles,
  PreparedSubtitle,
  languageCodeFor,
} from "@/services/subtitleService";
import { cueAt, subtitleTextStyle } from "@/lib/subtitles";
import { currentRouteName, goBack, navigate } from "@/navigation/navigationRef";
import {
  groupStreams,
  normalizeStreams,
  orderGroupEntries,
  preferredEntry,
  PlayableStream,
  QualityPreference,
} from "@/lib/streams";

const mmkv = createMMKV();
const ICON = "rgba(255,255,255,0.8)";
const RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const ASPECTS: { key: any; label: string }[] = [
  { key: ResizeMode.CONTAIN, label: "Fit" },
  { key: ResizeMode.COVER, label: "Cover" },
  { key: ResizeMode.STRETCH, label: "Stretch" },
  { key: ResizeMode.NONE, label: "100%" },
];

let VolumeManager: any = null;
try {
  VolumeManager = require("react-native-volume-manager").VolumeManager;
} catch {}
let Brightness: any = null;
try {
  Brightness = require("expo-brightness");
} catch {}
let ScreenOrientation: any = null;
try {
  ScreenOrientation = require("expo-screen-orientation");
} catch {}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const fmtTime = (t: number) => {
  if (!Number.isFinite(t) || t < 0) t = 0;
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
};

const formatQuality = (quality?: string | number, height?: number) => {
  const numericHeight =
    Number(height) || Number(String(quality || "").match(/\d+/)?.[0]) || 0;
  if (numericHeight >= 2000) return "4K";
  if (numericHeight >= 1000) return "1080p";
  if (numericHeight >= 700) return "720p";
  if (numericHeight >= 400) return "480p";
  if (numericHeight > 0) return `${numericHeight}p`;
  if (quality == null || quality === "") return "Auto";
  return String(quality).toUpperCase();
};

const inferHls = (stream: any) =>
  stream?.type === "m3u8" ||
  stream?.type === "hls" ||
  /\.m3u8($|\?)/i.test(stream?.link || "");

const subtitleSources = (stream: any) =>
  stream?.subtitles || stream?.subtitle || stream?.captions || [];

type SeekBarProps = {
  current: number;
  duration: number;
  buffered: number;
  color: string;
  onSeek: (time: number) => void;
};

function SeekBar({ current, duration, buffered, color, onSeek }: SeekBarProps) {
  const [drag, setDrag] = useState<number | null>(null);
  const dragRef = useRef(0);
  const trackRef = useRef<View>(null);
  const layoutRef = useRef({ x: 0, width: 1 });
  const durationRef = useRef(duration);
  const onSeekRef = useRef(onSeek);
  durationRef.current = duration;
  onSeekRef.current = onSeek;

  const updateFromEvent = (pageX: number) => {
    const ratio = clamp(
      (pageX - layoutRef.current.x) / Math.max(1, layoutRef.current.width),
      0,
      1,
    );
    dragRef.current = ratio;
    setDrag(ratio);
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) =>
        updateFromEvent(event.nativeEvent.pageX),
      onPanResponderMove: (event) => updateFromEvent(event.nativeEvent.pageX),
      onPanResponderRelease: () => {
        onSeekRef.current(dragRef.current * durationRef.current);
        setDrag(null);
      },
      onPanResponderTerminate: () => setDrag(null),
    }),
  ).current;

  const shown = drag !== null ? drag * duration : current;
  const progress = duration > 0 ? clamp(shown / duration, 0, 1) : 0;
  const buffer = duration > 0 ? clamp(buffered / duration, 0, 1) : 0;

  return (
    <View
      {...responder.panHandlers}
      ref={trackRef}
      onLayout={(event) => {
        const { x, width } = event.nativeEvent.layout;
        trackRef.current?.measure?.((_x, _y, measuredWidth, _h, pageX) => {
          layoutRef.current = {
            x: pageX ?? x,
            width: measuredWidth || width || 1,
          };
        });
      }}
      style={seekStyles.wrap}
    >
      <View style={seekStyles.track}>
        <View style={[seekStyles.buffered, { width: `${buffer * 100}%` }]} />
        <View
          style={[
            seekStyles.progress,
            { width: `${progress * 100}%`, backgroundColor: color },
          ]}
        />
      </View>
      <View
        style={[
          seekStyles.thumb,
          { left: `${progress * 100}%`, backgroundColor: color },
        ]}
      />
    </View>
  );
}

const seekStyles = StyleSheet.create({
  wrap: { height: 32, justifyContent: "center", width: "100%", flex: 1 },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.22)",
    overflow: "hidden",
  },
  buffered: {
    position: "absolute",
    height: "100%",
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  progress: { position: "absolute", height: "100%" },
  thumb: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
    marginLeft: -7,
    top: 9,
  },
});

type PanelRowProps = {
  icon: string;
  title: string;
  detail?: string;
  selected?: boolean;
  accent: string;
  onPress: () => void;
};

function PanelRow({
  icon,
  title,
  detail,
  selected,
  accent,
  onPress,
}: PanelRowProps) {
  return (
    <TouchableOpacity
      style={[
        panelStyles.row,
        selected && { backgroundColor: "rgba(255,255,255,0.08)" },
      ]}
      onPress={onPress}
    >
      <MaterialCommunityIcons
        name={icon as any}
        size={20}
        color={selected ? accent : "#999"}
      />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text
          numberOfLines={1}
          style={[
            panelStyles.title,
            selected && { color: accent, fontWeight: "800" },
          ]}
        >
          {title}
        </Text>
        {detail ? (
          <Text numberOfLines={2} style={panelStyles.detail}>
            {detail}
          </Text>
        ) : null}
      </View>
      {selected ? (
        <Ionicons name="checkmark-circle" size={20} color={accent} />
      ) : null}
    </TouchableOpacity>
  );
}

const panelStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 4,
  },
  title: { color: "#eee", fontSize: 14, fontWeight: "600" },
  detail: { color: "#777", fontSize: 11, marginTop: 2 },
});

type SubtitleSelection =
  | { kind: "off" }
  | { kind: "external"; title: string; label: string }
  | { kind: "embedded"; index: number; label: string; language?: string };

type PlaybackError = { message: string } | null;

const PANEL_TITLES: Record<string, string> = {
  subtitle: "Subtitles",
  audio: "Audio",
  server: "Servers",
  quality: "Quality",
  speed: "Playback Speed",
  aspect: "Screen Size",
};

const withTimeout = <T,>(promise: Promise<T>, ms: number, fallback: T) =>
  Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);

export default function PlayerOverlay() {
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { primaryColor } = useThemeStore();

  const currentVideoUrl = usePlayerStore((s) => s.currentVideoUrl);
  const streams = usePlayerStore((s) => s.streams);
  const initialStreamIndex = usePlayerStore((s) => s.initialStreamIndex);
  const playerMeta = usePlayerStore((s) => s.playerMeta);
  const expanded = usePlayerStore((s) => s.expanded);
  const minimize = usePlayerStore((s) => s.minimize);
  const closePlayer = usePlayerStore((s) => s.close);

  const prefs = usePreferencesStore();
  const upsertContinueWatching = useContinueWatchingStore((s) => s.upsert);
  const removeContinueWatching = useContinueWatchingStore((s) => s.remove);

  const normalizedStreams = useMemo(() => {
    const normalized = normalizeStreams(streams);
    if (normalized.length > 0) return normalized;
    return currentVideoUrl
      ? normalizeStreams([{ link: currentVideoUrl, server: "Source" }])
      : [];
  }, [streams, currentVideoUrl]);

  const [streamIndex, setStreamIndex] = useState(() =>
    clamp(initialStreamIndex, 0, Math.max(0, normalizedStreams.length - 1)),
  );
  const currentStream: PlayableStream | undefined =
    normalizedStreams[streamIndex] || normalizedStreams[0];
  const streamGroups = useMemo(
    () => groupStreams(normalizedStreams),
    [normalizedStreams],
  );
  const currentGroup = useMemo(
    () =>
      streamGroups.find((group) =>
        group.entries.some((entry) => entry.stream.index === streamIndex),
      ) ||
      streamGroups[0] ||
      null,
    [streamGroups, streamIndex],
  );

  const [preparedSubs, setPreparedSubs] = useState<PreparedSubtitle[] | null>(
    null,
  );
  const [loadNonce, setLoadNonce] = useState(0);
  const [switching, setSwitching] = useState(false);
  const [buffering, setBuffering] = useState(true);
  const [paused, setPaused] = useState(false);
  const [ended, setEnded] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [rate, setRate] = useState(1);
  const [aspectIdx, setAspectIdx] = useState(0);
  const [locked, setLocked] = useState(false);
  const [panel, setPanel] = useState<null | string>(null);
  const [showControls, setShowControls] = useState(true);
  const [toast, setToast] = useState("");
  const [gesture, setGesture] = useState<{
    side: "left" | "right";
    value: number;
  } | null>(null);
  const [showRemaining, setShowRemaining] = useState(
    prefs.showRemainingTime,
  );
  const [error, setError] = useState<PlaybackError>(null);
  const [failedStreams, setFailedStreams] = useState<Record<number, boolean>>(
    {},
  );
  const [orientationLocked, setOrientationLocked] = useState(false);
  const [seekHint, setSeekHint] = useState<null | {
    side: "left" | "right";
    amount: number;
    total: number;
    target: number;
  }>(null);

  const [embeddedTextTracks, setEmbeddedTextTracks] = useState<any[]>([]);
  const [audioTracks, setAudioTracks] = useState<any[]>([]);
  const [videoTracks, setVideoTracks] = useState<any[]>([]);
  const [subtitle, setSubtitle] = useState<SubtitleSelection>({ kind: "off" });
  const [selectedAudioIndex, setSelectedAudioIndex] = useState<number | null>(
    null,
  );
  const [selectedVideo, setSelectedVideo] = useState<any>({
    type: SelectedVideoTrackType.AUTO,
  });

  const playerRef = useRef<any>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stallTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTap = useRef(0);
  const tapStreak = useRef(0);
  const tapSide = useRef<"left" | "right" | null>(null);
  const seekTotal = useRef(0);
  const seekHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seekAnim = useRef(new Animated.Value(0)).current;
  const lastPanEnd = useRef(0);
  const currentTimeRef = useRef(0);
  const durationRef = useRef(0);
  const pendingSeekRef = useRef<number | null>(null);
  const hasLoadedOnceRef = useRef(false);
  const subtitleTouched = useRef(false);
  const qualityTouched = useRef(false);
  const panState = useRef<{ side: "left" | "right"; base: number } | null>(
    null,
  );
  const brightnessRef = useRef(0.5);
  const volumeRef = useRef(0.5);
  const originalBrightness = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const expandedRef = useRef(expanded);
  const lockedRef = useRef(locked);
  const pausedRef = useRef(paused);
  const prefsRef = useRef(prefs);
  const lastProgressSave = useRef(0);
  const lastUiTick = useRef(0);
  const dimensionsRef = useRef({ width: screenWidth, height: screenHeight });
  const showControlsRef = useRef(showControls);
  const subtitleRef = useRef<SubtitleSelection>({ kind: "off" });
  const pendingEmbeddedSubtitle = useRef<
    Extract<SubtitleSelection, { kind: "embedded" }> | null
  >(null);

  expandedRef.current = expanded;
  lockedRef.current = locked;
  pausedRef.current = paused;
  prefsRef.current = prefs;
  dimensionsRef.current = { width: screenWidth, height: screenHeight };
  showControlsRef.current = showControls;
  subtitleRef.current = subtitle;

  const progressKey =
    playerMeta?.link || currentVideoUrl
      ? `playerProgress:${playerMeta?.link || currentVideoUrl}`
      : "";
  const progressKeyRef = useRef(progressKey);
  progressKeyRef.current = progressKey;

  const subtitleTitles = useMemo(
    () => new Set((preparedSubs || []).map((track) => track.title)),
    [preparedSubs],
  );

  const filteredEmbeddedTracks = useMemo(
    () =>
      embeddedTextTracks.filter(
        (track) => !track.title || !subtitleTitles.has(track.title),
      ),
    [embeddedTextTracks, subtitleTitles],
  );

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      if (mountedRef.current) setToast("");
    }, 2800);
  }, []);

  const wake = useCallback((stay = false) => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (stay) return;
    const seconds = prefsRef.current.controlsTimeout || 5;
    hideTimer.current = setTimeout(() => {
      if (!mountedRef.current) return;
      setShowControls(false);
      setPanel(null);
    }, seconds * 1000);
  }, []);

  const saveProgress = useCallback(
    (forcePosition?: number) => {
      const key = progressKeyRef.current;
      if (!key) return;
      const position = forcePosition ?? currentTimeRef.current;
      const total = durationRef.current;
      if (!Number.isFinite(position) || position < 0) return;
      try {
        mmkv.set(key, JSON.stringify({ position, duration: total }));
      } catch {}
      const meta = usePlayerStore.getState().playerMeta;
      if (!meta?.link || !meta.title) return;
      if (meta.providerId === "__local") return;
      if (total > 0 && position / total >= 0.9) {
        removeContinueWatching(meta.link);
        return;
      }
      if (position < 10) return;
      upsertContinueWatching({
        link: meta.link,
        title: meta.title,
        image: meta.image || meta.poster,
        providerId: meta.providerId || "",
        type: meta.type,
        position,
        duration: total,
      });
    },
    [removeContinueWatching, upsertContinueWatching],
  );

  // Prepare the initial stream's external subtitles before mounting the
  // native player so the tracks exist on the very first load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await withTimeout(
        prepareSubtitles(
          subtitleSources(currentStream),
          currentStream?.link || currentVideoUrl,
          currentStream?.headers,
        ).catch(() => ({ tracks: [], failed: 0 })),
        6000,
        { tracks: [], failed: 0 },
      );
      if (cancelled || !mountedRef.current) return;
      setPreparedSubs(result.tracks);
      if (result.failed > 0) {
        showToast("Some subtitles could not be loaded");
      }
    })();
    return () => {
      cancelled = true;
    };
    // The overlay is remounted for each playback session; stream changes are
    // handled explicitly by switchStream.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    Brightness?.getBrightnessAsync?.()
      .then((value: number) => {
        if (typeof value === "number") {
          brightnessRef.current = value;
          originalBrightness.current = value;
        }
      })
      .catch(() => {});
    VolumeManager?.getVolume?.()
      .then((value: any) => {
        const volume =
          typeof value === "number" ? value : (value?.volume ?? 0.5);
        if (typeof volume === "number") volumeRef.current = volume;
      })
      .catch(() => {});

    return () => {
      mountedRef.current = false;
      if (originalBrightness.current != null) {
        Brightness?.setBrightnessAsync?.(
          originalBrightness.current,
        ).catch(() => {});
      }
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (stallTimer.current) clearTimeout(stallTimer.current);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (tapTimer.current) clearTimeout(tapTimer.current);
      if (seekHideTimer.current) clearTimeout(seekHideTimer.current);
    };
  }, []);

  useEffect(() => {
    wake();
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [wake]);

  useEffect(() => {
    if (panel) wake(true);
  }, [panel, wake]);

  useEffect(() => {
    if (stallTimer.current) clearTimeout(stallTimer.current);
    if (!buffering || paused || ended || error || switching) return;
    const startedAt = currentTime;
    stallTimer.current = setTimeout(() => {
      if (!mountedRef.current || pausedRef.current) return;
      if (Math.abs(currentTimeRef.current - startedAt) > 1) return;
      setBuffering(false);
      setError({
        message:
          "This stream did not start. The server may be unavailable — pick another server or retry.",
      });
      setFailedStreams((previous) => ({ ...previous, [streamIndex]: true }));
      wake(true);
      showToast("This server is not responding — pick another server");
    }, 20000);
    return () => {
      if (stallTimer.current) clearTimeout(stallTimer.current);
    };
  }, [
    buffering,
    paused,
    ended,
    error,
    switching,
    currentTime,
    streamIndex,
    wake,
    showToast,
  ]);

  useEffect(() => {
    setShowRemaining(prefs.showRemainingTime);
  }, [prefs.showRemainingTime]);

  useEffect(() => {
    if (!expanded) {
      setPanel(null);
      setShowControls(false);
      setGesture(null);
      if (ScreenOrientation?.lockAsync && ScreenOrientation?.OrientationLock) {
        ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.PORTRAIT_UP,
        ).catch(() => {});
      }
      return;
    }
    setShowControls(true);
    wake();
    if (ScreenOrientation?.unlockAsync) {
      ScreenOrientation.unlockAsync().catch(() => {});
    }
    setOrientationLocked(false);
  }, [expanded, wake]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        saveProgress();
        if (!pausedRef.current) {
          setPaused(true);
        }
      }
    });
    return () => subscription.remove();
  }, [saveProgress]);

  useEffect(
    () => () => {
      saveProgress();
    },
    [saveProgress],
  );

  const onLoad = (data: any) => {
    const total = Number(data?.duration) || 0;
    const incomingAudio = Array.isArray(data?.audioTracks)
      ? data.audioTracks
      : [];
    const incomingVideo = Array.isArray(data?.videoTracks)
      ? data.videoTracks
      : [];
    const incomingText = Array.isArray(data?.textTracks)
      ? data.textTracks
      : [];

    durationRef.current = total;
    setDuration(total);
    setBuffering(false);
    setEnded(false);
    if (incomingAudio.length) setAudioTracks(incomingAudio);
    if (incomingVideo.length) setVideoTracks(incomingVideo);
    if (incomingText.length) setEmbeddedTextTracks(incomingText);
    setSelectedAudioIndex(null);

    const pendingEmbedded = pendingEmbeddedSubtitle.current;
    if (pendingEmbedded) {
      pendingEmbeddedSubtitle.current = null;
      const language = pendingEmbedded.language?.toLowerCase();
      const match =
        incomingText.find(
          (track: any) =>
            (language &&
              String(track.language || "")
                .toLowerCase()
                .startsWith(language)) ||
            (!!pendingEmbedded.label &&
              String(track.language || track.title || "").toLowerCase() ===
                pendingEmbedded.label.toLowerCase()),
        ) ||
        incomingText.find(
          (track: any) => Number(track.index) === pendingEmbedded.index,
        );
      if (match) {
        setSubtitle({
          kind: "embedded",
          index: Number(match.index),
          label:
            match.language || match.title || pendingEmbedded.label || "Embedded",
          language: match.language,
        });
      } else {
        setSubtitle({ kind: "off" });
      }
    }

    if (!subtitleTouched.current) {
      const external = preparedSubs || [];
      const embeddedDefaults = incomingText.filter(
        (track: any) => !track.title || !subtitleTitles.has(track.title),
      );
      const preferred = prefsRef.current.subtitleLanguage;
      if (prefsRef.current.autoSubtitles) {
        const externalMatch =
          preferred === "auto"
            ? external[0]
            : external.find((track) => track.languageCode === preferred) ||
              external[0];
        if (externalMatch) {
          setSubtitle({
            kind: "external",
            title: externalMatch.title,
            label: externalMatch.label,
          });
        } else if (embeddedDefaults.length > 0) {
          const track =
            (preferred !== "auto" &&
              embeddedDefaults.find(
                (item: any) =>
                  languageCodeFor(item.language) === preferred,
              )) ||
            embeddedDefaults[0];
          setSubtitle({
            kind: "embedded",
            index: track.index,
            label: track.language || track.title || "Embedded",
            language: track.language,
          });
        }
      }
    }

    if (!qualityTouched.current && prefsRef.current.defaultQuality !== "auto") {
      const heights = incomingVideo
        .filter((track: any) => Number(track?.height) > 0)
        .sort((a: any, b: any) => a.height - b.height);
      if (heights.length > 1) {
        const target =
          prefsRef.current.defaultQuality === "highest"
            ? heights[heights.length - 1]
            : heights[0];
        setSelectedVideo({
          type: SelectedVideoTrackType.RESOLUTION,
          value: target.height,
        });
      }
    }

    let target = pendingSeekRef.current;
    pendingSeekRef.current = null;
    if (target == null && !hasLoadedOnceRef.current && prefsRef.current.resumePlayback) {
      try {
        const cached = JSON.parse(
          mmkv.getString(`playerProgress:${playerMeta?.link || currentVideoUrl}`) ||
            "null",
        );
        target = Number(cached?.position) || null;
      } catch {}
    }
    hasLoadedOnceRef.current = true;

    if (target != null && target > 2) {
      if (total <= 0 || target / total < 0.95) {
        playerRef.current?.seek(target);
        currentTimeRef.current = target;
        setCurrentTime(target);
      }
    }
  };

  const onProgress = (data: any) => {
    const time = Number(data?.currentTime) || 0;
    const total =
      Number(data?.seekableDuration) || durationRef.current || 0;
    currentTimeRef.current = time;
    durationRef.current = total;

    const now = Date.now();
    if (now - lastUiTick.current > 400) {
      lastUiTick.current = now;
      setCurrentTime(time);
      setBuffered(Number(data?.playableDuration) || 0);
    }
    if (now - lastProgressSave.current < 5000) return;
    lastProgressSave.current = now;
    saveProgress(time);
  };

  const handleError = (event: any) => {
    setBuffering(false);
    const message =
      event?.error?.errorString ||
      event?.error?.localizedDescription ||
      event?.error?.errorException ||
      "Playback failed";
    setError({ message: String(message).slice(0, 220) });
    setFailedStreams((previous) => ({ ...previous, [streamIndex]: true }));
    wake(true);
    if (normalizedStreams.length > 1) {
      showToast("This server failed — pick another server to continue");
    }
  };

  const prepareForStream = async (index: number) => {
    const targetStream = normalizedStreams[index];
    return withTimeout(
      prepareSubtitles(
        subtitleSources(targetStream),
        targetStream?.link || currentVideoUrl,
        targetStream?.headers,
      ).catch(() => ({ tracks: [], failed: 0 })),
      6000,
      { tracks: [], failed: 0 },
    );
  };

  const switchStream = async (index: number) => {
    if (switching || index === streamIndex) {
      setPanel(null);
      return;
    }
    const target = normalizedStreams[index];
    if (!target?.link) return;
    setPanel(null);
    setSwitching(true);
    setError(null);
    const position = currentTimeRef.current;
    const previousSubtitle = subtitleRef.current;
    try {
      const result = await prepareForStream(index);
      if (!mountedRef.current) return;
      pendingSeekRef.current = position > 2 ? position : null;
      qualityTouched.current = false;

      let nextSubtitle: SubtitleSelection = { kind: "off" };
      pendingEmbeddedSubtitle.current = null;
      if (previousSubtitle.kind === "external") {
        const match = result.tracks.find(
          (track) =>
            track.label === previousSubtitle.label ||
            track.title === previousSubtitle.title,
        );
        if (match) {
          nextSubtitle = {
            kind: "external",
            title: match.title,
            label: match.label,
          };
        }
      } else if (previousSubtitle.kind === "embedded") {
        // The new container may expose different track indices; reconcile once
        // the player reports its embedded tracks.
        pendingEmbeddedSubtitle.current = previousSubtitle;
        nextSubtitle = previousSubtitle;
      }
      subtitleTouched.current = previousSubtitle.kind !== "off";

      setSelectedVideo({ type: SelectedVideoTrackType.AUTO });
      setPreparedSubs(result.tracks);
      setSubtitle(nextSubtitle);
      setEmbeddedTextTracks([]);
      setAudioTracks([]);
      setVideoTracks([]);
      setSelectedAudioIndex(null);
      setStreamIndex(index);
      setLoadNonce((value) => value + 1);
      setBuffering(true);
      setEnded(false);
      if (result.failed > 0) showToast("Some subtitles could not be loaded");
    } finally {
      if (mountedRef.current) setSwitching(false);
    }
  };

  const retryStream = () => {
    setError(null);
    pendingSeekRef.current = currentTimeRef.current;
    setBuffering(true);
    setFailedStreams((previous) => {
      const next = { ...previous };
      delete next[streamIndex];
      return next;
    });
    setLoadNonce((value) => value + 1);
    wake();
  };

  const togglePlay = () => {
    if (ended) {
      playerRef.current?.seek(0);
      currentTimeRef.current = 0;
      setCurrentTime(0);
      setEnded(false);
      setPaused(false);
    } else {
      setPaused((value) => !value);
    }
    wake();
  };

  const seekTo = (time: number) => {
    const target = clamp(time, 0, durationRef.current || 0);
    playerRef.current?.seek(target);
    currentTimeRef.current = target;
    setCurrentTime(target);
    setEnded(false);
    wake();
  };

  const expandFromMini = () => {
    usePlayerStore.getState().expand();
    if (currentRouteName() !== "Player") {
      navigate("Player");
    }
  };

  const minimizeAndBack = () => {
    saveProgress();
    minimize();
    goBack();
  };

  const stopPlayback = () => {
    saveProgress();
    if (currentRouteName() === "Player") {
      goBack();
    }
    minimize();
    closePlayer();
  };

  const handleLock = () => {
    const next = !locked;
    setLocked(next);
    setShowControls(!next);
    if (!next) wake();
  };

  const toggleOrientation = async () => {
    if (!ScreenOrientation?.lockAsync) return;
    const next = !orientationLocked;
    try {
      if (next) {
        await ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.LANDSCAPE,
        );
      } else {
        await ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.PORTRAIT_UP,
        );
      }
      setOrientationLocked(next);
      wake();
    } catch {
      showToast("Orientation lock is not available on this device");
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_event, gestureState) => {
        if (lockedRef.current || !expandedRef.current) return false;
        const vertical = Math.abs(gestureState.dy);
        const horizontal = Math.abs(gestureState.dx);
        return vertical > 16 && vertical > horizontal * 1.25;
      },
      onPanResponderGrant: (event) => {
        const { width } = dimensionsRef.current;
        const side: "left" | "right" =
          event.nativeEvent.locationX < width / 2 ? "left" : "right";
        const base =
          side === "left" ? brightnessRef.current : volumeRef.current;
        panState.current = { side, base };
        setGesture({ side, value: base });
      },
      onPanResponderMove: (_event, gestureState) => {
        const state = panState.current;
        if (!state) return;
        const height = Math.max(1, dimensionsRef.current.height);
        const value = clamp(state.base - gestureState.dy / (height * 0.6), 0, 1);
        setGesture({ side: state.side, value });
        if (state.side === "left") {
          brightnessRef.current = value;
          Brightness?.setBrightnessAsync?.(value).catch(() => {});
        } else {
          volumeRef.current = value;
          VolumeManager?.setVolume?.(value);
        }
      },
      onPanResponderRelease: () => {
        panState.current = null;
        lastPanEnd.current = Date.now();
        setGesture(null);
        wake();
      },
      onPanResponderTerminate: () => {
        panState.current = null;
        lastPanEnd.current = Date.now();
        setGesture(null);
      },
    }),
  ).current;

  const applySeekDelta = (side: "left" | "right", amount: number) => {
    const total = seekTotal.current + amount;
    seekTotal.current = total;
    const base = currentTimeRef.current;
    const max =
      durationRef.current > 0 ? durationRef.current : Math.max(0, base + total);
    const target = clamp(base + (side === "right" ? amount : -amount), 0, max);
    playerRef.current?.seek(target);
    currentTimeRef.current = target;
    setCurrentTime(target);
    setEnded(false);
    if (showControlsRef.current) wake();

    setSeekHint({ side, amount, total, target });
    seekAnim.stopAnimation();
    seekAnim.setValue(0);
    Animated.sequence([
      Animated.timing(seekAnim, {
        toValue: 1,
        duration: 140,
        useNativeDriver: true,
      }),
      Animated.timing(seekAnim, {
        toValue: 0.94,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.timing(seekAnim, {
        toValue: 1,
        duration: 90,
        useNativeDriver: true,
      }),
    ]).start();

    if (seekHideTimer.current) clearTimeout(seekHideTimer.current);
    seekHideTimer.current = setTimeout(() => {
      if (!mountedRef.current) return;
      setSeekHint(null);
      seekTotal.current = 0;
    }, 900);
  };

  // Single tap toggles controls; repeated taps on one side seek by an
  // increasing amount (10s, then +20s, then +30s…) without touching the
  // timeline or the control buttons.
  const handleTap = (event?: any) => {
    if (lockedRef.current || panel || !expandedRef.current) return;
    if (Date.now() - lastPanEnd.current < 280) return;
    const now = Date.now();
    const width = dimensionsRef.current.width;
    const rawX = Number(event?.nativeEvent?.locationX);
    const side: "left" | "right" =
      Number.isFinite(rawX) && width > 0
        ? rawX < width / 2
          ? "left"
          : "right"
        : tapSide.current || "right";
    const continuing = now - lastTap.current < 420 && tapSide.current === side;
    tapStreak.current = continuing ? tapStreak.current + 1 : 1;
    tapSide.current = side;
    lastTap.current = now;

    if (tapStreak.current === 1) {
      if (tapTimer.current) clearTimeout(tapTimer.current);
      tapTimer.current = setTimeout(() => {
        if (!mountedRef.current) return;
        if (tapStreak.current !== 1) return;
        tapStreak.current = 0;
        setShowControls((visible) => {
          if (visible) {
            setPanel(null);
            return false;
          }
          wake();
          return true;
        });
      }, 280);
      return;
    }

    if (tapTimer.current) {
      clearTimeout(tapTimer.current);
      tapTimer.current = null;
    }
    applySeekDelta(side, 10 * (tapStreak.current - 1));
  };

  const selectSubtitle = (selection: SubtitleSelection) => {
    subtitleTouched.current = true;
    setSubtitle(selection);
    setPanel(null);
  };

  const selectAudio = (track: any) => {
    if (track?.index != null) {
      setSelectedAudioIndex(Number(track.index));
    }
    setPanel(null);
  };

  const qualityRows = () => {
    const rows: PanelRowProps[] = [];
    const adaptive = !!currentStream?.adaptive;
    const resolutionTracks = videoTracks
      .filter((track: any) => Number(track?.height) > 0)
      .sort((a: any, b: any) => a.height - b.height);

    if (adaptive) {
      rows.push({
        icon: "video-switch",
        title: "Auto",
        detail: resolutionTracks.length
          ? "Adaptive bitrate"
          : "Adaptive bitrate handled by the player",
        selected: selectedVideo?.type === SelectedVideoTrackType.AUTO,
        accent: primaryColor,
        onPress: () => {
          qualityTouched.current = true;
          setSelectedVideo({ type: SelectedVideoTrackType.AUTO });
          setPanel(null);
        },
      });
      resolutionTracks.forEach((track: any) => {
        const selected =
          selectedVideo?.type === SelectedVideoTrackType.RESOLUTION &&
          String(selectedVideo?.value) === String(track.height);
        rows.push({
          icon: "video-high-definition",
          title: `${track.height}p`,
          detail: [
            track.width && track.height
              ? `${track.width}×${track.height}`
              : null,
            track.bitrate
              ? `${Math.round(Number(track.bitrate) / 1000)} kbps`
              : null,
            "Adaptive track",
          ]
            .filter(Boolean)
            .join(" · "),
          selected,
          accent: primaryColor,
          onPress: () => {
            qualityTouched.current = true;
            setSelectedVideo({
              type: SelectedVideoTrackType.RESOLUTION,
              value: track.height,
            });
            setPanel(null);
          },
        });
      });
    }

    const entries = currentGroup?.entries || [];
    if (entries.length > 1) {
      entries.forEach((entry) => {
        const failed =
          failedStreams[entry.stream.index] ||
          entry.stream.probe?.status === "failed";
        const selected =
          entry.stream.index === streamIndex &&
          selectedVideo?.type === SelectedVideoTrackType.AUTO;
        rows.push({
          icon: failed ? "alert-circle-outline" : "video-high-definition",
          title: entry.label,
          detail: [
            "Separate URL",
            entry.stream.formatLabel,
            failed
              ? "Unavailable"
              : entry.stream.probe?.status === "ok"
                ? "Verified"
                : null,
          ]
            .filter(Boolean)
            .join(" · "),
          selected,
          accent: primaryColor,
          onPress: () => {
            void switchStream(entry.stream.index);
          },
        });
      });
    } else if (!adaptive && entries.length === 1) {
      const entry = entries[0];
      rows.push({
        icon: "video-high-definition",
        title: entry.label,
        detail: `${entry.stream.formatLabel} · Single fixed stream from this server`,
        selected: true,
        accent: primaryColor,
        onPress: () => {
          setPanel(null);
          showToast("This server provides one fixed quality");
        },
      });
    }

    if (rows.length === 0) {
      rows.push({
        icon: "information-outline",
        title: currentStream?.qualityLabel || "Source quality",
        detail: "This stream does not expose quality metadata",
        selected: true,
        accent: primaryColor,
        onPress: () => setPanel(null),
      });
    }
    return rows;
  };

  const panelRows = (): PanelRowProps[] => {
    const accent = primaryColor;
    if (panel === "subtitle") {
      return [
        {
          icon: "closed-caption-outline",
          title: "Off",
          selected: subtitle.kind === "off",
          accent,
          onPress: () => selectSubtitle({ kind: "off" }),
        },
        ...(preparedSubs || []).map((track) => ({
          icon: "subtitles-outline",
          title: track.label,
          detail: "External subtitle",
          selected:
            subtitle.kind === "external" && subtitle.title === track.title,
          accent,
          onPress: () =>
            selectSubtitle({
              kind: "external",
              title: track.title,
              label: track.label,
            }),
        })),
        ...filteredEmbeddedTracks.map((track: any) => ({
          icon: "subtitles-outline",
          title: track.title || track.language || `Track ${track.index + 1}`,
          detail: [track.language, "Embedded"]
            .filter(Boolean)
            .join(" · "),
          selected:
            subtitle.kind === "embedded" && subtitle.index === track.index,
          accent,
          onPress: () =>
            selectSubtitle({
              kind: "embedded",
              index: track.index,
              label: track.title || track.language || "Embedded",
              language: track.language,
            }),
        })),
      ];
    }
    if (panel === "audio") {
      const seen = new Set<string>();
      return audioTracks
        .filter((track: any, index: number) => {
          const key = String(track.index ?? index);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map((track: any, index: number) => ({
          icon: "waveform",
          title: track.language || track.title || `Audio ${index + 1}`,
          detail: [track.title, track.type].filter(Boolean).join(" · "),
          selected:
            selectedAudioIndex != null
              ? Number(track.index) === selectedAudioIndex
              : !!track.selected,
          accent,
          onPress: () => selectAudio(track),
        }));
    }
    if (panel === "server") {
      const preference = (prefs.defaultQuality || "auto") as QualityPreference;
      return streamGroups.map((group) => {
        const inGroup = group.entries.some(
          (entry) => entry.stream.index === streamIndex,
        );
        const ordered = orderGroupEntries(group.entries, preference);
        const pick =
          ordered.find(
            (entry) =>
              !failedStreams[entry.stream.index] &&
              entry.stream.probe?.status !== "failed",
          ) || ordered[0];
        const allFailed = group.entries.every(
          (entry) =>
            failedStreams[entry.stream.index] ||
            entry.stream.probe?.status === "failed",
        );
        return {
          icon: allFailed ? "alert-circle-outline" : "dns",
          title: group.label,
          detail: [
            group.entries.length > 1
              ? `${group.entries.length} qualities`
              : group.entries[0]?.label,
            group.formats.join(" / "),
            allFailed ? "Unavailable" : null,
          ]
            .filter(Boolean)
            .join(" · "),
          selected: inGroup,
          accent,
          onPress: () => {
            if (inGroup) {
              setPanel(null);
              return;
            }
            void switchStream(pick.stream.index);
          },
        };
      });
    }
    if (panel === "quality") return qualityRows();
    if (panel === "speed") {
      return RATES.map((value) => ({
        icon: "speedometer",
        title: `${value}x`,
        selected: rate === value,
        accent,
        onPress: () => {
          setRate(value);
          setPanel(null);
        },
      }));
    }
    if (panel === "aspect") {
      return ASPECTS.map((aspect, index) => ({
        icon: "fit-to-screen-outline",
        title: aspect.label,
        selected: aspectIdx === index,
        accent,
        onPress: () => {
          setAspectIdx(index);
          setPanel(null);
        },
      }));
    }
    return [];
  };

  const activeExternalTrack = useMemo(() => {
    if (subtitle.kind !== "external") return null;
    return (
      (preparedSubs || []).find((track) => track.title === subtitle.title) ||
      null
    );
  }, [subtitle, preparedSubs]);

  const usesCustomSubtitleOverlay =
    !!activeExternalTrack && activeExternalTrack.cues.length > 0;

  const activeCue = useMemo(
    () =>
      activeExternalTrack
        ? cueAt(activeExternalTrack.cues, currentTime)
        : null,
    [activeExternalTrack, currentTime],
  );

  const selectedTextTrack = useMemo(() => {
    if (subtitle.kind === "external") {
      // External cues are rendered by our styled overlay; keep the native
      // renderer off so the same text is not drawn twice.
      if (usesCustomSubtitleOverlay) return { type: SelectedTrackType.DISABLED };
      return { type: SelectedTrackType.TITLE, value: subtitle.title };
    }
    if (subtitle.kind === "embedded") {
      return {
        type: SelectedTrackType.INDEX,
        value: subtitle.index,
      };
    }
    return { type: SelectedTrackType.DISABLED };
  }, [subtitle, usesCustomSubtitleOverlay]);

  const selectedAudioTrack = useMemo(() => {
    if (selectedAudioIndex == null) {
      return { type: SelectedTrackType.SYSTEM };
    }
    return {
      type: SelectedTrackType.INDEX,
      value: selectedAudioIndex,
    };
  }, [selectedAudioIndex]);

  const videoSource = useMemo(() => {
    const uri = currentStream?.link || currentVideoUrl;
    const hls =
      currentStream?.format === "hls" || inferHls(currentStream);
    const mpd =
      currentStream?.format === "dash" ||
      currentStream?.raw?.type === "mpd" ||
      /\.mpd($|\?)/i.test(uri || "");
    const headers = currentStream?.headers || {};
    const externalTracks = (preparedSubs || []).map((track) => ({
      title: track.title,
      language: track.languageCode as any,
      type: TextTrackType.VTT,
      uri: track.uri,
    }));
    return {
      uri,
      ...(hls ? { type: "m3u8" } : {}),
      ...(mpd ? { type: "mpd" } : {}),
      ...(Object.keys(headers).length > 0 ? { headers } : {}),
      ...(externalTracks.length > 0 ? { textTracks: externalTracks } : {}),
      bufferConfig: {
        minBufferMs: 8000,
        maxBufferMs: 20000,
        bufferForPlaybackMs: 1500,
        bufferForPlaybackAfterRebufferMs: 3000,
      },
    };
  }, [currentStream, currentVideoUrl, preparedSubs]);

  if (!currentVideoUrl) return null;

  const remaining = Math.max(0, duration - currentTime);
  const qualityLabel =
    selectedVideo?.type === SelectedVideoTrackType.RESOLUTION &&
    Number(selectedVideo.value) > 0
      ? `${selectedVideo.value}p`
      : currentStream?.adaptive
        ? videoTracks.length > 0
          ? "Auto"
          : currentStream.qualityLabel
        : currentStream?.qualityLabel ||
          formatQuality(currentStream?.raw?.quality);
  const subtitleLabel =
    subtitle.kind === "off"
      ? "Subtitles"
      : subtitle.kind === "external"
        ? subtitle.label
        : subtitle.label;
  const serverLabel = currentStream?.server || "Server";
  const selectedAudioLabel =
    (selectedAudioIndex != null
      ? audioTracks.find(
          (track: any) => Number(track.index) === selectedAudioIndex,
        )
      : audioTracks.find((track: any) => track.selected))?.language ||
    audioTracks.find((track: any) => track.selected)?.title ||
    "Audio";

  const miniWidth = Math.min(240, Math.max(190, screenWidth * 0.52));
  const miniBottom = Math.max(insets.bottom + 82, 88);

  const rootStyle = expanded
    ? styles.fullscreen
    : [
        styles.mini,
        {
          width: miniWidth,
          height: (miniWidth * 9) / 16,
          right: 12,
          bottom: miniBottom,
        },
      ];

  return (
    <View style={rootStyle as any} pointerEvents="auto">
      <StatusBar hidden={expanded} />
      <View style={StyleSheet.absoluteFill}>
        {preparedSubs === null ? (
          <View style={styles.loadingScreen}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadingText}>Preparing stream…</Text>
          </View>
        ) : (
          <Video
            key={`${streamIndex}-${loadNonce}`}
            ref={playerRef}
            style={StyleSheet.absoluteFill}
            source={videoSource}
            resizeMode={
              expanded ? ASPECTS[aspectIdx].key : ResizeMode.COVER
            }
            paused={paused}
            rate={rate}
            onLoad={onLoad}
            onProgress={onProgress}
            onBuffer={(event) => setBuffering(event.isBuffering)}
            onAudioTracks={(event: any) =>
              setAudioTracks(event.audioTracks || [])
            }
            onTextTracks={(event: any) =>
              setEmbeddedTextTracks(event.textTracks || [])
            }
            onVideoTracks={(event: any) =>
              setVideoTracks(event.videoTracks || [])
            }
            selectedAudioTrack={selectedAudioTrack}
            selectedTextTrack={selectedTextTrack}
            selectedVideoTrack={selectedVideo}
            subtitleStyle={{
              // Native rendering only covers size and position; external
              // tracks use the fully styled overlay below instead.
              fontSize: prefs.subtitleSize,
              paddingBottom: Math.round(prefs.subtitleBottom),
              paddingLeft: 24,
              paddingRight: 24,
              opacity: 1,
            }}
            bufferingStrategy={BufferingStrategyType.DEPENDING_ON_MEMORY}
            playWhenInactive
            progressUpdateInterval={400}
            onError={handleError}
            onEnd={() => {
              setEnded(true);
              setPaused(true);
              setBuffering(false);
              saveProgress(durationRef.current);
              wake(true);
            }}
          />
        )}
      </View>

      {expanded ? (
        <>
          <View
            style={styles.gestureLayer}
            pointerEvents={locked ? "none" : "auto"}
            {...(locked ? {} : panResponder.panHandlers)}
            onTouchEnd={handleTap}
          />

          {activeCue ? (
            <View
              pointerEvents="none"
              style={[
                styles.subtitleLayer,
                {
                  bottom: Math.max(insets.bottom + prefs.subtitleBottom, 20),
                  alignItems:
                    prefs.subtitleAlign === "left"
                      ? "flex-start"
                      : prefs.subtitleAlign === "right"
                        ? "flex-end"
                        : "center",
                  paddingLeft: Math.max(insets.left, 16) + 6,
                  paddingRight: Math.max(insets.right, 16) + 6,
                },
              ]}
            >
              <Text
                style={[
                  subtitleTextStyle(prefs),
                  { maxWidth: "94%" },
                ]}
              >
                {activeCue.text}
              </Text>
            </View>
          ) : null}

          {seekHint && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.seekHintWrap,
                seekHint.side === "left"
                  ? styles.seekHintLeft
                  : styles.seekHintRight,
                {
                  opacity: seekAnim,
                  transform: [
                    {
                      scale: seekAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.82, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View
                style={[styles.seekHintCircle, { borderColor: primaryColor }]}
              >
                <Ionicons
                  name={
                    seekHint.side === "left" ? "play-back" : "play-forward"
                  }
                  size={30}
                  color="#fff"
                />
                <Text style={styles.seekHintAmount}>
                  {seekHint.side === "left" ? "−" : "+"}
                  {seekHint.amount}s
                </Text>
              </View>
              <Text style={styles.seekHintTime}>{fmtTime(seekHint.target)}</Text>
              {seekHint.total > seekHint.amount ? (
                <Text style={styles.seekHintTotal}>
                  Total {seekHint.side === "left" ? "−" : "+"}
                  {seekHint.total}s
                </Text>
              ) : null}
            </Animated.View>
          )}

          {switching && (
            <View style={styles.centerOverlay} pointerEvents="none">
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.loadingText}>Switching server…</Text>
            </View>
          )}

          {!switching && buffering && !paused && !error && (
            <View style={styles.centerOverlay} pointerEvents="none">
              <ActivityIndicator size="large" color="#fff" />
            </View>
          )}

          {ended && !switching && (
            <View style={styles.centerOverlay} pointerEvents="box-none">
              <TouchableOpacity
                style={styles.replayButton}
                onPress={togglePlay}
                activeOpacity={0.8}
              >
                <Ionicons name="refresh" size={30} color="#fff" />
                <Text style={styles.replayText}>Replay</Text>
              </TouchableOpacity>
            </View>
          )}

          {error && !switching && (
            <View style={styles.errorBackdrop}>
              <View style={styles.errorCard}>
                <MaterialCommunityIcons
                  name="alert-circle-outline"
                  size={34}
                  color="#f87171"
                />
                <Text style={styles.errorTitle}>Playback failed</Text>
                <Text style={styles.errorMessage}>{error.message}</Text>
                <View style={styles.errorActions}>
                  <TouchableOpacity
                    style={[
                      styles.errorButton,
                      { borderColor: primaryColor },
                    ]}
                    onPress={retryStream}
                  >
                    <Ionicons
                      name="refresh"
                      size={16}
                      color={primaryColor}
                    />
                    <Text
                      style={[
                        styles.errorButtonText,
                        { color: primaryColor },
                      ]}
                    >
                      Retry
                    </Text>
                  </TouchableOpacity>
                  {normalizedStreams.length > 1 && (
                    <TouchableOpacity
                      style={styles.errorButton}
                      onPress={() => setPanel("server")}
                    >
                      <MaterialCommunityIcons
                        name="dns"
                        size={16}
                        color="#ddd"
                      />
                      <Text style={styles.errorButtonText}>Choose server</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          )}

          {showControls && !locked && (
            <View
              style={[
                styles.topBar,
                {
                  paddingTop: Math.max(insets.top, 10) + 4,
                  paddingLeft: Math.max(insets.left, 10),
                  paddingRight: Math.max(insets.right, 10),
                },
              ]}
            >
              <TouchableOpacity
                style={styles.iconButton}
                onPress={minimizeAndBack}
                accessibilityLabel="Minimize player"
              >
                <Ionicons name="chevron-down" size={26} color="#fff" />
              </TouchableOpacity>
              <View style={styles.titleWrap}>
                <Text numberOfLines={1} style={styles.title}>
                  {playerMeta?.title || "Playing"}
                </Text>
                {playerMeta?.episode ? (
                  <Text numberOfLines={1} style={styles.episodeTitle}>
                    {playerMeta.episode}
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity
                style={styles.pill}
                onPress={() => setPanel("subtitle")}
              >
                <MaterialCommunityIcons
                  name="subtitles-outline"
                  size={17}
                  color={subtitle.kind === "off" ? ICON : primaryColor}
                />
                <Text
                  numberOfLines={1}
                  style={[
                    styles.pillText,
                    subtitle.kind !== "off" && { color: primaryColor },
                  ]}
                >
                  {subtitleLabel}
                </Text>
              </TouchableOpacity>
              {audioTracks.length > 1 && (
                <TouchableOpacity
                  style={styles.pill}
                  onPress={() => setPanel("audio")}
                >
                  <MaterialCommunityIcons
                    name="waveform"
                    size={17}
                    color={ICON}
                  />
                  <Text numberOfLines={1} style={styles.pillText}>
                    {selectedAudioLabel}
                  </Text>
                </TouchableOpacity>
              )}
              <View style={styles.comboPill}>
                <TouchableOpacity
                  style={styles.comboHalf}
                  onPress={() => setPanel("server")}
                  accessibilityLabel="Choose server"
                >
                  <MaterialCommunityIcons name="dns" size={16} color={ICON} />
                  <Text numberOfLines={1} style={styles.comboLabel}>
                    {serverLabel}
                  </Text>
                </TouchableOpacity>
                <View style={styles.comboDivider} />
                <TouchableOpacity
                  style={styles.comboHalf}
                  onPress={() => setPanel("quality")}
                  accessibilityLabel="Choose quality"
                >
                  <MaterialIcons name="high-quality" size={16} color={ICON} />
                  <Text numberOfLines={1} style={styles.comboLabel}>
                    {qualityLabel}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {showControls && !locked && (
            <View
              style={[
                styles.bottomBar,
                {
                  paddingBottom: Math.max(insets.bottom, 10),
                  paddingLeft: Math.max(insets.left, 12),
                  paddingRight: Math.max(insets.right, 12),
                },
              ]}
            >
              <View style={styles.seekRow}>
                <Text style={styles.time}>{fmtTime(currentTime)}</Text>
                <SeekBar
                  current={currentTime}
                  duration={duration}
                  buffered={buffered}
                  color={primaryColor}
                  onSeek={seekTo}
                />
                <TouchableOpacity
                  onPress={() => setShowRemaining((value) => !value)}
                >
                  <Text style={styles.time}>
                    {showRemaining
                      ? `-${fmtTime(remaining)}`
                      : fmtTime(duration)}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.bottomRow}>
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={handleLock}
                  accessibilityLabel="Lock controls"
                >
                  <MaterialCommunityIcons
                    name="lock-open-outline"
                    size={22}
                    color={ICON}
                  />
                </TouchableOpacity>

                <View style={styles.centerControls}>
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => seekTo(currentTime - 10)}
                  >
                    <MaterialIcons name="replay-10" size={28} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.playButton}
                    onPress={togglePlay}
                    accessibilityLabel={paused ? "Play" : "Pause"}
                  >
                    <Ionicons
                      name={paused ? "play" : "pause"}
                      size={34}
                      color="#fff"
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => seekTo(currentTime + 10)}
                  >
                    <MaterialIcons name="forward-10" size={28} color="#fff" />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.smallPill}
                  onPress={() => setPanel("speed")}
                >
                  <Text style={styles.pillText}>
                    {rate === 1 ? "1.0x" : `${rate}x`}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={() =>
                    setAspectIdx((value) => (value + 1) % ASPECTS.length)
                  }
                  onLongPress={() => setPanel("aspect")}
                  accessibilityLabel="Change screen size"
                >
                  <MaterialCommunityIcons
                    name="fit-to-screen-outline"
                    size={21}
                    color={ICON}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={toggleOrientation}
                  accessibilityLabel="Rotate screen"
                >
                  <MaterialCommunityIcons
                    name="screen-rotation"
                    size={21}
                    color={ICON}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={stopPlayback}
                  accessibilityLabel="Stop playback"
                >
                  <MaterialCommunityIcons
                    name="stop-circle-outline"
                    size={22}
                    color={ICON}
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {locked && (
            <TouchableOpacity
              style={[styles.unlockButton, { top: insets.top + 16 }]}
              onPress={handleLock}
            >
              <MaterialCommunityIcons
                name="lock-outline"
                size={22}
                color="#fff"
              />
            </TouchableOpacity>
          )}

          {gesture && (
            <View style={styles.gestureBubble} pointerEvents="none">
              <MaterialCommunityIcons
                name={
                  gesture.side === "right"
                    ? "volume-high"
                    : "brightness-5"
                }
                size={22}
                color="#fff"
              />
              <Text style={styles.gestureText}>
                {Math.round(gesture.value * 100)}%
              </Text>
            </View>
          )}

          {toast ? (
            <View style={styles.toast} pointerEvents="none">
              <Text style={styles.toastText}>{toast}</Text>
            </View>
          ) : null}

          {panel && (
            <View style={styles.panelBackdrop}>
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={() => {
                  setPanel(null);
                  wake();
                }}
              />
              <View style={styles.panel}>
                <Text style={styles.panelTitle}>{PANEL_TITLES[panel]}</Text>
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                >
                  {panelRows().length === 0 ? (
                    <Text style={styles.panelEmpty}>
                      {panel === "subtitle"
                        ? "No subtitles available for this stream."
                        : panel === "audio"
                          ? "This stream exposes a single audio track."
                          : panel === "quality"
                            ? "This stream does not expose quality options."
                            : "No options available."}
                    </Text>
                  ) : (
                    panelRows().map((row, index) => (
                      <PanelRow key={`${panel}-${index}`} {...row} />
                    ))
                  )}
                </ScrollView>
              </View>
            </View>
          )}
        </>
      ) : (
        <>
          <Pressable style={StyleSheet.absoluteFill} onPress={expandFromMini}>
            <LinearGradient
              colors={["rgba(0,0,0,0.05)", "rgba(0,0,0,0.82)"]}
              style={styles.miniGradient}
              pointerEvents="none"
            />
          </Pressable>
          <View style={styles.miniTopRow} pointerEvents="box-none">
            <View style={styles.miniTitlePill}>
              <Text numberOfLines={1} style={styles.miniTitle}>
                {playerMeta?.title || "Playing"}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.miniClose}
              onPress={stopPlayback}
              accessibilityLabel="Close mini player"
            >
              <Ionicons name="close" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={styles.miniCenter} pointerEvents="box-none">
            <TouchableOpacity
              style={styles.miniPlayButton}
              onPress={togglePlay}
              accessibilityLabel={paused ? "Play" : "Pause"}
            >
              <Ionicons
                name={paused ? "play" : "pause"}
                size={22}
                color="#fff"
              />
            </TouchableOpacity>
          </View>
          {activeCue ? (
            <View
              pointerEvents="none"
              style={[
                styles.miniSubtitleLayer,
                {
                  alignItems:
                    prefs.subtitleAlign === "left"
                      ? "flex-start"
                      : prefs.subtitleAlign === "right"
                        ? "flex-end"
                        : "center",
                },
              ]}
            >
              <Text
                numberOfLines={2}
                style={[
                  subtitleTextStyle(prefs, 0.55),
                  { maxWidth: "96%" },
                ]}
              >
                {activeCue.text}
              </Text>
            </View>
          ) : null}
          <View style={styles.miniProgressTrack} pointerEvents="none">
            <View
              style={[
                styles.miniProgressFill,
                {
                  width:
                    duration > 0
                      ? `${clamp((currentTime / duration) * 100, 0, 100)}%`
                      : "0%",
                  backgroundColor: primaryColor,
                },
              ]}
            />
          </View>
        </>
      )}
    </View>
  );
}

const absoluteFillStyle = {
  position: "absolute" as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};

const styles = StyleSheet.create({
  fullscreen: {
    ...absoluteFillStyle,
    backgroundColor: "#000",
    zIndex: 1000,
    elevation: 1000,
  },
  mini: {
    position: "absolute",
    backgroundColor: "#000",
    borderRadius: 12,
    overflow: "hidden",
    zIndex: 999,
    elevation: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.55,
    shadowRadius: 10,
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#000",
  },
  loadingText: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 13,
    fontWeight: "600",
  },
  gestureLayer: { ...absoluteFillStyle, zIndex: 10 },
  subtitleLayer: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 12,
  },
  miniSubtitleLayer: {
    position: "absolute",
    left: 4,
    right: 4,
    bottom: 7,
    zIndex: 5,
  },
  seekHintWrap: {
    position: "absolute",
    top: "36%",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 14,
  },
  seekHintLeft: { left: "8%", right: "54%" },
  seekHintRight: { left: "54%", right: "8%" },
  seekHintCircle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 1.5,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  seekHintAmount: { color: "#fff", fontSize: 15, fontWeight: "800" },
  seekHintTime: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 8,
  },
  seekHintTotal: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 10.5,
    marginTop: 2,
  },
  centerOverlay: {
    ...absoluteFillStyle,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 15,
    gap: 10,
  },
  replayButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  replayText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  errorBackdrop: {
    ...absoluteFillStyle,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.72)",
    zIndex: 45,
    padding: 24,
  },
  errorCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "rgba(18,18,18,0.97)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    padding: 20,
    alignItems: "center",
    gap: 8,
  },
  errorTitle: { color: "#fff", fontSize: 17, fontWeight: "800" },
  errorMessage: {
    color: "#aaa",
    fontSize: 12.5,
    textAlign: "center",
    lineHeight: 18,
  },
  errorActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  errorButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  errorButtonText: { color: "#ddd", fontSize: 13, fontWeight: "700" },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 12,
    zIndex: 30,
  },
  titleWrap: { flex: 1, marginHorizontal: 8 },
  title: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  episodeTitle: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 11,
    marginTop: 1,
  },
  iconButton: { padding: 7 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,0,0,0.48)",
    borderRadius: 16,
    paddingHorizontal: 9,
    paddingVertical: 6,
    marginLeft: 5,
  },
  smallPill: {
    backgroundColor: "rgba(0,0,0,0.48)",
    borderRadius: 14,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  pillText: {
    color: ICON,
    fontSize: 11,
    fontWeight: "600",
    maxWidth: 74,
  },
  comboPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.48)",
    borderRadius: 16,
    marginLeft: 5,
    overflow: "hidden",
  },
  comboHalf: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    maxWidth: 108,
  },
  comboDivider: {
    width: StyleSheet.hairlineWidth,
    height: 16,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  comboLabel: {
    color: ICON,
    fontSize: 11,
    fontWeight: "600",
    maxWidth: 64,
  },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
    paddingTop: 8,
  },
  seekRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  time: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 12,
    fontWeight: "600",
    minWidth: 52,
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    width: "100%",
    gap: 2,
  },
  centerControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    gap: 16,
  },
  playButton: { padding: 6 },
  unlockButton: {
    position: "absolute",
    left: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 20,
    padding: 8,
    zIndex: 40,
  },
  gestureBubble: {
    position: "absolute",
    alignSelf: "center",
    top: "42%",
    backgroundColor: "rgba(0,0,0,0.68)",
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: "center",
    zIndex: 20,
  },
  gestureText: { color: "#fff", fontSize: 13, fontWeight: "700", marginTop: 4 },
  toast: {
    position: "absolute",
    top: 62,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.68)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 60,
    maxWidth: "80%",
  },
  toastText: { color: "#fff", fontSize: 12.5, textAlign: "center" },
  panelBackdrop: {
    ...absoluteFillStyle,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
    padding: 20,
  },
  panel: {
    width: 360,
    maxWidth: "92%",
    maxHeight: "78%",
    backgroundColor: "rgba(13,13,13,0.97)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    padding: 12,
    elevation: 20,
  },
  panelTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 10,
  },
  panelEmpty: {
    color: "#888",
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 24,
  },
  miniGradient: { ...absoluteFillStyle },
  miniTopRow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    padding: 7,
  },
  miniTitlePill: {
    flex: 1,
    marginRight: 6,
  },
  miniTitle: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  miniClose: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  miniCenter: {
    ...absoluteFillStyle,
    alignItems: "center",
    justifyContent: "center",
  },
  miniPlayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  miniProgressTrack: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  miniProgressFill: { height: "100%" },
});
