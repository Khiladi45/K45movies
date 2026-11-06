import React, { useEffect, useRef, useState } from "react";
import { Animated, PanResponder, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatClock, getBrightness, getVolume, setBrightness, setVolume } from "../utils";

type Props = {
  playing: boolean;
  buffering: boolean;
  position: number;
  duration: number;
  fullscreen: boolean;
  locked: boolean;
  title?: string;
  channel?: string;
  autoplay: boolean;
  onToggle: () => void;
  onSeek: (seconds: number) => void;
  onSkip: (delta: number) => void;
  onPrev: () => void;
  onNext?: () => void;
  onFullscreen: () => void;
  onMinimize: () => void;
  onSettings: () => void;
  onCaptions: () => void;
  onAutoplay: () => void;
  onUnlock: () => void;
  /** Fullscreen only: like / comments / save / share row, "More videos". */
  extra?: React.ReactNode;
};

const HIDE_AFTER = 3200;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Seek bar: tap or drag. Reports the final position on release. */
function SeekBar({
  position,
  duration,
  inset,
  onSeek,
  onScrub,
}: {
  position: number;
  duration: number;
  inset: number;
  onSeek: (s: number) => void;
  onScrub: (active: boolean) => void;
}) {
  const [width, setWidth] = useState(1);
  const [drag, setDrag] = useState<number | null>(null);
  const widthRef = useRef(1);
  const durationRef = useRef(duration);
  durationRef.current = duration;
  const startX = useRef(0);
  const ratioAt = (x: number) => clamp(x / widthRef.current, 0, 1);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        startX.current = e.nativeEvent.locationX;
        onScrub(true);
        setDrag(ratioAt(startX.current));
      },
      onPanResponderMove: (_, g) => setDrag(ratioAt(startX.current + g.dx)),
      onPanResponderRelease: (_, g) => {
        const r = ratioAt(startX.current + g.dx);
        setDrag(null);
        onScrub(false);
        onSeek(r * durationRef.current);
      },
      onPanResponderTerminate: () => {
        setDrag(null);
        onScrub(false);
      },
    }),
  ).current;

  const ratio = drag ?? (duration > 0 ? clamp(position / duration, 0, 1) : 0);
  return (
    <View
      style={[styles.seekHit, { marginHorizontal: inset }]}
      onLayout={(e) => {
        widthRef.current = Math.max(1, e.nativeEvent.layout.width);
        setWidth(widthRef.current);
      }}
      {...pan.panHandlers}
    >
      <View style={styles.track}>
        <View style={[styles.fill, { width: ratio * width }]} />
      </View>
      <View style={[styles.knob, { left: ratio * width - 7 }]} />
    </View>
  );
}

/**
 * YouTube-style overlay. Top: minimize, autoplay, captions, settings. Centre:
 * previous / play / next. Bottom: time, fullscreen, seek bar. Gestures: double
 * tap a side to skip 10s (keep tapping for 20s, 30s...), and in fullscreen
 * swipe the left half for brightness and the right half for volume.
 */
export default function YtControls(p: Props) {
  const [visible, setVisible] = useState(true);
  const [scrubbing, setScrubbing] = useState(false);
  const [hud, setHud] = useState<{ kind: "seek" | "brightness" | "volume"; side: "left" | "right"; text: string; value?: number } | null>(null);
  const [lockHint, setLockHint] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hudTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const layerSize = useRef({ w: 1, h: 1 });
  const fullscreenRef = useRef(p.fullscreen);
  fullscreenRef.current = p.fullscreen;
  const props = useRef(p);
  props.current = p;

  const arm = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setVisible(false), HIDE_AFTER);
  };

  useEffect(() => {
    Animated.timing(fade, { toValue: visible ? 1 : 0, duration: 180, useNativeDriver: true }).start();
    if (visible && p.playing && !scrubbing) arm();
    else if (timer.current) clearTimeout(timer.current);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, p.playing, scrubbing]);

  useEffect(
    () => () => {
      if (hudTimer.current) clearTimeout(hudTimer.current);
    },
    [],
  );

  const flashHud = (next: NonNullable<typeof hud>, hold = 700) => {
    setHud(next);
    if (hudTimer.current) clearTimeout(hudTimer.current);
    hudTimer.current = setTimeout(() => setHud(null), hold);
  };

  const poke = (fn: () => void) => () => {
    fn();
    setVisible(true);
    if (p.playing) arm();
  };

  // ---- touch layer: tap / double tap / vertical swipe ----
  const tap = useRef<{ t: number; side: string; chain: number; timer: ReturnType<typeof setTimeout> | null; reset: ReturnType<typeof setTimeout> | null }>({
    t: 0, side: "", chain: 0, timer: null, reset: null,
  });
  const swipe = useRef<{ mode: "none" | "brightness" | "volume"; base: number; moved: boolean }>({ mode: "none", base: 0.5, moved: false });

  const touch = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        swipe.current = { mode: "none", base: 0.5, moved: false };
      },
      onPanResponderMove: (e, g) => {
        if (!fullscreenRef.current) return;
        const s = swipe.current;
        if (s.mode === "none") {
          if (Math.abs(g.dy) > 12 && Math.abs(g.dy) > Math.abs(g.dx)) {
            const left = e.nativeEvent.locationX - g.dx < layerSize.current.w / 2;
            s.mode = left ? "brightness" : "volume";
            s.moved = true;
            (left ? getBrightness() : getVolume()).then((v) => {
              s.base = v;
            });
          }
          return;
        }
        const value = clamp(s.base - g.dy / (layerSize.current.h * 0.7), 0, 1);
        if (s.mode === "brightness") setBrightness(value);
        else setVolume(value);
        flashHud(
          {
            kind: s.mode,
            side: s.mode === "brightness" ? "left" : "right",
            text: `${Math.round(value * 100)}%`,
            value,
          },
          900,
        );
      },
      onPanResponderRelease: (e, g) => {
        const s = swipe.current;
        if (s.moved || Math.abs(g.dx) > 12 || Math.abs(g.dy) > 12) return;
        const x = e.nativeEvent.locationX;
        const w = layerSize.current.w;
        const side = x < w * 0.4 ? "left" : x > w * 0.6 ? "right" : "mid";
        const now = Date.now();
        const t = tap.current;

        const chaining = side !== "mid" && t.side === side && (t.chain > 0 || now - t.t < 320);
        if (chaining) {
          if (t.timer) clearTimeout(t.timer);
          t.chain += 1;
          t.t = now;
          const delta = side === "left" ? -10 : 10;
          props.current.onSkip(delta);
          flashHud({ kind: "seek", side, text: `${side === "left" ? "-" : "+"}${t.chain * 10} seconds` }, 800);
          if (t.reset) clearTimeout(t.reset);
          t.reset = setTimeout(() => {
            t.chain = 0;
            t.side = "";
          }, 700);
          return;
        }

        t.t = now;
        t.side = side;
        t.chain = 0;
        if (t.timer) clearTimeout(t.timer);
        t.timer = setTimeout(() => {
          setVisible((v) => !v);
          t.side = "";
        }, 300);
      },
    }),
  ).current;

  if (p.locked) {
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <View style={StyleSheet.absoluteFill} onTouchEnd={() => setLockHint(true)} />
        {lockHint ? (
          <TouchableOpacity
            style={styles.unlock}
            onPress={() => {
              setLockHint(false);
              p.onUnlock();
            }}
            accessibilityLabel="Unlock screen"
          >
            <Ionicons name="lock-open-outline" size={26} color="#fff" />
            <Text style={styles.unlockText}>Tap to unlock</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  const inset = p.fullscreen ? 20 : 0;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View
        style={StyleSheet.absoluteFill}
        onLayout={(e) => {
          layerSize.current = { w: Math.max(1, e.nativeEvent.layout.width), h: Math.max(1, e.nativeEvent.layout.height) };
        }}
        {...touch.panHandlers}
        accessibilityLabel="Player surface"
      />

      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]} pointerEvents={visible ? "box-none" : "none"}>
        <View style={styles.shade} pointerEvents="none" />

        <View style={[styles.top, p.fullscreen && { paddingHorizontal: 12 }]} pointerEvents="box-none">
          <TouchableOpacity style={styles.icon} onPress={poke(p.onMinimize)} accessibilityLabel="Minimize player">
            <Ionicons name="chevron-down" size={30} color="#fff" />
          </TouchableOpacity>
          {p.fullscreen ? (
            <View style={styles.titleBlock} pointerEvents="none">
              <Text style={styles.title} numberOfLines={1}>
                {p.title}
              </Text>
              {p.channel ? (
                <Text style={styles.channel} numberOfLines={1}>
                  {p.channel}
                </Text>
              ) : null}
            </View>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          <TouchableOpacity style={styles.pill} onPress={poke(p.onAutoplay)} accessibilityRole="switch" accessibilityState={{ checked: p.autoplay }} accessibilityLabel="Autoplay">
            <View style={[styles.pillKnob, p.autoplay && styles.pillKnobOn]}>
              <Ionicons name={p.autoplay ? "play" : "pause"} size={11} color="#222" />
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.icon} onPress={poke(p.onCaptions)} accessibilityLabel="Captions">
            <Ionicons name="text-outline" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.icon} onPress={poke(p.onSettings)} accessibilityLabel="Settings">
            <Ionicons name="settings-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.center} pointerEvents="box-none">
          <TouchableOpacity style={styles.side} onPress={poke(p.onPrev)} accessibilityLabel="Previous">
            <Ionicons name="play-skip-back" size={30} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.play} onPress={poke(p.onToggle)} accessibilityLabel={p.playing ? "Pause" : "Play"}>
            <Ionicons name={p.playing ? "pause" : "play"} size={54} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.side, !p.onNext && { opacity: 0.4 }]}
            disabled={!p.onNext}
            onPress={poke(p.onNext ?? (() => {}))}
            accessibilityLabel="Next video"
          >
            <Ionicons name="play-skip-forward" size={30} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.bottom} pointerEvents="box-none">
          <View style={[styles.timeRow, { paddingHorizontal: inset || 12 }]} pointerEvents="box-none">
            <Text style={styles.time}>
              {formatClock(p.position)} / {formatClock(p.duration)}
            </Text>
            <View style={{ flex: 1 }} />
            <TouchableOpacity style={styles.iconSm} onPress={poke(p.onFullscreen)} accessibilityLabel={p.fullscreen ? "Exit fullscreen" : "Fullscreen"}>
              <Ionicons name={p.fullscreen ? "contract-outline" : "expand-outline"} size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          {p.fullscreen ? (
            <>
              <SeekBar position={p.position} duration={p.duration} inset={inset} onSeek={p.onSeek} onScrub={setScrubbing} />
              {p.extra ? <View style={styles.extra}>{p.extra}</View> : null}
            </>
          ) : null}
        </View>
      </Animated.View>

      {/* Inline: the thin seek bar stays visible even with the controls hidden. */}
      {!p.fullscreen ? (
        <View style={styles.seekWrap} pointerEvents="box-none">
          <SeekBar position={p.position} duration={p.duration} inset={0} onSeek={p.onSeek} onScrub={setScrubbing} />
        </View>
      ) : null}

      {hud ? (
        <View style={[styles.hud, hud.kind === "seek" ? (hud.side === "left" ? styles.hudLeft : styles.hudRight) : styles.hudCenter]} pointerEvents="none">
          {hud.kind !== "seek" ? (
            <Ionicons name={hud.kind === "brightness" ? "sunny-outline" : (hud.value ?? 0) === 0 ? "volume-mute-outline" : "volume-high-outline"} size={22} color="#fff" />
          ) : null}
          <Text style={styles.hudText}>{hud.text}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.4)" },
  top: { flexDirection: "row", alignItems: "center", paddingHorizontal: 4, paddingTop: 4 },
  titleBlock: { flex: 1, paddingHorizontal: 6 },
  title: { color: "#fff", fontSize: 17, fontWeight: "700" },
  channel: { color: "rgba(255,255,255,0.7)", fontSize: 13, marginTop: 1 },
  icon: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  iconSm: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  pill: { width: 46, height: 26, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.28)", justifyContent: "center", paddingHorizontal: 2, marginHorizontal: 6 },
  pillKnob: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#d9d9d9", alignItems: "center", justifyContent: "center", alignSelf: "flex-start" },
  pillKnobOn: { alignSelf: "flex-end", backgroundColor: "#fff" },
  center: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 56 },
  side: { width: 52, height: 52, alignItems: "center", justifyContent: "center" },
  play: { width: 72, height: 72, alignItems: "center", justifyContent: "center" },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0 },
  timeRow: { flexDirection: "row", alignItems: "center", paddingBottom: 8 },
  time: { color: "#fff", fontSize: 13, fontWeight: "500" },
  extra: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 14 },
  seekWrap: { position: "absolute", left: 0, right: 0, bottom: 0 },
  seekHit: { height: 24, justifyContent: "flex-end" },
  track: { height: 3, backgroundColor: "rgba(255,255,255,0.3)" },
  fill: { height: 3, backgroundColor: "#ff0000" },
  knob: { position: "absolute", bottom: -5, width: 14, height: 14, borderRadius: 7, backgroundColor: "#ff0000" },
  hud: { position: "absolute", top: "40%", flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(0,0,0,0.65)", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  hudLeft: { left: "14%" },
  hudRight: { right: "14%" },
  hudCenter: { alignSelf: "center" },
  hudText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  unlock: { position: "absolute", alignSelf: "center", top: "42%", flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(0,0,0,0.7)", borderRadius: 24, paddingHorizontal: 18, paddingVertical: 12 },
  unlockText: { color: "#fff", fontSize: 14, fontWeight: "600" },
});
