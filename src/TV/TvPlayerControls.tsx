// Remote-friendly controls for the player on Android TV. The overlay keeps
// doing all the playback work; this only renders focusable buttons and the
// progress line, and calls back into the overlay.
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useThemeStore } from "@/store/useThemeStore";
import Focusable from "./components/Focusable";

export type TvPanel = "audio" | "subtitle" | "quality" | "server" | "sources" | "episodes";

const fmt = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(sec).padStart(2, "0")}`;
};

function Button({
  icon,
  label,
  onPress,
  preferred,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  onPress: () => void;
  preferred?: boolean;
}) {
  return (
    <Focusable
      style={styles.button}
      focusedStyle={styles.buttonFocused}
      onPress={onPress}
      hasTVPreferredFocus={preferred}
      accessibilityLabel={label}
    >
      {(focused) => (
        <>
          <MaterialCommunityIcons name={icon} size={24} color="#fff" />
          {focused ? <Text style={styles.label}>{label}</Text> : null}
        </>
      )}
    </Focusable>
  );
}

export default function TvPlayerControls({
  title,
  subtitle,
  paused,
  currentTime,
  duration,
  buffered,
  qualityLabel,
  serverLabel,
  onTogglePlay,
  onSeekBy,
  onOpenPanel,
  hasEpisodes,
  hasSources,
  onNextEpisode,
  onRestart,
}: {
  title: string;
  subtitle?: string;
  paused: boolean;
  currentTime: number;
  duration: number;
  buffered: number;
  qualityLabel?: string;
  serverLabel?: string;
  onTogglePlay: () => void;
  onSeekBy: (seconds: number) => void;
  onOpenPanel: (panel: TvPanel) => void;
  hasEpisodes: boolean;
  hasSources: boolean;
  onNextEpisode?: () => void;
  onRestart: () => void;
}) {
  const primaryColor = useThemeStore((s) => s.primaryColor);
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  const loaded = duration > 0 ? Math.min(1, buffered / duration) : 0;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <LinearGradient
        colors={["rgba(0,0,0,0.75)", "rgba(0,0,0,0)"]}
        style={styles.top}
        pointerEvents="none"
      >
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </LinearGradient>

      <LinearGradient colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.85)"]} style={styles.bottom}>
        <View style={styles.timeRow}>
          <Text style={styles.time}>{fmt(currentTime)}</Text>
          <View style={styles.track}>
            <View style={[styles.loaded, { width: `${loaded * 100}%` }]} />
            <View style={[styles.played, { width: `${progress * 100}%`, backgroundColor: primaryColor }]} />
          </View>
          <Text style={styles.time}>{fmt(duration)}</Text>
        </View>
        <View style={styles.buttons}>
          <Button icon="restart" label="Restart" onPress={onRestart} />
          <Button icon="rewind-10" label="Back 10s" onPress={() => onSeekBy(-10)} />
          <Button
            preferred
            icon={paused ? "play" : "pause"}
            label={paused ? "Play" : "Pause"}
            onPress={onTogglePlay}
          />
          <Button icon="fast-forward-10" label="Forward 10s" onPress={() => onSeekBy(10)} />
          {onNextEpisode ? (
            <Button icon="skip-next" label="Next episode" onPress={onNextEpisode} />
          ) : null}
          <View style={styles.spacer} />
          <Button icon="translate" label="Audio" onPress={() => onOpenPanel("audio")} />
          <Button icon="subtitles-outline" label="Subtitles" onPress={() => onOpenPanel("subtitle")} />
          <Button
            icon="high-definition-box"
            label={qualityLabel ? `Quality · ${qualityLabel}` : "Quality"}
            onPress={() => onOpenPanel("quality")}
          />
          <Button
            icon="server-network"
            label={serverLabel ? `Server · ${serverLabel}` : "Server"}
            onPress={() => onOpenPanel("server")}
          />
          {hasSources ? (
            <Button icon="playlist-play" label="Sources" onPress={() => onOpenPanel("sources")} />
          ) : null}
          {hasEpisodes ? (
            <Button icon="format-list-numbered" label="Episodes" onPress={() => onOpenPanel("episodes")} />
          ) : null}
        </View>
        <Text style={styles.hint}>◀ ▶ seek 10s while controls are hidden · OK shows controls</Text>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { position: "absolute", top: 0, left: 0, right: 0, paddingHorizontal: 32, paddingTop: 22, paddingBottom: 40 },
  title: { color: "#fff", fontSize: 20, fontWeight: "800" },
  subtitle: { color: "rgba(255,255,255,0.75)", fontSize: 13, marginTop: 4 },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 32, paddingTop: 40, paddingBottom: 18 },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  time: { color: "#fff", fontSize: 13, fontVariant: ["tabular-nums"], minWidth: 52, textAlign: "center" },
  track: { flex: 1, height: 4, backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 2, overflow: "hidden" },
  loaded: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: "rgba(255,255,255,0.35)" },
  played: { position: "absolute", left: 0, top: 0, bottom: 0 },
  buttons: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 },
  spacer: { flex: 1 },
  button: {
    minWidth: 44,
    height: 44,
    paddingHorizontal: 10,
    borderRadius: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  buttonFocused: { backgroundColor: "rgba(255,255,255,0.18)" },
  label: { color: "#fff", fontSize: 13, fontWeight: "700" },
  hint: { color: "rgba(255,255,255,0.45)", fontSize: 11, marginTop: 8 },
});
