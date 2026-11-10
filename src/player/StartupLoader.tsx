// Playback start-up screen: blurred poster backdrop, an animated ring, the
// title, step-by-step progress and a friendly line that changes until the
// first frame shows. Native Animated only (light enough for TV boxes).
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useThemeStore } from "@/store/useThemeStore";
import {
  PLAYBACK_STAGES,
  usePlaybackStageStore,
} from "@/store/usePlaybackStageStore";
import { getPreferredLanguage } from "@/store/useLayoutStore";
import { languageName } from "@/lib/languages";
import { loaderLine, loaderSteps } from "@/lib/loaderMessages";

function Ring({ color, size }: { color: string; size: number }) {
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1100,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const b = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    a.start();
    b.start();
    return () => {
      a.stop();
      b.stop();
    };
  }, [spin, pulse]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const counter = spin.interpolate({ inputRange: [0, 1], outputRange: ["360deg", "0deg"] });
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.12] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.55] });
  const inner = size * 0.62;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={[
          styles.glow,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
            opacity: glowOpacity,
            transform: [{ scale: glowScale }],
          },
        ]}
      />
      <Animated.View
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 4,
          borderColor: "transparent",
          borderTopColor: color,
          borderRightColor: color,
          transform: [{ rotate }],
        }}
      />
      <Animated.View
        style={{
          position: "absolute",
          width: size * 0.8,
          height: size * 0.8,
          borderRadius: (size * 0.8) / 2,
          borderWidth: 3,
          borderColor: "transparent",
          borderBottomColor: "rgba(255,255,255,0.75)",
          transform: [{ rotate: counter }],
        }}
      />
      <View
        style={{
          width: inner,
          height: inner,
          borderRadius: inner / 2,
          backgroundColor: "rgba(0,0,0,0.55)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MaterialCommunityIcons name="play" size={inner * 0.55} color="#fff" style={{ marginLeft: 3 }} />
      </View>
    </View>
  );
}

export default function StartupLoader({
  title,
  image,
  compact = false,
  overlay = false,
}: {
  title?: string;
  image?: string;
  /** Mini player: just the ring. */
  compact?: boolean;
  /** Drawn over a video that is buffering its first frame. */
  overlay?: boolean;
}) {
  const primaryColor = useThemeStore((s) => s.primaryColor);
  const stage = usePlaybackStageStore((s) => s.stage);
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);
  const preferred = getPreferredLanguage();
  const langName = preferred ? languageName(preferred) : null;
  const steps = useMemo(() => loaderSteps(langName), [langName]);
  const current = Math.max(0, PLAYBACK_STAGES.indexOf(stage));
  const line = loaderLine(stage, now - startedAt, langName);

  // Fade the line when it changes.
  const fade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, [line, fade]);

  if (compact) {
    return (
      <View style={styles.compact} pointerEvents="none">
        <Ring color={primaryColor} size={46} />
      </View>
    );
  }

  return (
    <View style={[StyleSheet.absoluteFill, styles.root, overlay && styles.overlayRoot]} pointerEvents="none">
      {image && !overlay ? (
        <Image source={{ uri: image }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={24} />
      ) : null}
      <LinearGradient
        colors={
          overlay
            ? ["rgba(0,0,0,0.35)", "rgba(0,0,0,0.65)"]
            : ["rgba(0,0,0,0.55)", "rgba(0,0,0,0.85)", "#000"]
        }
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.content}>
        <Ring color={primaryColor} size={104} />
        {title ? (
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
        ) : null}
        <View style={styles.steps}>
          {steps.map((step, index) => {
            const done = index < current;
            const active = index === current;
            return (
              <View key={step.key} style={styles.step}>
                <MaterialCommunityIcons
                  name={done ? "check-circle" : active ? "circle-slice-5" : "circle-outline"}
                  size={16}
                  color={done ? "#4ade80" : active ? primaryColor : "rgba(255,255,255,0.35)"}
                />
                <Text
                  style={[
                    styles.stepText,
                    done && styles.stepDone,
                    active && styles.stepActive,
                  ]}
                >
                  {step.label}
                </Text>
              </View>
            );
          })}
        </View>
        <Animated.Text style={[styles.line, { opacity: fade }]}>{line}</Animated.Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  overlayRoot: { backgroundColor: "transparent" },
  content: { alignItems: "center", paddingHorizontal: 24, maxWidth: 520 },
  glow: { position: "absolute" },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 18,
  },
  steps: { marginTop: 16, gap: 7, alignSelf: "center" },
  step: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepText: { color: "rgba(255,255,255,0.45)", fontSize: 13, fontWeight: "600" },
  stepDone: { color: "rgba(255,255,255,0.75)" },
  stepActive: { color: "#fff", fontWeight: "800" },
  line: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
    marginTop: 16,
    textAlign: "center",
  },
  compact: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
});
