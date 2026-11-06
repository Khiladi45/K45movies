import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { YT } from "../theme";
import type { YtQuality } from "../types";
import YtSheet from "./YtSheet";

export const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
export type Caption = { title: string; language: string; uri: string; type?: string };
export type SettingsPage = "root" | "quality" | "speed" | "captions";

type Props = {
  visible: boolean;
  page: SettingsPage;
  onClose: () => void;
  qualities: YtQuality[];
  /** 0 = Auto. */
  height: number;
  /** Height the player is showing right now, for "Auto (720p)". */
  playingHeight: number;
  canPickQuality: boolean;
  onHeight: (h: number) => void;
  speed: number;
  onSpeed: (s: number) => void;
  captions: Caption[];
  caption: number; // -1 = off
  onCaption: (i: number) => void;
  onLock: () => void;
};

type IconName = React.ComponentProps<typeof Ionicons>["name"];

function Row({
  icon,
  label,
  value,
  onPress,
  chevron = true,
}: {
  icon: IconName;
  label: string;
  value?: string;
  onPress: () => void;
  chevron?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} accessibilityRole="button">
      <Ionicons name={icon} size={24} color={YT.text} />
      <Text style={styles.label}>{label}</Text>
      {value ? <Text style={styles.value}>{value}</Text> : null}
      {chevron ? <Ionicons name="chevron-forward" size={18} color={YT.text} /> : null}
    </TouchableOpacity>
  );
}

function Choice({ label, selected, onPress, hint }: { label: string; selected: boolean; onPress: () => void; hint?: string }) {
  return (
    <TouchableOpacity style={styles.choice} onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected }}>
      <View style={styles.tick}>{selected ? <Ionicons name="checkmark" size={20} color={YT.text} /> : null}</View>
      <Text style={[styles.label, selected && { fontWeight: "700" }]}>{label}</Text>
      {hint ? <Text style={styles.value}>{hint}</Text> : null}
    </TouchableOpacity>
  );
}

/** The player's gear menu: Quality, Playback speed, Captions, Lock screen. */
export default function PlayerSettings(p: Props) {
  const [page, setPage] = useState<SettingsPage>(p.page);
  useEffect(() => {
    if (p.visible) setPage(p.page);
  }, [p.visible, p.page]);

  const qualityValue =
    p.height === 0
      ? p.playingHeight > 0
        ? `Auto (${p.playingHeight}p)`
        : "Auto"
      : `${p.height}p`;
  const captionValue = p.caption >= 0 ? p.captions[p.caption]?.title : "Off";

  return (
    <YtSheet visible={p.visible} onClose={p.onClose}>
      {page === "root" ? (
        <View style={{ paddingVertical: 6 }}>
          <Row icon="options-outline" label="Quality" value={qualityValue} onPress={() => setPage("quality")} />
          <Row
            icon="speedometer-outline"
            label="Playback speed"
            value={p.speed === 1 ? "1x" : `${p.speed}x`}
            onPress={() => setPage("speed")}
          />
          <Row icon="text-outline" label="Captions" value={p.captions.length ? captionValue : undefined} onPress={() => setPage("captions")} />
          <Row
            icon="lock-closed-outline"
            label="Lock screen"
            chevron={false}
            onPress={() => {
              p.onClose();
              p.onLock();
            }}
          />
        </View>
      ) : (
        <View>
          <TouchableOpacity style={styles.back} onPress={() => setPage("root")} accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={22} color={YT.text} />
            <Text style={styles.backText}>
              {page === "quality" ? "Quality" : page === "speed" ? "Playback speed" : "Captions"}
            </Text>
          </TouchableOpacity>
          <ScrollView showsHorizontalScrollIndicator={false} style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
            {page === "quality" ? (
              <>
                <Choice
                  label="Auto"
                  hint={p.playingHeight > 0 ? `${p.playingHeight}p` : "Recommended"}
                  selected={p.height === 0}
                  onPress={() => {
                    p.onHeight(0);
                    p.onClose();
                  }}
                />
                {p.qualities.map((q) => (
                  <Choice
                    key={q.height}
                    label={q.label}
                    selected={p.height === q.height}
                    onPress={() => {
                      p.onHeight(q.height);
                      p.onClose();
                    }}
                  />
                ))}
                {!p.canPickQuality ? (
                  <Text style={styles.note}>This video plays as a single file, so its quality can't be changed.</Text>
                ) : null}
              </>
            ) : null}
            {page === "speed"
              ? SPEEDS.map((s) => (
                  <Choice
                    key={s}
                    label={s === 1 ? "Normal" : `${s}x`}
                    selected={p.speed === s}
                    onPress={() => {
                      p.onSpeed(s);
                      p.onClose();
                    }}
                  />
                ))
              : null}
            {page === "captions" ? (
              <>
                <Choice
                  label="Off"
                  selected={p.caption < 0}
                  onPress={() => {
                    p.onCaption(-1);
                    p.onClose();
                  }}
                />
                {p.captions.map((c, i) => (
                  <Choice
                    key={`${c.language}-${i}`}
                    label={c.title}
                    selected={p.caption === i}
                    onPress={() => {
                      p.onCaption(i);
                      p.onClose();
                    }}
                  />
                ))}
                {p.captions.length === 0 ? <Text style={styles.note}>No captions for this video.</Text> : null}
              </>
            ) : null}
          </ScrollView>
        </View>
      )}
    </YtSheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 18, paddingHorizontal: 20, height: 56 },
  label: { flex: 1, color: YT.text, fontSize: 16 },
  value: { color: YT.muted, fontSize: 14 },
  choice: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, height: 50 },
  tick: { width: 24, alignItems: "center" },
  back: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, height: 52, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#3a3a3a" },
  backText: { color: YT.text, fontSize: 16, fontWeight: "700" },
  note: { color: YT.muted, fontSize: 13, paddingHorizontal: 20, paddingVertical: 12 },
});
