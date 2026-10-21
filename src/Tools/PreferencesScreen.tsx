import React from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Directory } from "expo-file-system";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeStore } from "@/store/useThemeStore";
import {
  DefaultQuality,
  DownloadQuality,
  usePreferencesStore,
} from "@/store/usePreferencesStore";
import {
  SUBTITLE_ALIGNS,
  SUBTITLE_BACKGROUNDS,
  SUBTITLE_FONTS,
  SUBTITLE_LANGUAGES,
  SUBTITLE_TEXT_COLORS,
  SUBTITLE_WEIGHTS,
  subtitleTextStyle,
  SubtitleAlign,
  SubtitleFont,
  SubtitleWeight,
} from "@/lib/subtitles";

const withOpacity = (hex: string, opacity: string) => `${hex}${opacity}`;

const isLightColor = (hex: string) => {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) return false;
  const value = parseInt(match[1], 16);
  return (
    0.299 * ((value >> 16) & 255) +
      0.587 * ((value >> 8) & 255) +
      0.114 * (value & 255) >
    160
  );
};

type Option<T extends string | number> = { label: string; value: T };

function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  primaryColor,
}: {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  primaryColor: string;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <TouchableOpacity
            key={String(option.value)}
            style={[
              styles.segment,
              selected && {
                backgroundColor: withOpacity(primaryColor, "22"),
                borderColor: withOpacity(primaryColor, "77"),
              },
            ]}
            onPress={() => onChange(option.value)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.segmentText,
                selected && { color: primaryColor, fontWeight: "800" },
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function SwitchRow({
  icon,
  title,
  subtitle,
  value,
  onValueChange,
  primaryColor,
  isLast,
}: {
  icon: any;
  title: string;
  subtitle: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  primaryColor: string;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.row, isLast && styles.rowLast]}>
      <View style={[styles.iconBox, { backgroundColor: withOpacity(primaryColor, "1A") }]}>
        <Ionicons name={icon} size={20} color={primaryColor} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{
          false: "#2a2a2a",
          true: withOpacity(primaryColor, "88"),
        }}
        thumbColor={value ? primaryColor : "#9a9a9a"}
        ios_backgroundColor="#2a2a2a"
      />
    </View>
  );
}

function ChoiceRow<T extends string | number>({
  icon,
  title,
  subtitle,
  options,
  value,
  onChange,
  primaryColor,
  isLast,
}: {
  icon: any;
  title: string;
  subtitle?: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  primaryColor: string;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.choiceRow, isLast && styles.rowLast]}>
      <View style={styles.choiceHeader}>
        <View style={[styles.iconBox, { backgroundColor: withOpacity(primaryColor, "1A") }]}>
          <Ionicons name={icon} size={20} color={primaryColor} />
        </View>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>{title}</Text>
          {!!subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      <Segmented
        options={options}
        value={value}
        onChange={onChange}
        primaryColor={primaryColor}
      />
    </View>
  );
}

function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  primaryColor,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
  primaryColor: string;
}) {
  return (
    <View style={styles.chips}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.chip,
              selected && {
                borderColor: withOpacity(primaryColor, "88"),
                backgroundColor: withOpacity(primaryColor, "1F"),
              },
            ]}
            onPress={() => onChange(option.value)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.chipText,
                selected && { color: primaryColor, fontWeight: "800" },
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function ColorSwatchRow({
  icon,
  title,
  subtitle,
  colors,
  value,
  onChange,
  primaryColor,
}: {
  icon: any;
  title: string;
  subtitle: string;
  colors: string[];
  value: string;
  onChange: (value: string) => void;
  primaryColor: string;
}) {
  return (
    <View style={styles.choiceRow}>
      <View style={styles.choiceHeader}>
        <View
          style={[
            styles.iconBox,
            { backgroundColor: withOpacity(primaryColor, "1A") },
          ]}
        >
          <Ionicons name={icon} size={20} color={primaryColor} />
        </View>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>{title}</Text>
          <Text style={styles.rowSubtitle}>{subtitle}</Text>
        </View>
      </View>
      <View style={styles.swatches}>
        {colors.map((color) => {
          const selected = color.toLowerCase() === value.toLowerCase();
          return (
            <TouchableOpacity
              key={color}
              onPress={() => onChange(color)}
              activeOpacity={0.85}
              accessibilityLabel={`${title} ${color}`}
              style={[
                styles.swatch,
                { backgroundColor: color },
                selected && {
                  borderColor: primaryColor,
                  transform: [{ scale: 1.08 }],
                },
              ]}
            >
              {selected ? (
                <Ionicons
                  name="checkmark"
                  size={17}
                  color={isLightColor(color) ? "#111" : "#fff"}
                />
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function StepperRow({
  icon,
  title,
  subtitle,
  value,
  min,
  max,
  step,
  onChange,
  primaryColor,
}: {
  icon: any;
  title: string;
  subtitle: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  primaryColor: string;
}) {
  return (
    <View style={styles.row}>
      <View
        style={[
          styles.iconBox,
          { backgroundColor: withOpacity(primaryColor, "1A") },
        ]}
      >
        <Ionicons name={icon} size={20} color={primaryColor} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.stepper}>
        <TouchableOpacity
          style={styles.stepBtn}
          onPress={() => onChange(Math.max(min, value - step))}
          disabled={value <= min}
          accessibilityLabel={`Decrease ${title}`}
        >
          <Ionicons
            name="remove"
            size={18}
            color={value <= min ? "#444" : "#fff"}
          />
        </TouchableOpacity>
        <Text style={styles.stepValue}>{value}</Text>
        <TouchableOpacity
          style={styles.stepBtn}
          onPress={() => onChange(Math.min(max, value + step))}
          disabled={value >= max}
          accessibilityLabel={`Increase ${title}`}
        >
          <Ionicons
            name="add"
            size={18}
            color={value >= max ? "#444" : "#fff"}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}


const folderLabel = (uri: string): string => {
  try {
    const decoded = decodeURIComponent(uri);
    const last = decoded.split("/").filter(Boolean).pop() || decoded;
    return last.replace(/^primary:/i, "Internal storage › ").replace(/^[0-9a-f-]{20,}:/i, "");
  } catch {
    return "Selected folder";
  }
};

export default function PreferencesScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { primaryColor } = useThemeStore();
  const prefs = usePreferencesStore();

  const pickFolder = async () => {
    try {
      const dir = await Directory.pickDirectoryAsync();
      const probe = dir.createFile(
        `k45-write-test-${Date.now()}.txt`,
        "text/plain",
      );
      probe.write("ok");
      if (probe.exists) probe.delete();

      prefs.setPreference("downloadDirectoryUri", dir.uri);
      prefs.setPreference("downloadLocation", "custom");
    } catch (error: any) {
      const cancelled = /cancel/i.test(
        `${error?.code || ""} ${error?.message || ""}`,
      );
      if (cancelled) return;
      Alert.alert(
        "Folder unavailable",
        "K45movies could not write to that folder. Pick another folder or use app storage.",
      );
    }
  };

  const resetAll = () => {
    Alert.alert(
      "Reset preferences",
      "Restore every playback and download setting to its default value?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => prefs.resetPreferences(),
        },
      ],
    );
  };

  const customSelected =
    prefs.downloadLocation === "custom" &&
    !!prefs.downloadDirectoryUri;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Preferences</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 40 },
        ]}
      >
        <Text style={styles.sectionTitle}>PLAYBACK</Text>
        <View style={styles.card}>
          <SwitchRow
            icon="play-back-outline"
            title="Resume playback"
            subtitle="Continue from your last position"
            value={prefs.resumePlayback}
            onValueChange={(value) =>
              prefs.setPreference("resumePlayback", value)
            }
            primaryColor={primaryColor}
          />
          <ChoiceRow<DefaultQuality>
            icon="options-outline"
            title="Default quality"
            subtitle="Applied when a stream exposes multiple resolutions"
            options={[
              { label: "Auto", value: "auto" },
              { label: "Highest", value: "highest" },
              { label: "Lowest", value: "lowest" },
            ]}
            value={prefs.defaultQuality}
            onChange={(value) => prefs.setPreference("defaultQuality", value)}
            primaryColor={primaryColor}
          />
          <ChoiceRow<3 | 5 | 10>
            icon="timer-outline"
            title="Hide controls after"
            options={[
              { label: "3s", value: 3 },
              { label: "5s", value: 5 },
              { label: "10s", value: 10 },
            ]}
            value={prefs.controlsTimeout}
            onChange={(value) =>
              prefs.setPreference("controlsTimeout", value)
            }
            primaryColor={primaryColor}
          />
          <SwitchRow
            icon="hourglass-outline"
            title="Show remaining time"
            subtitle="Display time left instead of total duration"
            value={prefs.showRemainingTime}
            onValueChange={(value) =>
              prefs.setPreference("showRemainingTime", value)
            }
            primaryColor={primaryColor}
            isLast
          />
        </View>

        <Text style={styles.sectionTitle}>SUBTITLES</Text>
        <View style={styles.card}>
          <SwitchRow
            icon="subtitles-outline"
            title="Default subtitles"
            subtitle="Turn on a matching track when playback starts"
            value={prefs.autoSubtitles}
            onValueChange={(value) =>
              prefs.setPreference("autoSubtitles", value)
            }
            primaryColor={primaryColor}
          />
          <View style={styles.choiceRow}>
            <View style={styles.choiceHeader}>
              <View
                style={[
                  styles.iconBox,
                  { backgroundColor: withOpacity(primaryColor, "1A") },
                ]}
              >
                <Ionicons
                  name="language-outline"
                  size={20}
                  color={primaryColor}
                />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Preferred language</Text>
                <Text style={styles.rowSubtitle}>
                  Chosen first when a stream offers several tracks
                </Text>
              </View>
            </View>
            <ChipGroup
              options={SUBTITLE_LANGUAGES}
              value={prefs.subtitleLanguage}
              onChange={(value) =>
                prefs.setPreference("subtitleLanguage", value)
              }
              primaryColor={primaryColor}
            />
          </View>
          <StepperRow
            icon="resize-outline"
            title="Text size"
            subtitle={`${prefs.subtitleSize}px`}
            value={prefs.subtitleSize}
            min={10}
            max={40}
            step={2}
            onChange={(value) => prefs.setPreference("subtitleSize", value)}
            primaryColor={primaryColor}
          />
          <ChoiceRow<SubtitleFont>
            icon="text-outline"
            title="Font"
            options={SUBTITLE_FONTS}
            value={prefs.subtitleFont}
            onChange={(value) => prefs.setPreference("subtitleFont", value)}
            primaryColor={primaryColor}
          />
          <ChoiceRow<SubtitleWeight>
            icon="text"
            title="Weight"
            options={SUBTITLE_WEIGHTS}
            value={prefs.subtitleWeight}
            onChange={(value) => prefs.setPreference("subtitleWeight", value)}
            primaryColor={primaryColor}
          />
          <ColorSwatchRow
            icon="color-palette-outline"
            title="Text color"
            subtitle="Pick a color that stays readable on dark scenes"
            colors={SUBTITLE_TEXT_COLORS}
            value={prefs.subtitleColor}
            onChange={(value) => prefs.setPreference("subtitleColor", value)}
            primaryColor={primaryColor}
          />
          <ColorSwatchRow
            icon="albums-outline"
            title="Background color"
            subtitle="Shown behind the caption text"
            colors={SUBTITLE_BACKGROUNDS}
            value={prefs.subtitleBackground}
            onChange={(value) =>
              prefs.setPreference("subtitleBackground", value)
            }
            primaryColor={primaryColor}
          />
          <StepperRow
            icon="water-outline"
            title="Background opacity"
            subtitle={`${Math.round(prefs.subtitleBackgroundOpacity * 100)}% · 0 hides the background`}
            value={Math.round(prefs.subtitleBackgroundOpacity * 100)}
            min={0}
            max={100}
            step={5}
            onChange={(value) =>
              prefs.setPreference("subtitleBackgroundOpacity", value / 100)
            }
            primaryColor={primaryColor}
          />
          <ChoiceRow<0 | 2 | 4>
            icon="happy-outline"
            title="Outline / shadow"
            options={[
              { label: "Off", value: 0 },
              { label: "Soft", value: 2 },
              { label: "Strong", value: 4 },
            ]}
            value={prefs.subtitleShadow as 0 | 2 | 4}
            onChange={(value) => prefs.setPreference("subtitleShadow", value)}
            primaryColor={primaryColor}
          />
          <StepperRow
            icon="arrow-up-outline"
            title="Position"
            subtitle={`${prefs.subtitleBottom}px above the bottom edge`}
            value={prefs.subtitleBottom}
            min={8}
            max={160}
            step={8}
            onChange={(value) => prefs.setPreference("subtitleBottom", value)}
            primaryColor={primaryColor}
          />
          <ChoiceRow<SubtitleAlign>
            icon="reorder-three-outline"
            title="Alignment"
            options={SUBTITLE_ALIGNS}
            value={prefs.subtitleAlign}
            onChange={(value) => prefs.setPreference("subtitleAlign", value)}
            primaryColor={primaryColor}
          />

          <View style={styles.previewRow}>
            <View style={styles.previewStage}>
              <View style={styles.previewFrameLines} />
              <Text style={styles.previewWatermark}>K45 CINEMA</Text>
              <View
                style={[
                  styles.previewCaptionWrap,
                  {
                    bottom: Math.min(150, prefs.subtitleBottom),
                    alignItems:
                      prefs.subtitleAlign === "left"
                        ? "flex-start"
                        : prefs.subtitleAlign === "right"
                          ? "flex-end"
                          : "center",
                  },
                ]}
              >
                <Text
                  style={[
                    subtitleTextStyle(prefs, 0.95),
                    { maxWidth: "92%" },
                  ]}
                >
                  This is how your subtitles will look.
                </Text>
              </View>
            </View>
            <Text style={styles.previewHint}>
              Live preview. External subtitle tracks use every option above;
              embedded tracks only apply size and position in the native
              player.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.resetInline}
            onPress={() => prefs.resetSubtitleStyle()}
          >
            <Ionicons name="refresh-outline" size={17} color="#ef4444" />
            <Text style={styles.resetInlineText}>Reset subtitle appearance</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>DOWNLOADS</Text>
        <View style={styles.card}>
          <ChoiceRow<DownloadQuality>
            icon="layers-outline"
            title="Download quality"
            subtitle="Selects the HLS variant when the provider offers one"
            options={[
              { label: "Best available", value: "best" },
              { label: "Smallest file", value: "smallest" },
            ]}
            value={prefs.downloadQuality}
            onChange={(value) =>
              prefs.setPreference("downloadQuality", value)
            }
            primaryColor={primaryColor}
          />

          <View style={styles.choiceRow}>
            <View style={styles.choiceHeader}>
              <View
                style={[
                  styles.iconBox,
                  { backgroundColor: withOpacity(primaryColor, "1A") },
                ]}
              >
                <Ionicons name="folder-outline" size={20} color={primaryColor} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Download location</Text>
                <Text style={styles.rowSubtitle}>
                  {customSelected && prefs.downloadDirectoryUri
                    ? folderLabel(prefs.downloadDirectoryUri)
                    : "Private app storage"}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.locationOption,
                !customSelected && {
                  borderColor: withOpacity(primaryColor, "77"),
                  backgroundColor: withOpacity(primaryColor, "12"),
                },
              ]}
              onPress={() => prefs.setPreference("downloadLocation", "app")}
            >
              <Ionicons
                name={!customSelected ? "radio-button-on" : "radio-button-off"}
                size={20}
                color={!customSelected ? primaryColor : "#777"}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.locationTitle}>App storage</Text>
                <Text style={styles.locationHint}>
                  Always available, playable inside K45movies
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.locationOption,
                customSelected && {
                  borderColor: withOpacity(primaryColor, "77"),
                  backgroundColor: withOpacity(primaryColor, "12"),
                },
              ]}
              onPress={pickFolder}
            >
              <Ionicons
                name={customSelected ? "radio-button-on" : "radio-button-off"}
                size={20}
                color={customSelected ? primaryColor : "#777"}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.locationTitle}>Choose folder</Text>
                <Text style={styles.locationHint}>
                  {customSelected && prefs.downloadDirectoryUri
                    ? prefs.downloadDirectoryUri
                    : "Save into a folder on this device"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#777" />
            </TouchableOpacity>
          </View>

          <SwitchRow
            icon="wifi-outline"
            title="Wi-Fi only downloads"
            subtitle="Block downloads on mobile data"
            value={prefs.wifiOnlyDownloads}
            onValueChange={(value) =>
              prefs.setPreference("wifiOnlyDownloads", value)
            }
            primaryColor={primaryColor}
            isLast
          />
        </View>

        <View style={styles.noteCard}>
          <Ionicons name="shield-checkmark-outline" size={18} color="#9ca3af" />
          <Text style={styles.noteText}>
            Downloads are stored on this device only. DRM-protected, encrypted
            (AES), live, and separate-audio HLS streams are rejected rather
            than saved broken.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>PROVIDERS</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={[styles.row, styles.rowLast]}
            onPress={() => navigation.navigate("ProviderDiagnostics")}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.iconBox,
                { backgroundColor: withOpacity(primaryColor, "1A") },
              ]}
            >
              <Ionicons name="pulse-outline" size={20} color={primaryColor} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Provider diagnostics</Text>
              <Text style={styles.rowSubtitle}>
                Test init, search, metadata, streams and subtitles
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#777" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.manageBtn, { borderColor: withOpacity(primaryColor, "55") }]}
          onPress={() => navigation.navigate("Downloads")}
        >
          <Ionicons name="download-outline" size={18} color={primaryColor} />
          <Text style={[styles.manageBtnText, { color: primaryColor }]}>
            Manage downloads
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.resetBtn} onPress={resetAll}>
          <Ionicons name="refresh-outline" size={18} color="#ef4444" />
          <Text style={styles.resetText}>Reset all preferences</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#141414" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  backBtn: { padding: 4, width: 34 },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },

  content: { paddingHorizontal: 16, paddingTop: 6 },
  sectionTitle: {
    color: "#8a8a8a",
    fontSize: 11.5,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginTop: 18,
    marginBottom: 10,
    marginLeft: 4,
  },
  card: {
    backgroundColor: "#0a0a0a",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#1d1d1d",
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
  },
  rowLast: { borderBottomWidth: 0 },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1 },
  rowTitle: { color: "#fff", fontSize: 14.5, fontWeight: "700" },
  rowSubtitle: { color: "#7d7d7d", fontSize: 12, marginTop: 3, lineHeight: 16 },

  choiceRow: {
    padding: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
  },
  choiceHeader: { flexDirection: "row", alignItems: "center", gap: 12 },

  segmented: {
    flexDirection: "row",
    backgroundColor: "#151515",
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "transparent",
  },
  segmentText: { color: "#9a9a9a", fontSize: 12.5, fontWeight: "600" },

  stepper: { flexDirection: "row", alignItems: "center", gap: 4 },
  stepBtn: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: "#1d1d1d",
    alignItems: "center",
    justifyContent: "center",
  },
  stepValue: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    minWidth: 30,
    textAlign: "center",
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#262626",
    backgroundColor: "#151515",
  },
  chipText: { color: "#9a9a9a", fontSize: 12.5, fontWeight: "600" },

  swatches: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "#333",
    alignItems: "center",
    justifyContent: "center",
  },

  previewRow: {
    padding: 14,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
  },
  previewStage: {
    height: 210,
    borderRadius: 14,
    backgroundColor: "#0b0b0d",
    borderWidth: 1,
    borderColor: "#1e1e22",
    overflow: "hidden",
  },
  previewFrameLines: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 62,
    bottom: 62,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  previewWatermark: {
    position: "absolute",
    top: 14,
    left: 16,
    color: "rgba(255,255,255,0.16)",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.8,
  },
  previewCaptionWrap: {
    position: "absolute",
    left: 14,
    right: 14,
  },
  previewHint: { color: "#7d7d7d", fontSize: 11.5, lineHeight: 16 },

  resetInline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 13,
  },
  resetInlineText: { color: "#ef4444", fontSize: 12.5, fontWeight: "700" },

  locationOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#222",
    backgroundColor: "#111",
  },
  locationTitle: { color: "#fff", fontSize: 13.5, fontWeight: "700" },
  locationHint: {
    color: "#777",
    fontSize: 11.5,
    marginTop: 2,
    lineHeight: 15,
  },

  noteCard: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    marginTop: 16,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#222",
    backgroundColor: "#0e0e0e",
  },
  noteText: { flex: 1, color: "#8a8a8a", fontSize: 12, lineHeight: 17 },

  manageBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 18,
    paddingVertical: 13,
    borderRadius: 13,
    borderWidth: 1,
  },
  manageBtnText: { fontSize: 13.5, fontWeight: "800" },

  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
    paddingVertical: 13,
  },
  resetText: { color: "#ef4444", fontSize: 13.5, fontWeight: "700" },
});
