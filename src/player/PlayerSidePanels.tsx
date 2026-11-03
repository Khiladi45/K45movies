import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  SUBTITLE_ALIGNS,
  SUBTITLE_BACKGROUNDS,
  SUBTITLE_FONTS,
  SUBTITLE_TEXT_COLORS,
  SUBTITLE_WEIGHTS,
  subtitleTextStyle,
} from "@/lib/subtitles";
import { episodeLabel } from "@/lib/episodes";
import { usePreferencesStore } from "@/store/usePreferencesStore";
import type { PlayerEpisode } from "@/store/usePlayerStore";
import type { SourceOption } from "@/lib/titleBridge";

const ACCENT = "#ffffff";

/**
 * Right-side slide-out container used by the player. The area to the left of
 * the panel is a transparent dismiss target, so the video stays visible (and
 * subtitle changes can be judged live) while the panel is open.
 */
export function SidePanel({
  title,
  width,
  onClose,
  children,
}: {
  title: string;
  width: number;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const slide = useRef(new Animated.Value(width)).current;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [slide]);

  return (
    <View style={styles.backdrop} pointerEvents="box-none">
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <Animated.View
        style={[styles.panel, { width, transform: [{ translateX: slide }] }]}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Close panel"
          >
            <MaterialCommunityIcons name="close" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
        {children}
      </Animated.View>
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function Swatches({
  colors,
  value,
  onChange,
}: {
  colors: string[];
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {colors.map((color) => (
        <TouchableOpacity
          key={color}
          onPress={() => onChange(color)}
          style={[
            styles.swatch,
            { backgroundColor: color },
            value.toLowerCase() === color.toLowerCase() && styles.swatchActive,
          ]}
        />
      ))}
    </View>
  );
}

function Stepper({
  value,
  label,
  onMinus,
  onPlus,
}: {
  value: string;
  label: string;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControls}>
        <TouchableOpacity style={styles.stepBtn} onPress={onMinus}>
          <MaterialCommunityIcons name="minus" size={18} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.stepValue}>{value}</Text>
        <TouchableOpacity style={styles.stepBtn} onPress={onPlus}>
          <MaterialCommunityIcons name="plus" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const Label = ({ children }: { children: string }) => (
  <Text style={styles.sectionLabel}>{children}</Text>
);

const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n));

/** Every change writes straight to the preferences store, which the player's
 * subtitle overlay reads live, so edits show on screen immediately. */
export function SubtitleSettingsPanel({
  width,
  onClose,
}: {
  width: number;
  onClose: () => void;
}) {
  const prefs = usePreferencesStore();
  const set = prefs.setPreference;

  return (
    <SidePanel title="Subtitle Settings" width={width} onClose={onClose}>
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.previewWrap}>
          <Text style={subtitleTextStyle(prefs, 0.9)}>
            This is how subtitles look
          </Text>
        </View>

        <Stepper
          label="Size"
          value={`${prefs.subtitleSize}`}
          onMinus={() => set("subtitleSize", clamp(prefs.subtitleSize - 1, 10, 40))}
          onPlus={() => set("subtitleSize", clamp(prefs.subtitleSize + 1, 10, 40))}
        />

        <Label>Font</Label>
        <View style={styles.chipRow}>
          {SUBTITLE_FONTS.map((item) => (
            <Chip
              key={item.value}
              label={item.label}
              active={prefs.subtitleFont === item.value}
              onPress={() => set("subtitleFont", item.value)}
            />
          ))}
        </View>

        <Label>Weight</Label>
        <View style={styles.chipRow}>
          {SUBTITLE_WEIGHTS.map((item) => (
            <Chip
              key={item.value}
              label={item.label}
              active={prefs.subtitleWeight === item.value}
              onPress={() => set("subtitleWeight", item.value)}
            />
          ))}
        </View>

        <Label>Text color</Label>
        <Swatches
          colors={SUBTITLE_TEXT_COLORS}
          value={prefs.subtitleColor}
          onChange={(color) => set("subtitleColor", color)}
        />

        <Label>Background color</Label>
        <Swatches
          colors={SUBTITLE_BACKGROUNDS}
          value={prefs.subtitleBackground}
          onChange={(color) => set("subtitleBackground", color)}
        />

        <Stepper
          label="Background opacity"
          value={`${Math.round(prefs.subtitleBackgroundOpacity * 100)}%`}
          onMinus={() =>
            set(
              "subtitleBackgroundOpacity",
              clamp(Math.round((prefs.subtitleBackgroundOpacity - 0.1) * 10) / 10, 0, 1),
            )
          }
          onPlus={() =>
            set(
              "subtitleBackgroundOpacity",
              clamp(Math.round((prefs.subtitleBackgroundOpacity + 0.1) * 10) / 10, 0, 1),
            )
          }
        />

        <Label>Shadow</Label>
        <View style={styles.chipRow}>
          {[
            { label: "Off", value: 0 },
            { label: "Soft", value: 2 },
            { label: "Strong", value: 4 },
          ].map((item) => (
            <Chip
              key={item.value}
              label={item.label}
              active={prefs.subtitleShadow === item.value}
              onPress={() => set("subtitleShadow", item.value)}
            />
          ))}
        </View>

        <Label>Alignment</Label>
        <View style={styles.chipRow}>
          {SUBTITLE_ALIGNS.map((item) => (
            <Chip
              key={item.value}
              label={item.label}
              active={prefs.subtitleAlign === item.value}
              onPress={() => set("subtitleAlign", item.value)}
            />
          ))}
        </View>

        <Stepper
          label="Distance from bottom"
          value={`${prefs.subtitleBottom}`}
          onMinus={() => set("subtitleBottom", clamp(prefs.subtitleBottom - 10, 0, 320))}
          onPlus={() => set("subtitleBottom", clamp(prefs.subtitleBottom + 10, 0, 320))}
        />

        <TouchableOpacity style={styles.reset} onPress={prefs.resetSubtitleStyle}>
          <MaterialCommunityIcons name="restore" size={16} color="#fff" />
          <Text style={styles.resetText}>Reset to default</Text>
        </TouchableOpacity>
      </ScrollView>
    </SidePanel>
  );
}

/** Episode list for the series that is playing; picking one switches the
 * stream in place (the caller keeps the player open). */
export function EpisodesPanel({
  width,
  episodes,
  currentLink,
  currentNumber,
  onSelect,
  onClose,
}: {
  width: number;
  episodes: PlayerEpisode[];
  currentLink?: string;
  currentNumber?: number | null;
  onSelect: (episode: PlayerEpisode) => void;
  onClose: () => void;
}) {
  const listRef = useRef<FlatList<PlayerEpisode>>(null);
  const isCurrent = (ep: PlayerEpisode) =>
    ep.link === currentLink ||
    (currentNumber != null && ep.number === currentNumber && !currentLink);
  const currentIndex = Math.max(0, episodes.findIndex(isCurrent));

  return (
    <SidePanel title="Episodes" width={width} onClose={onClose}>
      <FlatList
        ref={listRef}
        data={episodes}
        keyExtractor={(ep, i) => `${ep.link}-${i}`}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        initialScrollIndex={currentIndex > 2 ? currentIndex - 2 : 0}
        getItemLayout={(_d, index) => ({ length: 62, offset: 62 * index, index })}
        renderItem={({ item, index }) => {
          const active = isCurrent(item);
          return (
            <TouchableOpacity
              style={[styles.episode, active && styles.episodeActive]}
              onPress={() => (active ? onClose() : onSelect(item))}
            >
              <View style={styles.episodeNumber}>
                {active ? (
                  <MaterialCommunityIcons name="play" size={18} color="#fff" />
                ) : (
                  <Text style={styles.episodeNumberText}>
                    {item.number ?? index + 1}
                  </Text>
                )}
              </View>
              <Text style={styles.episodeTitle} numberOfLines={2}>
                {item.title && item.title !== episodeLabel(item, index)
                  ? item.title
                  : episodeLabel(item, index)}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    </SidePanel>
  );
}


/** Every provider row for the current title (Movie Based layout). Picking one
 * switches the stream in place, keeping the playback position. */
export function SourcesPanel({
  width,
  options,
  names,
  currentId,
  failed,
  unchecked,
  onSelect,
  onClose,
}: {
  width: number;
  options: SourceOption[];
  names: Record<string, string>;
  currentId: string | null;
  failed: string[];
  unchecked: number;
  onSelect: (option: SourceOption) => void;
  onClose: () => void;
}) {
  const groups: { providerId: string; rows: SourceOption[] }[] = [];
  options.forEach((option) => {
    let group = groups.find((g) => g.providerId === option.providerId);
    if (!group) {
      group = { providerId: option.providerId, rows: [] };
      groups.push(group);
    }
    group.rows.push(option);
  });

  return (
    <SidePanel title="Providers & Qualities" width={width} onClose={onClose}>
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        {groups.map((group) => (
          <View key={group.providerId}>
            <Text style={styles.sectionLabel}>
              {names[group.providerId] || group.providerId}
            </Text>
            {group.rows.map((option) => {
              const active = option.id === currentId;
              const dead = failed.includes(option.id);
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.episode,
                    { height: undefined, minHeight: 56, paddingVertical: 8 },
                    active && styles.episodeActive,
                    dead && { opacity: 0.45 },
                  ]}
                  onPress={() => (active ? onClose() : onSelect(option))}
                >
                  <View style={styles.episodeNumber}>
                    {active ? (
                      <MaterialCommunityIcons name="play" size={18} color="#fff" />
                    ) : dead ? (
                      <MaterialCommunityIcons name="close" size={16} color="#f87171" />
                    ) : (
                      <Text style={styles.episodeNumberText}>
                        {option.height ? `${option.height}` : "HD"}
                      </Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.episodeTitle} numberOfLines={2}>
                      {option.label}
                    </Text>
                    <Text style={styles.sourceMeta} numberOfLines={1}>
                      {[
                        option.sizeText,
                        option.multiAudio ? "Multi audio" : "",
                        dead ? "Failed" : "",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
        {unchecked > 0 ? (
          <Text style={styles.note}>
            {unchecked} more provider{unchecked === 1 ? "" : "s"} will be
            checked after you close the player.
          </Text>
        ) : null}
      </ScrollView>
    </SidePanel>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
  },
  panel: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(10,10,10,0.82)",
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: "rgba(255,255,255,0.18)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  title: { color: "#fff", fontSize: 16, fontWeight: "800" },
  body: { paddingHorizontal: 16, paddingBottom: 24 },
  previewWrap: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  sectionLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginTop: 14,
    marginBottom: 8,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  chipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  chipText: { color: "#fff", fontSize: 12.5, fontWeight: "600" },
  chipTextActive: { color: "#000" },
  swatch: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.25)",
  },
  swatchActive: { borderColor: "#fff", transform: [{ scale: 1.12 }] },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
  },
  stepperLabel: { color: "#fff", fontSize: 13, fontWeight: "600", flexShrink: 1 },
  stepperControls: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  stepValue: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    minWidth: 40,
    textAlign: "center",
  },
  reset: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  resetText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  episode: {
    height: 56,
    marginBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  episodeActive: { backgroundColor: "rgba(255,255,255,0.22)" },
  episodeNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  episodeNumberText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  sourceMeta: { color: "rgba(255,255,255,0.55)", fontSize: 11.5, marginTop: 2 },
  note: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    marginTop: 14,
    lineHeight: 17,
  },
  episodeTitle: { flex: 1, color: "#fff", fontSize: 13.5, fontWeight: "600" },
});
