import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
  PanResponder,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import Video, {
  ResizeMode,
  SelectedTrackType,
  SelectedVideoTrackType,
  TextTrackType,
  ViewType,
} from "react-native-video";
import { Image } from "expo-image";
import { useYtPlayback, useYtStreamInfo } from "../hooks";
import { YT } from "../theme";
import YtControls from "./YtControls";
import PlayerSettings, { type Caption, type SettingsPage } from "./PlayerSettings";
import { useYtPlayerStore } from "../playerStore";

export type YtPlayerHandle = {
  position: () => number;
};

type Props = {
  /** YouTube watch / shorts URL. Resolved through the provider's stream(). */
  link: string;
  /** A downloaded file. When set, no provider call is made (works offline). */
  localUri?: string;
  paused?: boolean;
  repeat?: boolean;
  /** "full" = YouTube-style overlay; "none" = bare video (Shorts, mini player). */
  controls?: "full" | "none";
  /** Shown over the video until it starts, so there is never a black box. */
  poster?: string;
  title?: string;
  channel?: string;
  /** Fullscreen only: the like / comments / save / share row. */
  extra?: React.ReactNode;
  /** Shorts and the mini player: start fast, cap the bitrate. */
  lowLatency?: boolean;
  resizeMode?: "contain" | "cover";
  /** Resolve streams only when true, so off-screen Shorts stay idle. */
  active?: boolean;
  /** Seek here once the video has loaded. */
  startAt?: number;
  fullscreen?: boolean;
  /** Pinch to scale the picture between 25% and 400% (no panning). */
  zoomable?: boolean;
  style?: StyleProp<ViewStyle>;
  onEnd?: () => void;
  onNext?: () => void;
  onToggleFullscreen?: () => void;
  onMinimize?: () => void;
  onProgress?: (position: number, duration: number) => void;
};

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * One video surface for the video page, Shorts and the mini player. It resolves
 * streams, falls back to the next candidate on error, draws the custom
 * controls, and offers the quality (gear) sheet built from the API's list.
 */
const YtPlayer = forwardRef<YtPlayerHandle, Props>(function YtPlayer(
  {
    link,
    localUri,
    paused = false,
    repeat = false,
    controls = "none",
    poster,
    title,
    channel,
    extra,
    lowLatency = false,
    resizeMode = "contain",
    active = true,
    startAt = 0,
    fullscreen = false,
    zoomable = false,
    style,
    onEnd,
    onNext,
    onToggleFullscreen,
    onMinimize,
    onProgress,
  },
  ref,
) {
  const videoRef = useRef<any>(null);
  const playback = useYtPlayback(link, active && !localUri);
  const info = useYtStreamInfo(link, active && !localUri && controls === "full");
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [height, setHeight] = useState(0); // 0 = Auto
  const [settings, setSettings] = useState<{ visible: boolean; page: SettingsPage }>({ visible: false, page: "root" });
  const [speed, setSpeed] = useState(1);
  const [caption, setCaption] = useState(-1);
  const [locked, setLocked] = useState(false);
  const [playingHeight, setPlayingHeight] = useState(0);
  const [trackHeights, setTrackHeights] = useState<number[]>([]);
  const autoplay = useYtPlayerStore((st) => st.autoplay);
  const toggleAutoplay = useYtPlayerStore((st) => st.toggleAutoplay);
  const posRef = useRef(0);
  const seekedFor = useRef("");

  const streams = playback.data?.streams ?? [];
  const start = playback.data?.startIndex ?? 0;

  useEffect(() => {
    setIndex(start);
    setFailed(false);
    setLoaded(false);
    setUserPaused(false);
    setPosition(0);
    setDuration(0);
    setHeight(0);
    setCaption(-1);
    setPlayingHeight(0);
    setTrackHeights([]);
    posRef.current = 0;
  }, [link, localUri, playback.data, start]);

  useImperativeHandle(ref, () => ({ position: () => posRef.current }));

  const stream = streams[index];

  const source = useMemo(() => {
    if (localUri) return { uri: localUri };
    if (!stream) return undefined;
    const headers = stream.headers || {};
    return {
      uri: stream.link,
      ...(stream.format === "hls" ? { type: "m3u8" } : {}),
      ...(stream.format === "dash" ? { type: "mpd" } : {}),
      ...(Object.keys(headers).length > 0 ? { headers } : {}),
    };
  }, [localUri, stream]);

  // Pinning a height only works on an adaptive playlist; MP4s have one size.
  const adaptive = !!stream?.adaptive;
  const selectedVideoTrack = useMemo(
    () =>
      adaptive && height > 0
        ? { type: SelectedVideoTrackType.RESOLUTION, value: height }
        : { type: SelectedVideoTrackType.AUTO },
    [adaptive, height],
  );

  const captions = useMemo<Caption[]>(() => {
    const raw = (stream as any)?.subtitles;
    return Array.isArray(raw)
      ? raw.filter((c: any) => c?.uri).map((c: any) => ({ title: c.title || c.language || "Captions", language: c.language || "", uri: c.uri }))
      : [];
  }, [stream]);
  const textTracks = useMemo(
    () => captions.map((c) => ({ title: c.title, language: c.language, type: TextTrackType.VTT, uri: c.uri })),
    [captions],
  );

  const bufferConfig = useMemo(
    () =>
      lowLatency
        ? { minBufferMs: 2500, maxBufferMs: 15000, bufferForPlaybackMs: 400, bufferForPlaybackAfterRebufferMs: 1000 }
        : { minBufferMs: 15000, maxBufferMs: 50000, bufferForPlaybackMs: 800, bufferForPlaybackAfterRebufferMs: 2500 },
    [lowLatency],
  );

  const onError = () => {
    if (!localUri && index + 1 < streams.length) {
      setLoaded(false);
      setIndex(index + 1);
    } else {
      setFailed(true);
    }
  };

  const retry = () => {
    setFailed(false);
    setLoaded(false);
    if (localUri) return;
    if (streams.length > 1) setIndex(start);
    else playback.refetch();
  };

  const seek = useCallback((t: number) => {
    const target = clamp(t, 0, Math.max(0, duration || t));
    try {
      videoRef.current?.seek(target);
    } catch {}
    posRef.current = target;
    setPosition(target);
  }, [duration]);

  const isPlaying = !paused && !userPaused;

  // ---- pinch to scale (two fingers, scale only) ----
  const scale = useRef(new Animated.Value(1)).current;
  const baseScale = useRef(1);
  const startDist = useRef(0);
  const [zoomLabel, setZoomLabel] = useState("");
  const zoomTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dist = (t: any[]) => Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY);

  const pinch = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponderCapture: (e) => zoomable && e.nativeEvent.touches.length === 2,
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (e) => {
          const touches = e.nativeEvent.touches;
          if (touches.length !== 2) return;
          if (!startDist.current) {
            startDist.current = dist(touches as any);
            return;
          }
          const next = clamp(baseScale.current * (dist(touches as any) / startDist.current), MIN_ZOOM, MAX_ZOOM);
          scale.setValue(next);
          setZoomLabel(`${Math.round(next * 100)}%`);
        },
        onPanResponderRelease: () => {
          // Read the final value back from the label-free source of truth.
          scale.stopAnimation((v) => {
            baseScale.current = v;
          });
          startDist.current = 0;
          if (zoomTimer.current) clearTimeout(zoomTimer.current);
          zoomTimer.current = setTimeout(() => setZoomLabel(""), 900);
        },
        onPanResponderTerminate: () => {
          scale.stopAnimation((v) => {
            baseScale.current = v;
          });
          startDist.current = 0;
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [zoomable],
  );

  // A new video starts at 100% again.
  useEffect(() => {
    scale.setValue(1);
    baseScale.current = 1;
  }, [link, scale]);

  const resolving = !localUri && active && playback.isLoading;
  const noStream = !localUri && active && !playback.isLoading && (playback.isError || streams.length === 0);
  // Heights from the API plus anything the player itself reports.
  const mergedQualities = useMemo(() => {
    const byHeight = new Map<number, { height: number; label: string; muxed: boolean }>();
    for (const q of info.data?.qualities ?? []) byHeight.set(q.height, q);
    for (const h of trackHeights) if (!byHeight.has(h)) byHeight.set(h, { height: h, label: `${h}p`, muxed: true });
    return [...byHeight.values()].sort((a, b) => b.height - a.height);
  }, [info.data, trackHeights]);

  return (
    <View style={[styles.box, style]} {...(zoomable ? pinch.panHandlers : {})}>
      {source && !failed ? (
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale }] }]}>
          <Video
            key={`${source.uri}`}
            ref={videoRef}
            style={StyleSheet.absoluteFill}
            source={source as any}
            paused={!isPlaying}
            repeat={repeat}
            controls={false}
            // TextureView, not SurfaceView: a SurfaceView draws nothing (sound
            // only) inside a clipped, scaled or floating view like the mini player.
            viewType={ViewType.TEXTURE}
            rate={speed}
            bufferConfig={bufferConfig as any}
            maxBitRate={lowLatency ? 2_500_000 : undefined}
            textTracks={textTracks as any}
            selectedTextTrack={(caption >= 0 ? { type: SelectedTrackType.INDEX, value: caption } : { type: SelectedTrackType.DISABLED }) as any}
            onVideoTracks={(d: any) => {
              const hs = (d?.videoTracks || []).map((t: any) => Number(t.height) || 0).filter(Boolean);
              setTrackHeights([...new Set<number>(hs)].sort((x, y) => y - x));
            }}
            resizeMode={resizeMode === "cover" ? ResizeMode.COVER : ResizeMode.CONTAIN}
            selectedVideoTrack={selectedVideoTrack as any}
            progressUpdateInterval={500}
            onLoad={(d: any) => {
              setLoaded(true);
              setDuration(Number(d?.duration) || 0);
              setPlayingHeight(Number(d?.naturalSize?.height) || 0);
              if (startAt > 0 && seekedFor.current !== link) {
                seekedFor.current = link;
                try {
                  videoRef.current?.seek(startAt);
                } catch {}
              }
            }}
            onProgress={(d: any) => {
              const t = Number(d?.currentTime) || 0;
              posRef.current = t;
              setPosition(t);
              onProgress?.(t, duration);
            }}
            onBuffer={(d: any) => setBuffering(!!d?.isBuffering)}
            onError={onError}
            onEnd={onEnd}
            playWhenInactive
          />
        </Animated.View>
      ) : null}

      {poster && !loaded && !failed ? (
        <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} contentFit={resizeMode === "cover" ? "cover" : "contain"} />
      ) : null}

      {controls === "full" && !failed ? (
        <YtControls
          playing={isPlaying}
          buffering={buffering}
          position={position}
          duration={duration}
          fullscreen={fullscreen}
          locked={locked}
          title={title}
          channel={channel}
          autoplay={autoplay}
          extra={extra}
          onToggle={() => setUserPaused((v) => !v)}
          onSeek={seek}
          onSkip={(d) => seek(posRef.current + d)}
          onPrev={() => seek(0)}
          onNext={onNext}
          onFullscreen={() => onToggleFullscreen?.()}
          onMinimize={() => onMinimize?.()}
          onSettings={() => setSettings({ visible: true, page: "root" })}
          onCaptions={() => setSettings({ visible: true, page: "captions" })}
          onAutoplay={toggleAutoplay}
          onUnlock={() => setLocked(false)}
        />
      ) : null}

      {zoomLabel ? (
        <View style={styles.zoomBadge} pointerEvents="none">
          <Text style={styles.zoomText}>{zoomLabel}</Text>
        </View>
      ) : null}

      {(resolving || (source && !loaded && !failed)) && (
        <View style={styles.overlay} pointerEvents="none">
          <ActivityIndicator color="#fff" />
        </View>
      )}

      {(noStream || failed) && (
        <View style={styles.overlay}>
          <Text style={styles.error}>This video couldn't be played.</Text>
          <TouchableOpacity style={styles.retry} onPress={noStream ? () => playback.refetch() : retry}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {controls === "full" ? (
        <PlayerSettings
          visible={settings.visible}
          page={settings.page}
          onClose={() => setSettings((v) => ({ ...v, visible: false }))}
          qualities={mergedQualities}
          height={height}
          playingHeight={playingHeight}
          canPickQuality={adaptive}
          onHeight={setHeight}
          speed={speed}
          onSpeed={setSpeed}
          captions={captions}
          caption={caption}
          onCaption={setCaption}
          onLock={() => setLocked(true)}
        />
      ) : null}
    </View>
  );
});

export default YtPlayer;

const styles = StyleSheet.create({
  box: { backgroundColor: "#000", overflow: "hidden" },
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", gap: 10 },
  error: { color: "#fff", fontSize: 13 },
  retry: { backgroundColor: YT.surface, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16 },
  retryText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  zoomBadge: { position: "absolute", top: 12, alignSelf: "center", backgroundColor: "rgba(0,0,0,0.7)", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 4 },
  zoomText: { color: "#fff", fontSize: 13, fontWeight: "600" },
});
