// Full-screen remote controls for the TV YouTube watch page. Drives YtPlayer
// (controls="none") through its optional handle methods and reads its state
// from a bus, so only this layer re-renders on the 500 ms progress updates.
//
// Remote: OK = play/pause, ◀ ▶ = preview seek (held = keeps moving, faster
// after a while), OK held = 2x while held, ▲▼ / any key = show controls.
import React, { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { Pressable, StyleSheet, Text, View, useTVEventHandler } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { YtPlayerHandle, YtPlayerState } from "@/YouTube/components/YtPlayer";
import { useThemeStore } from "@/store/useThemeStore";
import {
  SCRUB_COMMIT_MS,
  SCRUB_HOLD_INTERVAL_MS,
  nextScrubTarget,
  remoteAction,
} from "@/lib/tvScrub";
import Focusable from "../components/Focusable";
import { requestFocus } from "../focusMemory";
import { TV } from "../theme";
import { formatClock, progressOf } from "./ytWatch";

export type TvYtPanelKind = "quality" | "captions" | "speed" | "comments";

type Bus = {
  get: () => YtPlayerState | null;
  subscribe: (l: (v: YtPlayerState | null) => void) => () => void;
};

const HIDE_AFTER_MS = 4000;

export default function TvYtControls({
  player,
  bus,
  title,
  channel,
  hasNext,
  onNext,
  onPanel,
  panelOpen,
}: {
  player: RefObject<YtPlayerHandle | null>;
  bus: Bus;
  title: string;
  channel?: string;
  hasNext: boolean;
  onNext: () => void;
  onPanel: (kind: TvYtPanelKind) => void;
  panelOpen: boolean;
}) {
  const primaryColor = useThemeStore((s) => s.primaryColor);
  const [st, setSt] = useState<YtPlayerState | null>(bus.get());
  useEffect(() => bus.subscribe(setSt), [bus]);
  const stRef = useRef(st);
  stRef.current = st;

  const [visible, setVisible] = useState(true);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const [pending, setPendingState] = useState<number | null>(null);
  const pendingRef = useRef<number | null>(null);
  const setPending = (v: number | null) => {
    pendingRef.current = v;
    setPendingState(v);
  };
  const centerFocused = useRef(false);
  const centerRef = useRef<View | null>(null);
  const lastButton = useRef<RefObject<View | null> | null>(null);

  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const boostFrom = useRef<number | null>(null);
  const panelRef = useRef(panelOpen);
  panelRef.current = panelOpen;

  const scheduleHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      const s = stRef.current;
      if (panelRef.current || pendingRef.current != null || !s || s.paused) return;
      setVisible(false);
    }, HIDE_AFTER_MS);
  }, []);

  const wake = useCallback(() => {
    setVisible(true);
    scheduleHide();
  }, [scheduleHide]);

  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (commitTimer.current) clearTimeout(commitTimer.current);
      if (holdTimer.current) clearInterval(holdTimer.current);
    },
    [],
  );

  // Playback resumed: start the auto-hide countdown again.
  const paused = st?.paused ?? false;
  useEffect(() => {
    if (!paused && visibleRef.current) scheduleHide();
  }, [paused, scheduleHide]);

  // Panel closed: put focus back on the button that opened it.
  const wasOpen = useRef(panelOpen);
  useEffect(() => {
    if (wasOpen.current && !panelOpen) {
      setVisible(true);
      scheduleHide();
      setTimeout(() => {
        if (!requestFocus(lastButton.current ?? undefined)) requestFocus(centerRef);
      }, 60);
    }
    wasOpen.current = panelOpen;
  }, [panelOpen, scheduleHide]);

  const togglePlay = () => {
    const s = stRef.current;
    player.current?.setUserPaused?.(!(s?.paused ?? false));
  };
  const commit = () => {
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => {
      const target = pendingRef.current;
      if (target != null) player.current?.seekTo?.(target);
      setPending(null);
      scheduleHide();
    }, SCRUB_COMMIT_MS);
  };
  const step = (direction: 1 | -1, heldMs: number) => {
    const s = stRef.current;
    setPending(nextScrubTarget(pendingRef.current, s?.position ?? 0, direction, heldMs, s?.duration ?? 0));
    setVisible(true);
  };

  const onKey = useRef<(evt: any) => void>(() => {});
  onKey.current = (evt: any) => {
    if (!evt || panelRef.current) return;
    const scrubZone = !visibleRef.current || centerFocused.current;
    const action = remoteAction(evt.eventType, evt.eventKeyAction, scrubZone);
    switch (action.kind) {
      case "step":
        step(action.direction, 0);
        commit();
        return;
      case "holdStart": {
        if (holdTimer.current) clearInterval(holdTimer.current);
        if (commitTimer.current) clearTimeout(commitTimer.current);
        const started = Date.now();
        step(action.direction, 0);
        holdTimer.current = setInterval(() => step(action.direction, Date.now() - started), SCRUB_HOLD_INTERVAL_MS);
        return;
      }
      case "holdEnd":
        if (holdTimer.current) clearInterval(holdTimer.current);
        holdTimer.current = null;
        if (pendingRef.current != null) commit();
        return;
      case "boostStart":
        if (boostFrom.current == null) {
          boostFrom.current = stRef.current?.speed ?? 1;
          player.current?.setSpeed?.(2);
        }
        return;
      case "boostEnd":
        if (boostFrom.current != null) {
          player.current?.setSpeed?.(boostFrom.current);
          boostFrom.current = null;
        }
        return;
      case "togglePlay":
        togglePlay();
        wake();
        return;
      case "play":
        if (stRef.current?.paused) player.current?.setUserPaused?.(false);
        wake();
        return;
      case "pause":
        if (!stRef.current?.paused) player.current?.setUserPaused?.(true);
        wake();
        return;
      case "wake":
        wake();
        return;
      default:
        return;
    }
  };
  const handler = useCallback((evt: any) => onKey.current(evt), []);
  useTVEventHandler(handler);

  const qualityRef = useRef<View | null>(null);
  const captionsRef = useRef<View | null>(null);
  const speedRef = useRef<View | null>(null);
  const nextRef = useRef<View | null>(null);
  const commentsRef = useRef<View | null>(null);
  const open = (kind: TvYtPanelKind, ref: RefObject<View | null>) => {
    lastButton.current = ref;
    if (hideTimer.current) clearTimeout(hideTimer.current);
    onPanel(kind);
  };

  const position = pending ?? st?.position ?? 0;
  const duration = st?.duration ?? 0;
  const progress = progressOf(position, duration);

  if (!visible && !panelOpen) {
    // Hidden: one full-screen focus target so the remote keeps working.
    return (
      <Pressable
        focusable
        hasTVPreferredFocus
        style={StyleSheet.absoluteFill}
        onPress={() => {
          togglePlay();
          wake();
        }}
      />
    );
  }

  const button = (
    ref: RefObject<View | null>,
    icon: keyof typeof Ionicons.glyphMap,
    label: string,
    onPress: () => void,
  ) => (
    <Focusable
      ref={ref}
      style={styles.button}
      onPress={onPress}
      onFocus={() => {
        centerFocused.current = false;
        wake();
      }}
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={18} color="#fff" />
      <Text style={styles.buttonText}>{label}</Text>
    </Focusable>
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View style={styles.top} pointerEvents="none">
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {channel ? <Text style={styles.channel}>{channel}</Text> : null}
      </View>

      <View style={styles.center} pointerEvents="box-none">
        <Focusable
          ref={centerRef}
          hasTVPreferredFocus={!panelOpen}
          style={styles.play}
          onPress={() => {
            togglePlay();
            wake();
          }}
          onFocus={() => {
            centerFocused.current = true;
            wake();
          }}
          onBlur={() => {
            centerFocused.current = false;
          }}
          accessibilityLabel={paused ? "Play" : "Pause"}
        >
          <Ionicons name={paused ? "play" : "pause"} size={34} color="#fff" />
        </Focusable>
        {st?.buffering && !paused ? <Text style={styles.hint}>Buffering…</Text> : null}
        {st?.failed ? <Text style={styles.hint}>This video can't be played.</Text> : null}
      </View>

      <View style={styles.bottom}>
        <View style={styles.timeline}>
          <Text style={styles.time}>{formatClock(position)}</Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: primaryColor }]} />
            {pending != null ? <View style={[styles.knob, { left: `${progress * 100}%` }]} /> : null}
          </View>
          <Text style={styles.time}>{duration > 0 ? formatClock(duration) : "--:--"}</Text>
        </View>
        <View style={styles.row}>
          {(st?.qualities?.length ?? 0) > 0
            ? button(qualityRef, "settings-outline", st?.height ? `${st.height}p` : "Auto", () => open("quality", qualityRef))
            : null}
          {(st?.captions?.length ?? 0) > 0
            ? button(captionsRef, "text", (st?.caption ?? -1) >= 0 ? "CC on" : "CC", () => open("captions", captionsRef))
            : null}
          {button(speedRef, "speedometer-outline", `${st?.speed ?? 1}x`, () => open("speed", speedRef))}
          {hasNext ? button(nextRef, "play-skip-forward", "Next", onNext) : null}
          {button(commentsRef, "chatbubble-outline", "Comments", () => open("comments", commentsRef))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: TV.safeX,
    paddingTop: TV.safeY,
    paddingBottom: 24,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  title: { color: "#fff", fontSize: TV.text.title, fontWeight: "800" },
  channel: { color: TV.muted, fontSize: TV.text.body, marginTop: 2 },
  center: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", gap: 10 },
  play: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  hint: { color: "#fff", fontSize: TV.text.body, fontWeight: "600" },
  bottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: TV.safeX,
    paddingBottom: TV.safeY,
    paddingTop: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    gap: 12,
  },
  timeline: { flexDirection: "row", alignItems: "center", gap: 12 },
  time: { color: "#fff", fontSize: TV.text.small, fontWeight: "700", minWidth: 48, textAlign: "center" },
  track: { flex: 1, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.25)" },
  fill: { height: 4, borderRadius: 2 },
  knob: {
    position: "absolute",
    top: -5,
    width: 14,
    height: 14,
    marginLeft: -7,
    borderRadius: 7,
    backgroundColor: "#fff",
  },
  row: { flexDirection: "row", gap: 10 },
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    height: 36,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  buttonText: { color: "#fff", fontSize: TV.text.body, fontWeight: "700" },
});
