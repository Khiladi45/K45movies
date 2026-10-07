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
  useDownloadsStore,
} from "@/store/useDownloadsStore";
import { cancelDownload, deleteDownload } from "@/services/downloadManager";

const ACTIVE = ["downloading", "merging", "saving"];

function statusLine(job: DownloadJob): { text: string; color: string } {
  if (ACTIVE.includes(job.status)) {
    return { text: `Downloading… ${Math.round(job.progress * 100)}%`, color: "#f59e0b" };
  }
  if (job.status === "saving") return { text: "Saving to gallery…", color: "#38bdf8" };
  if (job.status === "completed") return { text: "Saved in gallery", color: "#10b981" };
  return { text: job.error || "Download failed", color: "#ef4444" };
}

const JobRow = memo(function JobRow({ job }: { job: DownloadJob }) {
  const { primaryColor } = useThemeStore();
  const active = ACTIVE.includes(job.status);
  const line = statusLine(job);

  const confirmDelete = () => {
    Alert.alert("Remove download", "Delete this download?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteDownload(job.id),
      },
    ]);
  };

  return (
    <View style={styles.row}>
      <View style={styles.thumb}>
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
      </View>

      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          {job.title}
        </Text>
        <Text style={[styles.status, { color: line.color }]} numberOfLines={1}>
          {line.text}
        </Text>
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              {
                width: `${Math.round(job.progress * 100)}%`,
                backgroundColor: active ? primaryColor : line.color,
              },
            ]}
          />
        </View>
      </View>

      <TouchableOpacity onPress={active ? () => cancelDownload(job.id) : confirmDelete} hitSlop={8}>
        <Ionicons
          name={active ? "close-circle-outline" : "trash-outline"}
          size={22}
          color={active ? "#f59e0b" : "#888"}
        />
      </TouchableOpacity>
    </View>
  );
});

export default function DownloadsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const jobs = useDownloadsStore((s) => s.jobs);

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
        <View style={{ width: 34 }} />
      </View>

      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <JobRow job={item} />}
        contentContainerStyle={
          jobs.length === 0 ? styles.emptyContainer : styles.list
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="download-outline" size={48} color="#333" />
            <Text style={styles.emptyText}>No downloads yet</Text>
            <Text style={styles.emptyHint}>
              Tap the download icon on any movie or episode to save it here.
            </Text>
          </View>
        }
      />
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
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  emptyContainer: { flexGrow: 1, justifyContent: "center" },
  emptyWrap: { alignItems: "center", paddingHorizontal: 40, gap: 10 },
  emptyText: { color: "#888", fontSize: 16, fontWeight: "700" },
  emptyHint: { color: "#555", fontSize: 13, textAlign: "center", lineHeight: 19 },
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
    width: 72,
    height: 48,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
    alignItems: "center",
    justifyContent: "center",
  },
  info: { flex: 1, gap: 4 },
  title: { color: "#fff", fontSize: 13.5, fontWeight: "700" },
  status: { fontSize: 12, fontWeight: "600" },
  track: {
    height: 3,
    borderRadius: 2,
    backgroundColor: "#1f1f1f",
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: 2 },
});
