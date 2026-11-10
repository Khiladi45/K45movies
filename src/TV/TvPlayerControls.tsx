// Remote-friendly controls for the player on Android TV. The overlay keeps
// doing all the playback work; this only renders focusable buttons, the
// timeline (with a seek preview) and calls back into the overlay.
//
// Layout: a big Play/Pause button in the middle has first focus. While it is
// focused, OK plays/pauses, holding OK plays at 2x, and Left/Right seek (the
// overlay handles the remote keys). Down moves to the button row.
import React, { useEffect, useRef, useState } from "react";
import { findNodeHandle, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useThemeStore } from "@/store/useThemeStore";
import Focusable from "./components/Focusable";

export type TvPanel =
  | "audio"
  | "subtitle"
  | "quality"
  | "server"
  | "sources"
  | "episodes"
  | "aspect";

/** Where remote focus is: the center button (seek/play keys) or the row. */
export type TvFocusZone = "center" | "buttons";

export const fmtTvTime = (seconds: number) => {
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
  onFocus,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  onPress: () => void;
  onFocus: () => void;
}) {
  return (
    <Focusable
      style={styles.button}
      focusedStyle={styles.buttonFocused}
      onPress={onPress}
      onFocus={onFocus}
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

/** Big round Play/Pause in the middle; keeps focus on Left/Right/Up. */
function CenterButton({
  paused,
  color,
  onPress,
  onFocus,
}: {
  paused: boolean;
  color: string;
  onPress: () => void;
  onFocus: () => void;
}) {
  const ref = useRef<View | null>(null);
  const [self, setSelf] = useState<number | undefined>(undefined);
  useEffect(() => {
    const handle = findNodeHandle(ref.current);
    if (handle != null) setSelf(handle);
  }, []);
  return (
    <View style={styles.centerWrap} pointerEvents="box-none">
      <Focusable
        ref={ref}
        hasTVPreferredFocus
        ring={false}
        nextFocusLeft={self}
        nextFocusRight={self}
        nextFocusUp={self}
        style={styles.center}
        focusedStyle={[styles.centerFocused, { borderColor: color }]}
        onPress={onPress}
        // Holding OK is 2x speed (handled by the overlay's remote listener);
        // a long-press handler stops the release from also toggling play.
        onLongPress={() => {}}
        onFocus={onFocus}
        accessibilityLabel={paused ? "Play" : "Pause"}
      >
        <MaterialCommunityIcons name={paused ? "play" : "pause"} size={44} color="#fff" />
      </Focusable>
    </View>
  );
}

export default function TvPlayerControls({
  title,
  subtitle,
  paused,
  currentTime,
  duration,
  buffered,
  scrubTarget,
  qualityLabel,
  serverLabel,
  fitLabel,
  onTogglePlay,
  onSeekBy,
  onOpenPanel,
  hasEpisodes,
  hasSources,
  onNextEpisode,
  onRestart,
  onZoneChange,
}: {
  title: string;
  subtitle?: string;
  paused: boolean;
  currentTime: number;
  duration: number;
  buffered: number;
  /** Pending seek position being previewed (null when not seeking). */
  scrubTarget: number | null;
  qualityLabel?: string;
  serverLabel?: string;
  fitLabel?: string;
  onTogglePlay: () => void;
  onSeekBy: (seconds: number) => void;
  onOpenPanel: (panel: TvPanel) => void;
  hasEpisodes: boolean;
  hasSources: boolean;
  onNextEpisode?: () => void;
  onRestart: () => void;
  onZoneChange: (zone: TvFocusZone) => void;
}) {
  const primaryColor = useThemeStore((s) => s.primaryColor);
  const shown = scrubTarget ?? currentTime;
  const progress = duration > 0 ? Math.min(1, shown / duration) : 0;
  const played = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  const loaded = duration > 0 ? Math.min(1, buffered / duration) : 0;
  const toButtons = () => onZoneChange("buttons");

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

      <CenterButton
        paused={paused}
        color={primaryColor}
        onPress={onTogglePlay}
        onFocus={() => onZoneChange("center")}
      />

      <LinearGradient colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.85)"]} style={styles.bottom}>
        <View style={styles.timeRow}>
          <Text style={styles.time}>{fmtTvTime(shown)}</Text>
          <View style={styles.trackWrap}>
            <View style={[styles.track, scrubTarget != null && styles.trackActive]}>
              <View style={[styles.loaded, { width: `${loaded * 100}%` }]} />
              <View
                style={[
                  styles.played,
                  { width: `${(scrubTarget != null ? played : progress) * 100}%`, backgroundColor: primaryColor },
                ]}
              />
              <View style={[styles.thumb, { left: `${progress * 100}%`, borderColor: primaryColor }]} />
            </View>
          </View>
          <Text style={styles.time}>{fmtTvTime(duration)}</Text>
        </View>
        <View style={styles.buttons}>
          <Button icon="restart" label="Restart" onPress={onRestart} onFocus={toButtons} />
          <Button icon="rewind-10" label="Back 10s" onPress={() => onSeekBy(-10)} onFocus={toButtons} />
          <Button
            icon={paused ? "play" : "pause"}
            label={paused ? "Play" : "Pause"}
            onPress={onTogglePlay}
            onFocus={toButtons}
          />
          <Button icon="fast-forward-10" label="Forward 10s" onPress={() => onSeekBy(10)} onFocus={toButtons} />
          {onNextEpisode ? (
            <Button icon="skip-next" label="Next episode" onPress={onNextEpisode} onFocus={toButtons} />
          ) : null}
          <View style={styles.spacer} />
          <Button icon="translate" label="Audio" onPress={() => onOpenPanel("audio")} onFocus={toButtons} />
          <Button
            icon="subtitles-outline"
            label="Subtitles"
            onPress={() => onOpenPanel("subtitle")}
            onFocus={toButtons}
          />
          <Button
            icon="high-definition-box"
            label={qualityLabel ? `Quality · ${qualityLabel}` : "Quality"}
            onPress={() => onOpenPanel("quality")}
            onFocus={toButtons}
          />
          <Button
            icon="fit-to-screen-outline"
            label={fitLabel ? `Screen fit · ${fitLabel}` : "Screen fit"}
            onPress={() => onOpenPanel("aspect")}
            onFocus={toButtons}
          />
          <Button
            icon="server-network"
            label={serverLabel ? `Server · ${serverLabel}` : "Server"}
            onPress={() => onOpenPanel("server")}
            onFocus={toButtons}
          />
          {hasSources ? (
            <Button
              icon="playlist-play"
              label="Sources"
              onPress={() => onOpenPanel("sources")}
              onFocus={toButtons}
            />
          ) : null}
          {hasEpisodes ? (
            <Button
              icon="format-list-numbered"
              label="Episodes"
              onPress={() => onOpenPanel("episodes")}
              onFocus={toButtons}
            />
          ) : null}
        </View>
        <Text style={styles.hint}>
          ◀ ▶ seek (hold to go faster) · OK play/pause · hold OK for 2x · ▼ more options
        </Text>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { position: "absolute", top: 0, left: 0, right: 0, paddingHorizontal: 32, paddingTop: 22, paddingBottom: 40 },
  title: { color: "#fff", fontSize: 20, fontWeight: "800" },
  subtitle: { color: "rgba(255,255,255,0.75)", fontSize: 13, marginTop: 4 },
  centerWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.35)",
  },
  centerFocused: { backgroundColor: "rgba(0,0,0,0.65)", transform: [{ scale: 1.08 }] },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 32, paddingTop: 40, paddingBottom: 18 },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  time: { color: "#fff", fontSize: 13, fontVariant: ["tabular-nums"], minWidth: 56, textAlign: "center" },
  trackWrap: { flex: 1, paddingVertical: 8 },
  track: { height: 5, backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 3 },
  trackActive: { height: 8, borderRadius: 4 },
  thumb: {
    position: "absolute",
    top: -6,
    width: 18,
    height: 18,
    marginLeft: -9,
    borderRadius: 9,
    backgroundColor: "#fff",
    borderWidth: 3,
  },
  loaded: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.35)" },
  played: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 4 },
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
