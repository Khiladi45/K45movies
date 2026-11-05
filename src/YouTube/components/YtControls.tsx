import React, { useEffect, useRef, useState } from "react";
import { Animated, PanResponder, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatClock } from "../utils";

type Props = {
  playing: boolean;
  buffering: boolean;
  position: number;
  duration: number;
  fullscreen: boolean;
  title?: string;
  onToggle: () => void;
  onSeek: (seconds: number) => void;
  onSkip: (delta: number) => void;
  onNext?: () => void;
  onFullscreen: () => void;
  onMinimize: () => void;
  onGear: () => void;
  /** Called when the controls are tapped awake, so the page can react. */
  onTapVideo?: () => void;
};

const HIDE_AFTER = 3200;

/** Seek bar: tap or drag. Reports the final position on release. */
function SeekBar({
  position,
  duration,
  onSeek,
  onScrub,
}: {
  position: number;
  duration: number;
  onSeek: (s: number) => void;
  onScrub: (active: boolean) => void;
}) {
  const [width, setWidth] = useState(1);
  const [drag, setDrag] = useState<number | null>(null);
  const widthRef = useRef(1);
  const durationRef = useRef(duration);
  durationRef.current = duration;
  const startX = useRef(0);

  const ratioAt = (x: number) => Math.min(1, Math.max(0, x / widthRef.current));

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

  const ratio = drag ?? (duration > 0 ? Math.min(1, position / duration) : 0);
  return (
    <View
      style={styles.seekHit}
      onLayout={(e) => {
        widthRef.current = Math.max(1, e.nativeEvent.layout.width);
        setWidth(widthRef.current);
      }}
      {...pan.panHandlers}
    >
      <View style={styles.track}>
        <View style={[styles.fill, { width: ratio * width }]} />
      </View>
      <View style={[styles.knob, { left: ratio * width - 6 }]} />
    </View>
  );
}

/** YouTube-style overlay: top actions, centre transport, bottom seek bar. */
export default function YtControls(p: Props) {
  const [visible, setVisible] = useState(true);
  const [scrubbing, setScrubbing] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const poke = (fn: () => void) => () => {
    fn();
    setVisible(true);
    if (p.playing) arm();
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => {
          setVisible((v) => !v);
          p.onTapVideo?.();
        }}
        accessibilityLabel="Toggle player controls"
      />
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.layer, { opacity: fade }]}
        pointerEvents={visible ? "box-none" : "none"}
      >
        <View style={styles.shade} pointerEvents="none" />
        <View style={styles.top}>
          <TouchableOpacity style={styles.icon} onPress={poke(p.onMinimize)} accessibilityLabel="Minimize player">
            <Ionicons name="chevron-down" size={28} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={styles.icon} onPress={poke(p.onMinimize)} accessibilityLabel="Mini player">
            <Ionicons name="browsers-outline" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.icon} onPress={poke(p.onGear)} accessibilityLabel="Quality">
            <Ionicons name="settings-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.center} pointerEvents="box-none">
          <TouchableOpacity style={styles.side} onPress={poke(() => p.onSkip(-10))} accessibilityLabel="Back 10 seconds">
            <Ionicons name="play-back" size={26} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.play} onPress={poke(p.onToggle)} accessibilityLabel={p.playing ? "Pause" : "Play"}>
            <Ionicons name={p.buffering ? "ellipsis-horizontal" : p.playing ? "pause" : "play"} size={34} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.side}
            onPress={poke(p.onNext ?? (() => p.onSkip(10)))}
            accessibilityLabel={p.onNext ? "Next video" : "Forward 10 seconds"}
          >
            <Ionicons name={p.onNext ? "play-skip-forward" : "play-forward"} size={26} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.bottom}>
          <Text style={styles.time}>
            {formatClock(p.position)} / {formatClock(p.duration)}
          </Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={styles.iconSm} onPress={poke(p.onFullscreen)} accessibilityLabel={p.fullscreen ? "Exit fullscreen" : "Fullscreen"}>
            <Ionicons name={p.fullscreen ? "contract-outline" : "expand-outline"} size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </Animated.View>
      <View style={styles.seekWrap} pointerEvents="box-none">
        <SeekBar position={p.position} duration={p.duration} onSeek={p.onSeek} onScrub={setScrubbing} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { justifyContent: "space-between" },
  shade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.35)" },
  top: { flexDirection: "row", alignItems: "center", paddingHorizontal: 4, paddingTop: 4 },
  icon: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  iconSm: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  center: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 36 },
  side: { width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" },
  play: { width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },
  bottom: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingBottom: 14 },
  time: { color: "#fff", fontSize: 12, fontWeight: "500" },
  seekWrap: { position: "absolute", left: 0, right: 0, bottom: 0 },
  seekHit: { height: 22, justifyContent: "flex-end" },
  track: { height: 3, backgroundColor: "rgba(255,255,255,0.3)" },
  fill: { height: 3, backgroundColor: "#ff0000" },
  knob: { position: "absolute", bottom: -4, width: 12, height: 12, borderRadius: 6, backgroundColor: "#ff0000" },
});
