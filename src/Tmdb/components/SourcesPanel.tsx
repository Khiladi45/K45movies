import React from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Skeleton from "@/components/Skeleton";
import { useThemeStore } from "@/store/useThemeStore";
import { languageName } from "@/lib/languages";
import type { ProviderStatus } from "@/hooks/useTitleSources";
import type { SourceOption } from "@/lib/titleBridge";

type Props = {
  options: SourceOption[];
  providers: ProviderStatus[];
  loading: boolean;
  checkingAudio: boolean;
  preferredCode: string | null;
  noProviders: boolean;
  playingId: string | null;
  stage: string | null;
  onPlay: (option: SourceOption) => void;
  // Shown when every provider answered but nothing playable was found.
  emptyText?: string;
};

function StatusChip({ status }: { status: ProviderStatus }) {
  const busy = status.status === "searching" || status.status === "resolving";
  return (
    <View style={styles.chip}>
      {busy ? (
        <ActivityIndicator size="small" color="#9a9a9a" style={styles.chipSpinner} />
      ) : status.status === "found" ? (
        <Ionicons name="checkmark-circle" size={14} color="#22c55e" />
      ) : status.status === "error" ? (
        <Ionicons name="alert-circle" size={14} color="#f87171" />
      ) : (
        <Ionicons name="remove-circle-outline" size={14} color="#666" />
      )}
      <Text style={styles.chipText} numberOfLines={1}>
        {status.name}
        {status.status === "found" && status.count > 0 ? ` · ${status.count}` : ""}
      </Text>
    </View>
  );
}

function SourceRow({
  option,
  providerName,
  preferredCode,
  playing,
  disabled,
  onPress,
  stage,
}: {
  option: SourceOption;
  providerName: string;
  preferredCode: string | null;
  playing: boolean;
  disabled: boolean;
  onPress: () => void;
  stage: string | null;
}) {
  const { primaryColor } = useThemeStore();
  const meta = [providerName, option.sizeText].filter(Boolean).join(" · ");
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      disabled={disabled}
      onPress={onPress}
      style={[styles.row, disabled && !playing && styles.rowDim]}
    >
      <View style={[styles.quality, { borderColor: `${primaryColor}88` }]}>
        <Text style={[styles.qualityText, { color: primaryColor }]}>
          {option.height ? `${option.height}p` : "HD"}
        </Text>
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {option.label}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {playing && stage ? stage : meta}
        </Text>
        {option.languages.length > 0 || option.multiAudio ? (
          <View style={styles.langRow}>
            {option.languages.slice(0, 4).map((code) => {
              const match = code === preferredCode;
              return (
                <View
                  key={code}
                  style={[
                    styles.lang,
                    match && { backgroundColor: primaryColor, borderColor: primaryColor },
                  ]}
                >
                  <Text style={[styles.langText, match && { color: "#fff" }]}>
                    {languageName(code)}
                  </Text>
                </View>
              );
            })}
            {option.languages.length === 0 && option.multiAudio ? (
              <View style={styles.lang}>
                <Text style={styles.langText}>Multi audio</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
      {playing ? (
        <ActivityIndicator size="small" color={primaryColor} />
      ) : (
        <Ionicons name="play-circle" size={28} color={primaryColor} />
      )}
    </TouchableOpacity>
  );
}

/**
 * Quality list for a movie or one episode. Providers report in one at a time;
 * rows whose audio matches the user's preferred language are listed first.
 */
export default function SourcesPanel({
  options,
  providers,
  loading,
  checkingAudio,
  preferredCode,
  noProviders,
  playingId,
  stage,
  onPlay,
  emptyText,
}: Props) {
  const nameOf = (providerId: string) =>
    providers.find((p) => p.providerId === providerId)?.name || providerId;

  // Options arrive already in strict order; this only draws the group labels.
  const preferredRows = preferredCode
    ? options.filter((o) => o.languages.includes(preferredCode))
    : [];
  const multiRows = options.filter(
    (o) => !preferredRows.includes(o) && o.multiAudio,
  );
  const otherRows = options.filter(
    (o) => !preferredRows.includes(o) && !o.multiAudio,
  );
  const split =
    [preferredRows, multiRows, otherRows].filter((g) => g.length > 0).length > 1;
  const busy = playingId != null;

  const renderRow = (option: SourceOption) => (
    <SourceRow
      key={option.id}
      option={option}
      providerName={nameOf(option.providerId)}
      preferredCode={preferredCode}
      playing={playingId === option.id}
      disabled={busy}
      stage={stage}
      onPress={() => onPlay(option)}
    />
  );

  if (noProviders) {
    return (
      <View style={styles.empty}>
        <Ionicons name="extension-puzzle-outline" size={40} color="#444" />
        <Text style={styles.emptyTitle}>No providers installed</Text>
        <Text style={styles.emptyText}>
          Install a provider from the Providers tab to find streams for this title.
        </Text>
      </View>
    );
  }

  return (
    <View>
      {providers.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {providers.map((provider) => (
            <StatusChip key={provider.providerId} status={provider} />
          ))}
        </ScrollView>
      ) : null}

      {preferredCode ? (
        <View style={styles.audioNote}>
          <Ionicons name="language-outline" size={14} color="#38bdf8" />
          <Text style={styles.audioNoteText}>
            {languageName(preferredCode)} audio first
            {checkingAudio ? " · checking audio tracks…" : ""}
          </Text>
        </View>
      ) : null}

      {options.length === 0 && loading ? (
        <View style={{ gap: 8 }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} style={{ height: 72, borderRadius: 14 }} />
          ))}
        </View>
      ) : null}

      {options.length === 0 && !loading ? (
        <View style={styles.empty}>
          <Ionicons name="cloud-offline-outline" size={40} color="#444" />
          <Text style={styles.emptyTitle}>No streams found</Text>
          <Text style={styles.emptyText}>
            {emptyText ||
              "None of your installed providers returned this title. Try installing more providers."}
          </Text>
        </View>
      ) : null}

      <View style={{ gap: 8 }}>
        {split && preferredRows.length > 0 ? (
          <Text style={styles.groupLabel}>
            {languageName(preferredCode)} audio
          </Text>
        ) : null}
        {preferredRows.map(renderRow)}
        {split && multiRows.length > 0 ? (
          <Text style={styles.groupLabel}>Multi audio</Text>
        ) : null}
        {multiRows.map(renderRow)}
        {split && otherRows.length > 0 ? (
          <Text style={styles.groupLabel}>Other qualities</Text>
        ) : null}
        {otherRows.map(renderRow)}
        {options.length > 0 && loading ? (
          <Skeleton style={{ height: 72, borderRadius: 14 }} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { gap: 8, paddingBottom: 12 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#0a0a0a",
    borderWidth: 1,
    borderColor: "#1a1a1a",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: 190,
  },
  chipSpinner: { transform: [{ scale: 0.7 }] },
  chipText: { color: "#bbb", fontSize: 12, fontWeight: "600", flexShrink: 1 },
  audioNote: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  audioNoteText: { color: "#7dd3fc", fontSize: 12, fontWeight: "600" },
  groupLabel: {
    color: "#8a8a8a",
    fontSize: 11.5,
    fontWeight: "800",
    letterSpacing: 1,
    marginTop: 4,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#0a0a0a",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#151515",
    padding: 12,
  },
  rowDim: { opacity: 0.5 },
  quality: {
    minWidth: 54,
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 9,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  qualityText: { fontSize: 12.5, fontWeight: "800" },
  rowBody: { flex: 1 },
  rowTitle: { color: "#fff", fontSize: 14, fontWeight: "600" },
  rowMeta: { color: "#777", fontSize: 12, marginTop: 3 },
  langRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 7 },
  lang: {
    borderWidth: 1,
    borderColor: "#2a2a2a",
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  langText: { color: "#aaa", fontSize: 10.5, fontWeight: "700" },
  empty: { alignItems: "center", paddingVertical: 28, paddingHorizontal: 20, gap: 8 },
  emptyTitle: { color: "#ddd", fontSize: 15, fontWeight: "700" },
  emptyText: { color: "#777", fontSize: 12.5, textAlign: "center", lineHeight: 18 },
});
