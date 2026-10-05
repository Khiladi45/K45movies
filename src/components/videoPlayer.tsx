import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  ScrollView,
  PanResponder,
  Dimensions,
  Platform,
} from "react-native";
import Video, {
  ResizeMode,
  SelectedTrackType,
  SelectedVideoTrackType,
  BufferingStrategyType,
} from "react-native-video";
import {
  Ionicons,
  MaterialCommunityIcons,
  MaterialIcons,
} from "@expo/vector-icons";
import { createMMKV } from "react-native-mmkv";

const mmkv = createMMKV();
const ICON = "rgba(255,255,255,0.78)";
const RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const ASPECTS: { key: any; label: string }[] = [
  { key: ResizeMode.CONTAIN, label: "Fit" },
  { key: ResizeMode.COVER, label: "Cover" },
  { key: ResizeMode.STRETCH, label: "Stretch" },
  { key: ResizeMode.NONE, label: "100%" },
  { key: "16:9", label: "16:9" },
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

const getQualityIcon = (height?: number, fallback?: string): string => {
  const h = Number(height) || Number((fallback || "").match(/\d+/)?.[0]) || 0;
  if (h >= 3000) return "8k";
  if (h >= 1500) return "4k";
  if (h >= 1200) return "2k";
  if (h >= 500) return "hd";
  if (h > 0) return "sd";
  return "video-settings";
};
const formatQuality = (q?: string) => {
  if (!q || q === "auto") return "Auto";
  const n = Number(q);
  if (!n) return q.toUpperCase();
  if (n > 1080) return "4K";
  if (n > 720) return "1080p";
  if (n > 480) return "720p";
  if (n > 360) return "480p";
  return `${n}p`;
};
const fmtTime = (t: number) => {
  if (!Number.isFinite(t) || t < 0) t = 0;
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
};

// ✅ FIXED SEEK BAR: Use layout + pageX for accurate seek
function SeekBar({ current, duration, buffered, color, onSeek }: any) {
  const [drag, setDrag] = useState<number | null>(null);
  const dragRef = useRef(0);
  const trackRef = useRef<View>(null);
  const layoutRef = useRef({ x: 0, width: 1 });

  const updateFromEvent = (pageX: number) => {
    const localX = pageX - layoutRef.current.x;
    const ratio = Math.min(1, Math.max(0, localX / layoutRef.current.width));
    dragRef.current = ratio;
    setDrag(ratio);
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => updateFromEvent(e.nativeEvent.pageX),
      onPanResponderMove: (e) => updateFromEvent(e.nativeEvent.pageX),
      onPanResponderRelease: () => {
        onSeek(dragRef.current * duration);
        setDrag(null);
      },
    }),
  ).current;

  const shown = drag !== null ? drag * duration : current;
  const progress = duration > 0 ? Math.min(1, shown / duration) : 0;
  const buff = duration > 0 ? Math.min(1, buffered / duration) : 0;

  return (
    <View
      {...responder.panHandlers}
      ref={trackRef}
      onLayout={(e) => {
        const { x, width } = e.nativeEvent.layout;
        // Track may be inside a parent, so measure absolute position
        trackRef.current?.measure?.((_x, _y, w, _h, pageX) => {
          layoutRef.current = {
            x: pageX ?? x,
            width: w || width || 1,
          };
        });
      }}
      style={sb.wrap}
    >
      <View style={sb.track}>
        <View style={[sb.buffered, { width: `${buff * 100}%` }]} />
        <View
          style={[
            sb.progress,
            { width: `${progress * 100}%`, backgroundColor: color },
          ]}
        />
      </View>
      <View
        style={[
          sb.thumb,
          { left: `${progress * 100}%`, backgroundColor: color },
        ]}
      />
    </View>
  );
}
const sb = StyleSheet.create({
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

function PanelRow({ icon, title, detail, selected, accent, onPress }: any) {
  return (
    <TouchableOpacity
      style={[
        prow.row,
        selected && { backgroundColor: "rgba(255,255,255,0.08)" },
      ]}
      onPress={onPress}
    >
      <MaterialCommunityIcons
        name={icon}
        size={20}
        color={selected ? accent : "#999"}
      />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text
          numberOfLines={1}
          style={[prow.title, selected && { color: accent, fontWeight: "800" }]}
        >
          {title}
        </Text>
        {detail ? (
          <Text numberOfLines={1} style={prow.detail}>
            {detail}
          </Text>
        ) : null}
      </View>
      {selected && (
        <Ionicons name="checkmark-circle" size={20} color={accent} />
      )}
    </TouchableOpacity>
  );
}
const prow = StyleSheet.create({
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

export default function VideoPlayer({
  videoUrl,
  streams = [],
  initialStreamIndex = 0,
  title,
  episodeTitle,
  accentColor = "#E50914",
  onBack,
  onNextEpisode,
  hasNextEpisode,
}: any) {
  const playerRef = useRef<any>(null);
  const [sourceUri, setSourceUri] = useState(videoUrl);
  const [streamIndex, setStreamIndex] = useState(initialStreamIndex);
  const currentStream: any = streams[streamIndex] || { link: videoUrl };

  const [showControls, setShowControls] = useState(true);
  const [panel, setPanel] = useState<null | string>(null);
  const [paused, setPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [buffering, setBuffering] = useState(true);
  const [locked, setLocked] = useState(false);
  const [rate, setRate] = useState(1);
  const [aspectIdx, setAspectIdx] = useState(0);
  const [gesture, setGesture] = useState<null | {
    side: string;
    value: number;
  }>(null);
  const [toast, setToast] = useState("");
  const [showRemaining, setShowRemaining] = useState(true);
  const [zoom, setZoom] = useState(1);

  const [subtitleFontSize, setSubtitleFontSize] = useState(16);
  const [subtitlePos, setSubtitlePos] = useState({ x: 0, y: 0 });
  const [subtitleBg, setSubtitleBg] = useState(true);
  const [subtitleBorder, setSubtitleBorder] = useState(true);

  const [audioTracks, setAudioTracks] = useState<any[]>([]);
  const [textTracks, setTextTracks] = useState<any[]>([]);
  const [videoTracks, setVideoTracks] = useState<any[]>([]);
  const [selAudio, setSelAudio] = useState<any>({
    type: SelectedTrackType.INDEX,
    value: 0,
  });
  const [selAudioIdx, setSelAudioIdx] = useState(0);
  const [selText, setSelText] = useState<any>({
    type: SelectedTrackType.DISABLED,
  });
  const [selTextIdx, setSelTextIdx] = useState(1000);
  const [selVideo, setSelVideo] = useState<any>({
    type: SelectedVideoTrackType.AUTO,
  });
  const [selVideoIdx, setSelVideoIdx] = useState(1000);

  const hideTimer = useRef<any>(null);
  const lastTap = useRef<{ t: number; x: number; y: number }>({
    t: 0,
    x: 0,
    y: 0,
  });
  const pinchStartDist = useRef(0);
  const pinchStartZoom = useRef(1);

  // ✅ REFS for swipe gesture state (avoids null crashes during async)
  const swipeActiveRef = useRef<null | {
    side: string;
    baseValue: number;
    startTime: number;
  }>(null);
  const swipeCurrentRef = useRef<{ side: string; value: number } | null>(null);

  useEffect(() => {
    ScreenOrientation?.lockAsync?.(ScreenOrientation.OrientationLock.LANDSCAPE);
    return () => {
      ScreenOrientation?.unlockAsync?.();
    };
  }, []);

  const wake = useCallback((stay = false) => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (!stay)
      hideTimer.current = setTimeout(() => {
        setShowControls(false);
        setPanel(null);
      }, 5000);
  }, []);
  useEffect(() => {
    wake();
    return () => hideTimer.current && clearTimeout(hideTimer.current);
  }, [wake]);
  useEffect(() => {
    if (panel) wake(true);
  }, [panel, wake]);

  const onLoad = (e: any) => {
    setDuration(e.duration || 0);
    setBuffering(false);
    if (e.audioTracks?.length) setAudioTracks(e.audioTracks);
    if (e.textTracks?.length) setTextTracks(e.textTracks);
    if (e.videoTracks?.length) setVideoTracks(e.videoTracks);
    try {
      const cached = JSON.parse(
        mmkv.getString(`playerProgress:${videoUrl}`) || "null",
      );
      const pos = cached?.position || 0;
      if (pos > 5 && e.duration && pos / e.duration < 0.9) {
        playerRef.current?.seek(pos);
        setCurrentTime(pos);
      }
    } catch {}
    playerRef.current?.resume();
  };
  const onProgress = (e: any) => {
    setCurrentTime(e.currentTime);
    setBuffered(e.playableDuration || 0);
    mmkv.set(
      `playerProgress:${videoUrl}`,
      JSON.stringify({
        position: e.currentTime,
        duration: e.seekableDuration || 0,
      }),
    );
  };

  // Pinch zoom
  const pinchResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => gs.numberActiveTouches === 2,
      onPanResponderGrant: () => {
        pinchStartZoom.current = zoom;
      },
      onPanResponderMove: (e) => {
        if (e.nativeEvent.touches.length === 2) {
          const t1 = e.nativeEvent.touches[0];
          const t2 = e.nativeEvent.touches[1];
          const dist = Math.hypot(t2.pageX - t1.pageX, t2.pageY - t1.pageY);
          if (pinchStartDist.current === 0) pinchStartDist.current = dist;
          else {
            const scale = dist / pinchStartDist.current;
            setZoom(Math.min(3, Math.max(0.5, pinchStartZoom.current * scale)));
          }
        }
      },
      onPanResponderRelease: () => {
        pinchStartDist.current = 0;
        pinchStartZoom.current = zoom;
      },
    }),
  ).current;

  // ✅ FIXED SWIPE RESPONDER: uses refs, no null crashes
  const swipeResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => {
        const dx = Math.abs(gs.dx);
        const dy = Math.abs(gs.dy);
        return !locked && (dx > 15 || dy > 15);
      },
      onPanResponderGrant: (e, gs) => {
        const w = Dimensions.get("window").width;
        const side = e.nativeEvent.locationX < w / 2 ? "left" : "right";
        const isHorizontal = Math.abs(gs.dx) >= Math.abs(gs.dy);

        if (isHorizontal) {
          swipeActiveRef.current = {
            side: "seek",
            baseValue: currentTime,
            startTime: Date.now(),
          };
          swipeCurrentRef.current = { side: "seek", value: currentTime };
          setGesture({ side: "seek", value: currentTime });
        } else {
          swipeActiveRef.current = {
            side,
            baseValue: 0.5,
            startTime: Date.now(),
          };
          swipeCurrentRef.current = { side, value: 0.5 };
          setGesture({ side, value: 0.5 });
          // Fetch base value async, but keep gesture active to prevent null
          (async () => {
            let base = 0.5;
            if (side === "right" && VolumeManager) {
              try {
                const v = await VolumeManager.getVolume();
                base = typeof v === "number" ? v : (v?.volume ?? 0.5);
              } catch {}
            } else if (side === "left" && Brightness) {
              try {
                base = await Brightness.getBrightnessAsync();
              } catch {}
            }
            if (swipeActiveRef.current?.side === side) {
              swipeActiveRef.current.baseValue = base;
              swipeCurrentRef.current = { side, value: base };
              setGesture({ side, value: base });
            }
          })();
        }
      },
      onPanResponderMove: (_, gs) => {
        const active = swipeActiveRef.current;
        if (!active) return;
        const w = Dimensions.get("window").width;

        if (active.side === "seek") {
          // ✅ FIXED: forward swipe (right) = +5 to +15s, backward (left) = -5 to -180s
          const dx = gs.dx;
          const ratio = dx / w; // -1 to +1
          let delta = 0;
          if (dx >= 0) {
            // forward: up to +15 sec
            delta = Math.min(15, ratio * 30);
          } else {
            // backward: up to -180 sec (3 min)
            delta = Math.max(-180, ratio * 360);
          }
          // Enforce minimum 5s if any swipe occurred
          if (Math.abs(dx) > 15 && Math.abs(delta) < 5)
            delta = dx >= 0 ? 5 : -5;
          const newTime = Math.max(
            0,
            Math.min(duration || 0, active.baseValue + delta),
          );
          swipeCurrentRef.current = { side: "seek", value: newTime };
          setGesture({ side: "seek", value: newTime });
        } else {
          // Vertical: volume/brightness (left=brightness, right=volume)
          const val = Math.min(1, Math.max(0, active.baseValue - gs.dy / 250));
          swipeCurrentRef.current = { side: active.side, value: val };
          setGesture({ side: active.side, value: val });
          if (active.side === "right" && VolumeManager)
            VolumeManager.setVolume(val);
          if (active.side === "left" && Brightness)
            Brightness.setBrightnessAsync(val);
        }
      },
      onPanResponderRelease: (_, gs) => {
        const active = swipeActiveRef.current;
        if (active?.side === "seek") {
          const w = Dimensions.get("window").width;
          const dx = gs.dx;
          const ratio = dx / w;
          let delta = 0;
          if (dx >= 0) delta = Math.min(15, ratio * 30);
          else delta = Math.max(-180, ratio * 360);
          if (Math.abs(dx) > 15 && Math.abs(delta) < 5)
            delta = dx >= 0 ? 5 : -5;
          const newTime = Math.max(
            0,
            Math.min(duration || 0, active.baseValue + delta),
          );
          playerRef.current?.seek(newTime);
          setCurrentTime(newTime);
          wake();
        }
        swipeActiveRef.current = null;
        swipeCurrentRef.current = null;
        setGesture(null);
      },
    }),
  ).current;

  const handleTap = (e: any) => {
    if (locked || panel) return;
    // Don't toggle controls if we just finished a swipe
    if (swipeActiveRef.current) return;
    const now = Date.now();
    const x = e.nativeEvent.locationX;
    const y = e.nativeEvent.locationY;
    const w = Dimensions.get("window").width;
    const h = Dimensions.get("window").height;
    const centerX = w / 3 < x && x < (2 * w) / 3;
    const centerY = h / 3 < y && y < (2 * h) / 3;

    if (centerX && centerY && now - lastTap.current.t < 250) {
      setPaused(!paused);
      lastTap.current = { t: 0, x: 0, y: 0 };
      wake();
      return;
    }
    if (now - lastTap.current.t < 250 && !centerX) {
      const delta = x < w / 2 ? -10 : 10;
      const target = Math.max(0, Math.min(duration, currentTime + delta));
      playerRef.current?.seek(target);
      setCurrentTime(target);
      lastTap.current = { t: 0, x: 0, y: 0 };
      wake();
      return;
    }
    lastTap.current = { t: now, x, y };
    setTimeout(() => {
      if (lastTap.current.t === now) {
        if (!showControls) wake();
        else {
          setShowControls(false);
        }
      }
    }, 250);
  };

  const selectServer = (track: any, i: number) => {
    setStreamIndex(i);
    setSourceUri(track.link);
    setBuffering(true);
    setAudioTracks([]);
    setTextTracks([]);
    setVideoTracks([]);
    setSelAudioIdx(0);
    setSelTextIdx(1000);
    setSelVideoIdx(1000);
    setSelAudio({ type: SelectedTrackType.INDEX, value: 0 });
    setSelText({ type: SelectedTrackType.DISABLED });
    setSelVideo({ type: SelectedVideoTrackType.AUTO });
    setPanel(null);
    wake();
  };

  const cycleAspect = () => setAspectIdx((prev) => (prev + 1) % ASPECTS.length);

  const activeTrack = videoTracks.find((t: any) => t.selected);
  const qualityHeight =
    selVideoIdx !== 1000
      ? videoTracks[selVideoIdx]?.height
      : activeTrack?.height;
  const qualityLabel = qualityHeight
    ? `${qualityHeight}p`
    : formatQuality(currentStream?.quality);
  const qualityIcon = getQualityIcon(qualityHeight, currentStream?.quality);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const subtitleDrag = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => panel === "subtitle-settings",
      onMoveShouldSetPanResponder: () => panel === "subtitle-settings",
      onPanResponderMove: (_, gs) =>
        setSubtitlePos((prev) => ({ x: prev.x + gs.dx, y: prev.y + gs.dy })),
      onPanResponderRelease: () => {},
    }),
  ).current;

  const panelRows = (): any[] => {
    if (panel === "subtitle")
      return [
        {
          icon: "subtitles-off",
          title: "Disabled",
          selected: selTextIdx === 1000,
          onPress: () => {
            setSelText({ type: SelectedTrackType.DISABLED });
            setSelTextIdx(1000);
            setPanel(null);
          },
        },
        ...textTracks.map((t: any) => ({
          icon: "subtitles-outline",
          title: t.language || `Track ${t.index}`,
          detail: [t.type, t.title].filter(Boolean).join(" · "),
          selected: selTextIdx === t.index,
          onPress: () => {
            setSelText({
              type: SelectedTrackType.INDEX,
              value: String(t.index),
            });
            setSelTextIdx(t.index);
            setPanel(null);
          },
        })),
        {
          icon: "cog-outline",
          title: "Subtitle Settings",
          detail: "Size, position, background",
          onPress: () => setPanel("subtitle-settings"),
        },
      ];
    if (panel === "subtitle-settings")
      return [
        {
          icon: subtitleBg ? "checkbox-marked" : "checkbox-blank-outline",
          title: "Background",
          detail: subtitleBg ? "Background visible" : "Background removed",
          onPress: () => setSubtitleBg(!subtitleBg),
        },
        {
          icon: subtitleBorder ? "checkbox-marked" : "checkbox-blank-outline",
          title: "Text Border",
          detail: subtitleBorder ? "Outline visible" : "Outline removed",
          onPress: () => setSubtitleBorder(!subtitleBorder),
        },
      ];
    if (panel === "audio")
      return audioTracks.map((t: any, i: number) => ({
        icon: "waveform",
        title: t.language || `Audio ${i + 1}`,
        detail: [t.type, t.title].filter(Boolean).join(" · "),
        selected: selAudioIdx === i,
        onPress: () => {
          setSelAudio({ type: SelectedTrackType.LANGUAGE, value: t.language });
          setSelAudioIdx(i);
          setPanel(null);
        },
      }));
    if (panel === "server")
      return (streams.length ? streams : [currentStream]).map(
        (s: any, i: number) => ({
          icon: "dns",
          title: s.server || `Server ${i + 1}`,
          detail: [s.quality, ...(Array.isArray(s.tags) ? s.tags : [])]
            .filter(Boolean)
            .join(" · "),
          selected: i === streamIndex,
          onPress: () => selectServer(s, i),
        }),
      );
    if (panel === "quality")
      return [
        ...(videoTracks.length > 1
          ? [
              {
                icon: "video-settings",
                title: "Auto",
                detail: "Adaptive bitrate",
                selected: selVideoIdx === 1000,
                onPress: () => {
                  setSelVideo({ type: SelectedVideoTrackType.AUTO, value: "" });
                  setSelVideoIdx(1000);
                  setPanel(null);
                },
              },
            ]
          : []),
        ...videoTracks.map((t: any, i: number) => ({
          icon: "video-high-definition",
          title: t.height
            ? `${t.height}p`
            : t.width
              ? `${t.width}p`
              : "Standard",
          detail: [
            t.bitrate
              ? t.bitrate >= 1e6
                ? `${(t.bitrate / 1e6).toFixed(1)} Mbps`
                : `${Math.round(t.bitrate / 1000)} kbps`
              : null,
            t.width && t.height ? `${t.width}x${t.height}` : null,
          ]
            .filter(Boolean)
            .join(" · "),
          selected: selVideoIdx === i,
          onPress: () => {
            if (typeof t.index === "number" && t.index >= 0)
              setSelVideo({
                type: SelectedVideoTrackType.INDEX,
                value: String(t.index),
              });
            else if (t.height)
              setSelVideo({
                type: SelectedVideoTrackType.RESOLUTION,
                value: String(t.height),
              });
            setSelVideoIdx(i);
            setPanel(null);
          },
        })),
      ];
    if (panel === "speed")
      return RATES.map((r) => ({
        icon: "speedometer",
        title: `${r}x`,
        selected: rate === r,
        onPress: () => {
          setRate(r);
          setPanel(null);
        },
      }));
    if (panel === "aspect")
      return ASPECTS.map((a, i) => ({
        icon: "fit-to-screen-outline",
        title: a.label,
        selected: aspectIdx === i,
        onPress: () => {
          setAspectIdx(i);
          setPanel(null);
        },
      }));
    return [];
  };

  const PANEL_TITLES: any = {
    subtitle: "Subtitle",
    "subtitle-settings": "Subtitle Settings",
    audio: "Audio",
    server: "Server",
    quality: "Quality",
    speed: "Playback Speed",
    aspect: "Screen Size",
  };

  const remaining = Math.max(0, duration - currentTime);

  return (
    <View style={st.root}>
      <StatusBar hidden />

      <View style={st.videoWrap} {...pinchResponder.panHandlers}>
        <Video
          key={sourceUri}
          ref={playerRef}
          style={[StyleSheet.absoluteFill, { transform: [{ scale: zoom }] }]}
          source={{
            uri: sourceUri,
            ...(currentStream?.type === "m3u8" && { type: "m3u8" }),
            ...(currentStream?.type === "mpd" && { type: "mpd" }),
            ...(currentStream?.headers && { headers: currentStream.headers }),
            bufferConfig: {
              minBufferMs: 8000,
              maxBufferMs: 20000,
              bufferForPlaybackMs: 1500,
              bufferForPlaybackAfterRebufferMs: 3000,
            },
          }}
          resizeMode={
            ASPECTS[aspectIdx].key === "16:9"
              ? ResizeMode.CONTAIN
              : ASPECTS[aspectIdx].key
          }
          paused={paused}
          rate={rate}
          onLoad={onLoad}
          onProgress={onProgress}
          onBuffer={(e) => setBuffering(e.isBuffering)}
          onAudioTracks={(e: any) =>
            e.audioTracks?.length && setAudioTracks(e.audioTracks)
          }
          onTextTracks={(e: any) => e.textTracks && setTextTracks(e.textTracks)}
          onVideoTracks={(e: any) =>
            e.videoTracks?.length && setVideoTracks(e.videoTracks)
          }
          selectedAudioTrack={selAudio}
          selectedTextTrack={selText}
          selectedVideoTrack={selVideo}
          bufferingStrategy={BufferingStrategyType.DEPENDING_ON_MEMORY}
          playWhenInactive
          onError={() => {
            setBuffering(false);
            showToast("Playback error — try another server");
          }}
          onEnd={() =>
            hasNextEpisode && onNextEpisode
              ? onNextEpisode()
              : (setPaused(true), wake(true))
          }
        />
      </View>

      {/* Gesture layer */}
      {!locked && (
        <View
          style={st.gestureLayer}
          {...swipeResponder.panHandlers}
          onTouchEnd={handleTap}
        />
      )}

      {buffering && !paused && (
        <View style={st.center} pointerEvents="none">
          <ActivityIndicator size="large" color={accentColor} />
        </View>
      )}

      {gesture && (
        <View style={st.gestureBubble} pointerEvents="none">
          <MaterialCommunityIcons
            name={
              gesture.side === "right"
                ? "volume-high"
                : gesture.side === "left"
                  ? "brightness-5"
                  : "timer-outline"
            }
            size={22}
            color="#fff"
          />
          <Text style={st.gestureText}>
            {gesture.side === "seek"
              ? fmtTime(gesture.value)
              : `${Math.round(gesture.value * 100)}%`}
          </Text>
        </View>
      )}

      {toast ? (
        <View style={st.toast} pointerEvents="none">
          <Text style={st.toastText}>{toast}</Text>
        </View>
      ) : null}

      {/* ✅ TRANSPARENT TOP BAR */}
      {showControls && !locked && (
        <View style={st.topBar}>
          <TouchableOpacity style={st.iconBtn} onPress={onBack}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 10, marginRight: 8 }}>
            <Text numberOfLines={1} style={st.title}>
              {title || "Playing"}
            </Text>
            {episodeTitle ? (
              <Text numberOfLines={1} style={st.epTitle}>
                {episodeTitle}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity
            style={st.pill}
            onPress={() => setPanel("subtitle")}
          >
            <MaterialCommunityIcons
              name="subtitles-outline"
              size={17}
              color={ICON}
            />
            <Text numberOfLines={1} style={st.pillText}>
              {selTextIdx === 1000
                ? "Sub Off"
                : textTracks[selTextIdx]?.language || "Sub"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.pill} onPress={() => setPanel("audio")}>
            <MaterialCommunityIcons name="waveform" size={17} color={ICON} />
            <Text numberOfLines={1} style={st.pillText}>
              {audioTracks[selAudioIdx]?.language || "Audio"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.pill} onPress={() => setPanel("quality")}>
            <MaterialIcons name={qualityIcon as any} size={17} color={ICON} />
            <Text numberOfLines={1} style={st.pillText}>
              {qualityLabel}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.pill} onPress={() => setPanel("server")}>
            <MaterialCommunityIcons name="dns" size={17} color={ICON} />
            <Text numberOfLines={1} style={st.pillText}>
              {(currentStream?.server || "Server").slice(0, 10)}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ✅ TRANSPARENT BOTTOM BAR */}
      {showControls && !locked && (
        <View style={st.bottomBar}>
          <View style={st.seekRow}>
            <Text style={st.time}>{fmtTime(currentTime)}</Text>
            <SeekBar
              current={currentTime}
              duration={duration}
              buffered={buffered}
              color={accentColor}
              onSeek={(t: number) => {
                playerRef.current?.seek(t);
                setCurrentTime(t);
                wake();
              }}
            />
            <TouchableOpacity onPress={() => setShowRemaining(!showRemaining)}>
              <Text style={st.time}>
                {showRemaining ? `-${fmtTime(remaining)}` : fmtTime(duration)}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={st.bottomRow}>
            <TouchableOpacity
              style={st.iconBtn}
              onPress={() => {
                setLocked(true);
                setShowControls(false);
              }}
            >
              <MaterialCommunityIcons
                name="lock-open-outline"
                size={22}
                color={ICON}
              />
            </TouchableOpacity>

            <View style={st.centerControls}>
              <TouchableOpacity
                style={st.iconBtn}
                onPress={() => {
                  const t = Math.max(0, currentTime - 10);
                  playerRef.current?.seek(t);
                  setCurrentTime(t);
                  wake();
                }}
              >
                <MaterialIcons name="replay-10" size={28} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={st.playBtn}
                onPress={() => {
                  setPaused(!paused);
                  wake();
                }}
              >
                <Ionicons
                  name={paused ? "play" : "pause"}
                  size={36}
                  color="#fff"
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={st.iconBtn}
                onPress={() => {
                  const t = Math.min(duration, currentTime + 10);
                  playerRef.current?.seek(t);
                  setCurrentTime(t);
                  wake();
                }}
              >
                <MaterialIcons name="forward-10" size={28} color="#fff" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={st.pill} onPress={() => setPanel("speed")}>
              <MaterialCommunityIcons
                name="speedometer"
                size={17}
                color={ICON}
              />
              <Text style={st.pillText}>{rate === 1 ? "1.0" : rate}x</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={st.pill}
              onPress={cycleAspect}
              onLongPress={() => setPanel("aspect")}
            >
              <MaterialCommunityIcons
                name="fit-to-screen-outline"
                size={17}
                color={ICON}
              />
              <Text style={st.pillText}>{ASPECTS[aspectIdx].label}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={st.iconBtn}
              onPress={() => {
                playerRef.current?.enterPictureInPicture?.();
              }}
            >
              <MaterialCommunityIcons
                name="picture-in-picture-bottom-right-outline"
                size={22}
                color={ICON}
              />
            </TouchableOpacity>
            {hasNextEpisode && onNextEpisode && (
              <TouchableOpacity style={st.iconBtn} onPress={onNextEpisode}>
                <MaterialCommunityIcons
                  name="skip-next-outline"
                  size={24}
                  color="#fff"
                />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {locked && (
        <TouchableOpacity
          style={st.lockBtn}
          onPress={() => {
            setLocked(false);
            wake();
          }}
        >
          <MaterialCommunityIcons name="lock-outline" size={22} color="#fff" />
        </TouchableOpacity>
      )}

      {panel && (
        <View
          style={st.panelBackdrop}
          onTouchEnd={() => {
            setPanel(null);
            wake();
          }}
        >
          <View
            style={st.panel}
            onTouchEnd={(e) => e.stopPropagation()}
            {...(panel === "subtitle-settings" ? subtitleDrag.panHandlers : {})}
          >
            <Text style={st.panelTitle}>{PANEL_TITLES[panel]}</Text>
            {panel === "subtitle-settings" && (
              <View style={st.sliderContainer}>
                <Text style={st.sliderLabel}>
                  Font Size: {subtitleFontSize}px
                </Text>
                <View style={st.sliderRow}>
                  <TouchableOpacity
                    onPress={() =>
                      setSubtitleFontSize(Math.max(10, subtitleFontSize - 2))
                    }
                  >
                    <Ionicons
                      name="remove-circle"
                      size={32}
                      color={accentColor}
                    />
                  </TouchableOpacity>
                  <View style={st.sliderTrack}>
                    <View
                      style={[
                        st.sliderFill,
                        {
                          width: `${((subtitleFontSize - 10) / 30) * 100}%`,
                          backgroundColor: accentColor,
                        },
                      ]}
                    />
                  </View>
                  <TouchableOpacity
                    onPress={() =>
                      setSubtitleFontSize(Math.min(40, subtitleFontSize + 2))
                    }
                  >
                    <Ionicons name="add-circle" size={32} color={accentColor} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              {panelRows().length === 0 ? (
                <Text style={st.panelEmpty}>
                  No options available for this stream
                </Text>
              ) : (
                panelRows().map((r: any, i: number) => (
                  <PanelRow key={i} {...r} accent={accentColor} />
                ))
              )}
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  videoWrap: { ...StyleSheet.absoluteFill, overflow: "hidden" },
  gestureLayer: { ...StyleSheet.absoluteFill, zIndex: 10 },
  center: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 15,
  },
  gestureBubble: {
    position: "absolute",
    alignSelf: "center",
    top: "40%",
    backgroundColor: "rgba(0,0,0,0.65)",
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: "center",
    zIndex: 20,
  },
  gestureText: { color: "#fff", fontSize: 13, fontWeight: "700", marginTop: 4 },
  toast: {
    position: "absolute",
    top: 50,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 60,
  },
  toastText: { color: "#fff", fontSize: 13 },

  // ✅ FULLY TRANSPARENT TOP BAR
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingTop: Platform.OS === "android" ? 34 : 12,
    paddingBottom: 10,
    backgroundColor: "transparent", // ✅ no background
    zIndex: 30,
  },
  title: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  epTitle: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 11,
    marginTop: 1,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  iconBtn: { padding: 8 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginLeft: 6,
  },
  pillText: { color: ICON, fontSize: 11, fontWeight: "600", maxWidth: 70 },

  // ✅ FULLY TRANSPARENT BOTTOM BAR
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 14,
    zIndex: 30,
    backgroundColor: "transparent", // ✅ no background
  },
  seekRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  time: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 12,
    fontWeight: "600",
    minWidth: 50,
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    width: "100%",
  },
  centerControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    gap: 20,
  },
  playBtn: { padding: 8 },

  lockBtn: {
    position: "absolute",
    top: 44,
    left: 16,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 20,
    padding: 8,
    zIndex: 40,
  },

  panelBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 50,
  },
  panel: {
    width: 340,
    maxWidth: "85%",
    maxHeight: "78%",
    backgroundColor: "rgba(13,13,13,0.96)",
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
  sliderContainer: { marginBottom: 12, paddingHorizontal: 4 },
  sliderLabel: {
    color: "#ccc",
    fontSize: 13,
    marginBottom: 8,
    textAlign: "center",
  },
  sliderRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  sliderTrack: {
    flex: 1,
    height: 6,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 3,
  },
  sliderFill: { height: "100%", borderRadius: 3 },
});
