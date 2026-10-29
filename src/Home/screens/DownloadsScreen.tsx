import React, { memo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeStore } from "@/store/useThemeStore";
import {
  DownloadJob,
  isActiveDownload,
  useDownloadsStore,
} from "@/store/useDownloadsStore";
import { playDownloadedJob } from "@/lib/localPlayback";
import {
  cancelDownload,
  deleteDownload,
  formatBytes,
  retryDownload,
} from "@/services/downloadManager";

function statusLine(job: DownloadJob): { text: string; color: string } {
  const pct = Math.round(job.progress * 100);
  switch (job.status) {
    case "queued":
      return {
        text: "Queued — waiting for a free download slot",
        color: "#f59e0b",
      };
    case "downloading":
      return {
        text:
          job.bytesTotal > 0
            ? `Downloading ${pct}% · ${formatBytes(job.bytesReceived)} of ${formatBytes(job.bytesTotal)}`
            : `Downloading · ${formatBytes(job.bytesReceived)}`,
        color: "#f59e0b",
      };
    case "merging":
      return {
        text:
          job.segmentsTotal && job.segmentsTotal > 0
            ? `Processing stream · ${job.segmentsDone || 0}/${job.segmentsTotal} parts (${pct}%)`
            : `Processing stream · ${pct}%`,
        color: "#38bdf8",
      };
    case "saving":
      return { text: "Verifying and saving file…", color: "#38bdf8" };
    case "completed":
      return {
        text: `${formatBytes(job.bytesTotal)} · ${job.storage === "custom" ? "Selected folder" : "App storage"}`,
        color: "#10b981",
      };
    case "cancelled":
      return { text: "Cancelled", color: "#9ca3af" };
    default:
      return { text: job.error || "Download failed", color: "#ef4444" };
  }
}

const JobRow = memo(function JobRow({
  job,
  onPlay,
}: {
  job: DownloadJob;
  onPlay: (job: DownloadJob) => void;
}) {
  const { primaryColor } = useThemeStore();
  const active = isActiveDownload(job.status);
  const line = statusLine(job);
  const canPlay = job.status === "completed" && !!job.fileUri;
  const canRetry =
    job.status === "error" || job.status === "cancelled" || active;

  const confirmDelete = () => {
    Alert.alert("Delete download", "Remove this file from your device?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => void deleteDownload(job.id),
      },
    ]);
  };

  const retry = async () => {
    const result = await retryDownload(job.id);
    if (!result.ok) {
      Alert.alert(
        "Cannot download",
        result.error || "Please try again later.",
      );
    }
  };

  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={styles.thumb}
        activeOpacity={canPlay ? 0.75 : 1}
        onPress={() => canPlay && onPlay(job)}
      >
        {job.image ? (
          <Image
            source={{ uri: job.image }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <Ionicons name="film-outline" size={22} color="#555" />
        )}
        {canPlay && (
          <View style={styles.thumbPlay}>
            <Ionicons name="play" size={18} color="#fff" />
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          {job.title}
        </Text>
        <Text style={[styles.status, { color: line.color }]} numberOfLines={2}>
          {line.text}
        </Text>
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              {
                width: `${Math.max(0, Math.min(100, Math.round(job.progress * 100)))}%`,
                backgroundColor:
                  job.status === "completed" ? "#10b981" : line.color,
              },
            ]}
          />
        </View>
      </View>

      <View style={styles.actions}>
        {canPlay && (
          <TouchableOpacity
            onPress={() => onPlay(job)}
            hitSlop={8}
            style={styles.actionBtn}
          >
            <Ionicons name="play-circle" size={26} color={primaryColor} />
          </TouchableOpacity>
        )}
        {canRetry && (
          <TouchableOpacity
            onPress={active ? () => cancelDownload(job.id) : retry}
            hitSlop={8}
            style={styles.actionBtn}
          >
            <Ionicons
              name={active ? "close-circle-outline" : "refresh"}
              size={22}
              color={active ? "#f59e0b" : "#9ca3af"}
            />
          </TouchableOpacity>
        )}
        {!active && (
          <TouchableOpacity
            onPress={confirmDelete}
            hitSlop={8}
            style={styles.actionBtn}
          >
            <Ionicons name="trash-outline" size={20} color="#888" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});

export default function DownloadsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const jobs = useDownloadsStore((s) => s.jobs);
  const { primaryColor } = useThemeStore();

  const completed = jobs.filter((job) => job.status === "completed");
  const usedBytes = completed.reduce(
    (sum, job) => sum + (job.bytesTotal || 0),
    0,
  );

  const play = (job: DownloadJob) => {
    const result = playDownloadedJob(job);
    if (result.ok) {
      navigation.navigate("Player");
      return;
    }
    Alert.alert("File missing", result.error, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove entry",
        style: "destructive",
        onPress: () => void deleteDownload(job.id),
      },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Downloads</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate("Preferences")}
          hitSlop={10}
          style={styles.backBtn}
        >
          <Ionicons name="options-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {jobs.length > 0 && (
        <View style={styles.summary}>
          <View>
            <Text style={styles.summaryValue}>{completed.length}</Text>
            <Text style={styles.summaryLabel}>
              {completed.length === 1 ? "downloaded title" : "downloaded titles"}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View>
            <Text style={styles.summaryValue}>{formatBytes(usedBytes)}</Text>
            <Text style={styles.summaryLabel}>used by downloads</Text>
          </View>
          <TouchableOpacity
            style={[styles.folderBtn, { borderColor: `${primaryColor}55` }]}
            onPress={() => navigation.navigate("Preferences")}
          >
            <Ionicons name="folder-outline" size={16} color={primaryColor} />
            <Text style={[styles.folderBtnText, { color: primaryColor }]}>
              Folder
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <JobRow job={item} onPlay={play} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={
          jobs.length === 0 ? styles.emptyContainer : styles.list
        }
        ListHeaderComponent={
          jobs.length > 0 ? (
            <View style={styles.limitNote}>
              <Ionicons
                name="information-circle-outline"
                size={16}
                color="#777"
              />
              <Text style={styles.limitText}>
                Protected (DRM/AES) and live streams cannot be saved. Up to two
                downloads run at the same time.
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="download-outline" size={48} color="#333" />
            <Text style={styles.emptyText}>No downloads yet</Text>
            <Text style={styles.emptyHint}>
              Tap the download icon on a movie or episode to save it for offline
              playback.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  backBtn: { padding: 4, width: 34 },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },

  summary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#222",
    backgroundColor: "#0c0c0c",
  },
  summaryValue: { color: "#fff", fontSize: 16, fontWeight: "800" },
  summaryLabel: { color: "#777", fontSize: 11, marginTop: 2 },
  summaryDivider: { width: 1, height: 28, backgroundColor: "#222" },
  folderBtn: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  folderBtnText: { fontSize: 12, fontWeight: "700" },

  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  emptyContainer: { flexGrow: 1, justifyContent: "center" },
  emptyWrap: { alignItems: "center", paddingHorizontal: 40, gap: 10 },
  emptyText: { color: "#888", fontSize: 16, fontWeight: "700" },
  emptyHint: { color: "#555", fontSize: 13, textAlign: "center", lineHeight: 19 },

  limitNote: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  limitText: { flex: 1, color: "#777", fontSize: 11.5, lineHeight: 16 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#0a0a0a",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1a1a1a",
    padding: 10,
  },
  thumb: {
    width: 84,
    height: 52,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbPlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  info: { flex: 1, gap: 4 },
  title: { color: "#fff", fontSize: 13.5, fontWeight: "700" },
  status: { fontSize: 11.5, fontWeight: "600", lineHeight: 16 },
  track: {
    height: 3,
    borderRadius: 2,
    backgroundColor: "#1f1f1f",
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: 2 },
  actions: { flexDirection: "row", alignItems: "center", gap: 2 },
  actionBtn: { padding: 6 },
});
