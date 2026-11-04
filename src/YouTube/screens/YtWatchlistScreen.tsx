import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import {
  cancelDownload,
  deleteDownload,
  formatBytes,
  retryDownload,
  startDownload,
} from "@/services/downloadManager";
import { downloadFileExists } from "@/lib/localPlayback";
import {
  isActiveDownload,
  useDownloadsStore,
  type DownloadJob,
} from "@/store/useDownloadsStore";
import { useYtLibraryStore } from "../store";
import { YT } from "../theme";
import type { YtVideo } from "../types";
import { notify } from "../utils";
import VideoRow from "../components/VideoRow";

type Tab = "saved" | "downloads";

// Download progress is stored as 0..1.
const percent = (job: DownloadJob) =>
  Math.max(0, Math.min(100, Math.round((job.progress || 0) * 100)));

const jobToVideo = (job: DownloadJob): YtVideo => ({
  id: job.id,
  title: job.title,
  link: job.link,
  image: job.image || "",
  channelName: "",
  views: "",
  publishedTime: "",
  duration: "",
  aspectRatio: 16 / 9,
  isShort: false,
  isLive: false,
});

export default function YtWatchlistScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("saved");

  const saved = useYtLibraryStore((s) => s.saved);
  const removeSaved = useYtLibraryStore((s) => s.removeSaved);
  const jobs = useDownloadsStore((s) => s.jobs);

  const ytJobs = useMemo(
    () =>
      jobs
        .filter((j) => j.providerId === "youtube")
        .sort((a, b) => b.createdAt - a.createdAt),
    [jobs],
  );
  const jobFor = useCallback(
    (link: string) => ytJobs.find((j) => j.link === link),
    [ytJobs],
  );

  const play = useCallback(
    (video: YtVideo) => {
      const job = jobFor(video.link);
      if (job?.status === "completed" && downloadFileExists(job) && job.fileUri) {
        navigation.navigate("YtVideo", { video, localUri: job.fileUri });
      } else if (video.isShort) {
        navigation.navigate("Shorts", { items: [video], startIndex: 0 });
      } else {
        navigation.navigate("YtVideo", { video });
      }
    },
    [jobFor, navigation],
  );

  const playJob = useCallback(
    (job: DownloadJob) => {
      if (job.status !== "completed") return;
      if (!downloadFileExists(job) || !job.fileUri) {
        notify("The downloaded file is no longer on this device.");
        return;
      }
      navigation.navigate("YtVideo", {
        video: jobToVideo(job),
        link: job.link,
        title: job.title,
        localUri: job.fileUri,
      });
    },
    [navigation],
  );

  const download = async (video: YtVideo) => {
    const result = await startDownload({
      link: video.link,
      title: video.title,
      providerId: "youtube",
      type: "movie",
      image: video.image,
    });
    notify(result.ok ? "Download started" : result.error || "Couldn't start download");
  };

  const confirmDelete = (job: DownloadJob) =>
    Alert.alert("Delete download?", job.title, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteDownload(job.id) },
    ]);

  const statusFor = (job?: DownloadJob) => {
    if (!job) return { text: "Saved", color: YT.muted };
    if (job.status === "completed") {
      return { text: `Downloaded${job.bytesTotal ? ` · ${formatBytes(job.bytesTotal)}` : ""}`, color: YT.green };
    }
    if (isActiveDownload(job.status)) {
      return { text: `Downloading · ${percent(job)}%`, color: YT.blue };
    }
    if (job.status === "error") return { text: "Download failed", color: YT.red };
    return { text: "Saved", color: YT.muted };
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Watchlist</Text>
      </View>

      <View style={styles.tabs}>
        {(["saved", "downloads"] as Tab[]).map((t) => {
          const active = tab === t;
          return (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {t === "saved" ? "Saved" : "Downloads"}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {tab === "saved" ? (
        <FlatList
          data={saved}
          keyExtractor={(v) => v.id}
          ListEmptyComponent={
            <Text style={styles.empty}>Videos you save appear here.</Text>
          }
          renderItem={({ item }) => {
            const job = jobFor(item.link);
            const status = statusFor(job);
            const downloaded = job?.status === "completed";
            const busy = !!job && isActiveDownload(job.status);
            return (
              <VideoRow
                video={item}
                onPress={play}
                statusLine={
                  <Text style={{ color: status.color, fontSize: 12, lineHeight: 16 }}>
                    {status.text}
                  </Text>
                }
                right={
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={styles.iconBtn}
                      accessibilityLabel={downloaded ? "Downloaded" : "Download"}
                      disabled={downloaded || busy}
                      onPress={() => download(item)}
                    >
                      <Ionicons
                        name={downloaded ? "checkmark-circle" : "download-outline"}
                        size={22}
                        color={downloaded ? YT.green : busy ? YT.muted : YT.text}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.iconBtn}
                      accessibilityLabel="Remove from Watchlist"
                      onPress={() => removeSaved(item.id)}
                    >
                      <Ionicons name="close" size={22} color={YT.muted} />
                    </TouchableOpacity>
                  </View>
                }
              />
            );
          }}
          contentContainerStyle={{ paddingBottom: 16 }}
        />
      ) : (
        <FlatList
          data={ytJobs}
          keyExtractor={(j) => j.id}
          ListEmptyComponent={
            <Text style={styles.empty}>Downloaded videos appear here.</Text>
          }
          renderItem={({ item: job }) => {
            const status = statusFor(job);
            const active = isActiveDownload(job.status);
            return (
              <View>
                <VideoRow
                  video={jobToVideo(job)}
                  onPress={() => playJob(job)}
                  statusLine={
                    <Text style={{ color: status.color, fontSize: 12, lineHeight: 16 }}>
                      {status.text}
                    </Text>
                  }
                  right={
                    <View style={styles.actions}>
                      {job.status === "error" || job.status === "cancelled" ? (
                        <TouchableOpacity
                          style={styles.iconBtn}
                          accessibilityLabel="Retry download"
                          onPress={() => retryDownload(job.id)}
                        >
                          <Ionicons name="refresh" size={22} color={YT.text} />
                        </TouchableOpacity>
                      ) : null}
                      <TouchableOpacity
                        style={styles.iconBtn}
                        accessibilityLabel={active ? "Cancel download" : "Delete download"}
                        onPress={() => (active ? cancelDownload(job.id) : confirmDelete(job))}
                      >
                        <Ionicons name={active ? "pause" : "trash-outline"} size={22} color={YT.text} />
                      </TouchableOpacity>
                    </View>
                  }
                />
                {active ? (
                  <View style={styles.track}>
                    <View
                      style={[
                        styles.fill,
                        { width: `${percent(job)}%` },
                      ]}
                    />
                  </View>
                ) : null}
              </View>
            );
          }}
          contentContainerStyle={{ paddingBottom: 16 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: YT.bg },
  header: { height: 56, justifyContent: "center", paddingHorizontal: 16 },
  title: { color: YT.text, fontSize: 20, fontWeight: "700" },
  tabs: { height: 48, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12 },
  chip: { height: 32, paddingHorizontal: 14, borderRadius: 8, backgroundColor: YT.surface, justifyContent: "center" },
  chipActive: { backgroundColor: YT.text },
  chipText: { color: YT.text, fontSize: 14, fontWeight: "500" },
  chipTextActive: { color: YT.bg },
  empty: { color: YT.muted, fontSize: 14, textAlign: "center", marginTop: 48 },
  actions: { justifyContent: "center" },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  track: { height: 3, marginHorizontal: 12, borderRadius: 2, backgroundColor: "#3f3f3f" },
  fill: { height: 3, borderRadius: 2, backgroundColor: YT.blue },
});
