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
import Video, { ResizeMode, SelectedVideoTrackType } from "react-native-video";
import { useYtPlayback, useYtStreamInfo } from "../hooks";
import { YT } from "../theme";
import YtControls from "./YtControls";
import YtSheet from "./YtSheet";
import { Ionicons } from "@expo/vector-icons";

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
  const [gear, setGear] = useState(false);
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
  const qualities = info.data?.qualities ?? [];

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
            resizeMode={resizeMode === "cover" ? ResizeMode.COVER : ResizeMode.CONTAIN}
            selectedVideoTrack={selectedVideoTrack as any}
            progressUpdateInterval={500}
            onLoad={(d: any) => {
              setLoaded(true);
              setDuration(Number(d?.duration) || 0);
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

      {controls === "full" && loaded && !failed ? (
        <YtControls
          playing={isPlaying}
          buffering={buffering}
          position={position}
          duration={duration}
          fullscreen={fullscreen}
          onToggle={() => setUserPaused((v) => !v)}
          onSeek={seek}
          onSkip={(d) => seek(posRef.current + d)}
          onNext={onNext}
          onFullscreen={() => onToggleFullscreen?.()}
          onMinimize={() => onMinimize?.()}
          onGear={() => setGear(true)}
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
        <YtSheet visible={gear} onClose={() => setGear(false)} title="Quality">
          {[{ height: 0, label: "Auto", muxed: true }, ...qualities].map((q) => {
            const selected = height === q.height;
            return (
              <TouchableOpacity
                key={q.height}
                style={styles.qRow}
                onPress={() => {
                  setHeight(q.height);
                  setGear(false);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <Ionicons name={selected ? "checkmark" : "ellipse-outline"} size={20} color={selected ? YT.blue : "transparent"} />
                <Text style={[styles.qText, selected && { color: YT.blue }]}>{q.label}</Text>
                {q.height === 0 ? <Text style={styles.qHint}>Recommended</Text> : null}
              </TouchableOpacity>
            );
          })}
          {info.isLoading ? <ActivityIndicator color={YT.muted} style={{ padding: 16 }} /> : null}
          {!adaptive && qualities.length > 0 ? (
            <Text style={styles.qNote}>This video is playing as a single MP4, so its quality can't be changed.</Text>
          ) : null}
        </YtSheet>
      ) : null}
    </View>
  );
});

export default YtPlayer;

const styles = StyleSheet.create({
  box: { backgroundColor: "#000", overflow: "hidden" },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: 10 },
  error: { color: "#fff", fontSize: 13 },
  retry: { backgroundColor: YT.surface, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16 },
  retryText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  zoomBadge: { position: "absolute", top: 12, alignSelf: "center", backgroundColor: "rgba(0,0,0,0.7)", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 4 },
  zoomText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  qRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingVertical: 14 },
  qText: { color: YT.text, fontSize: 15, flex: 1 },
  qHint: { color: YT.muted, fontSize: 12 },
  qNote: { color: YT.muted, fontSize: 12, paddingHorizontal: 20, paddingVertical: 10 },
});
