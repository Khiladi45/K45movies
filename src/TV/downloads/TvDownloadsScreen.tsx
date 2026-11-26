// Movie Based layout — "Downloads" section on TV. Every download (newest
// first) with progress. OK: play offline / cancel / retry; hold OK: delete.
import React, { useMemo, useRef, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useDownloadsStore, type DownloadJob } from "@/store/useDownloadsStore";
import {
  cancelDownload,
  deleteDownload,
  formatBytes,
  retryDownload,
} from "@/services/downloadManager";
import { useThemeStore } from "@/store/useThemeStore";
import Focusable from "../components/Focusable";
import TvDialog, { type TvDialogAction } from "../components/TvDialog";
import { TV } from "../theme";
import { useRestoreTvFocus } from "../useRestoreTvFocus";
import { downloadButtonState } from "./tvDownloadMatch";
import { ensureAppStorageOnTv, playTvDownload } from "./tvDownloads";

function statusText(job: DownloadJob): string {
  const state = downloadButtonState(job);
  if (state.state === "done") return `Downloaded · ${formatBytes(job.bytesTotal || job.bytesReceived)}`;
  if (state.state === "active") {
    if (job.status === "merging") return "Joining video and audio…";
    if (job.status === "saving") return "Saving…";
    const size = job.bytesTotal ? ` · ${formatBytes(job.bytesReceived)} of ${formatBytes(job.bytesTotal)}` : "";
    return `${state.label}${size}`;
  }
  return job.status === "cancelled" ? "Cancelled" : `Failed${job.error ? ` · ${job.error}` : ""}`;
}

export default function TvDownloadsScreen() {
  const navigation = useNavigation<any>();
  const primaryColor = useThemeStore((s) => s.primaryColor);
  const jobs = useDownloadsStore((s) => s.jobs);
  const items = useMemo(() => [...jobs].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)), [jobs]);
  const used = useMemo(
    () => jobs.filter((j) => j.status === "completed").reduce((n, j) => n + (j.bytesTotal || j.bytesReceived || 0), 0),
    [jobs],
  );
  const [menu, setMenu] = useState<{ job: DownloadJob; actions: TvDialogAction[] } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const firstRef = useRef<View | null>(null);
  useRestoreTvFocus(firstRef);

  const remove = (job: DownloadJob): TvDialogAction => ({
    label: job.status === "completed" ? "Delete download" : "Remove",
    icon: "trash-outline",
    destructive: true,
    onPress: () => void deleteDownload(job.id),
  });

  const onPress = (job: DownloadJob) => {
    setMessage(null);
    const state = downloadButtonState(job).state;
    if (state === "done") {
      setMessage(playTvDownload(job, (r) => navigation.navigate(r)));
      return;
    }
    if (state === "active") {
      setMenu({
        job,
        actions: [{ label: "Cancel download", icon: "close", destructive: true, onPress: () => cancelDownload(job.id) }],
      });
      return;
    }
    setMenu({
      job,
      actions: [
        {
          label: "Retry download",
          icon: "refresh",
          onPress: () => {
            ensureAppStorageOnTv();
            retryDownload(job.id).then((r) => setMessage(r.ok ? null : r.error || "Retry failed."));
          },
        },
        remove(job),
      ],
    });
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Downloads</Text>
      <Text style={styles.hint}>
        {items.length
          ? `${formatBytes(used)} used on this TV · OK plays offline · hold OK to delete`
          : ""}
      </Text>
      {message ? <Text style={styles.error}>{message}</Text> : null}
      {items.length === 0 ? (
        <Text style={styles.empty}>
          Open a movie or episode and press Download. Downloaded titles play here without internet,
          and Play on their page uses the downloaded file automatically.
        </Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(job) => job.id}
          contentContainerStyle={styles.content}
          removeClippedSubviews={false}
          renderItem={({ item: job, index }) => {
            const state = downloadButtonState(job);
            const pct = Math.round(Math.min(1, Math.max(0, job.progress || 0)) * 100);
            return (
              <Focusable
                ref={index === 0 ? firstRef : undefined}
                style={styles.row}
                onPress={() => onPress(job)}
                onLongPress={() => setMenu({ job, actions: [remove(job)] })}
                accessibilityLabel={job.title}
              >
                {job.image ? (
                  <Image source={{ uri: job.image }} style={styles.poster} contentFit="cover" />
                ) : (
                  <View style={[styles.poster, styles.noPoster]}>
                    <Ionicons name="film-outline" size={20} color={TV.muted} />
                  </View>
                )}
                <View style={styles.main}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {job.title}
                  </Text>
                  <Text
                    style={[styles.status, state.state === "failed" && styles.failed]}
                    numberOfLines={1}
                  >
                    {statusText(job)}
                  </Text>
                  {state.state === "active" ? (
                    <View style={styles.track}>
                      <View style={[styles.fill, { width: `${pct}%`, backgroundColor: primaryColor }]} />
                    </View>
                  ) : null}
                </View>
                <Ionicons
                  name={state.state === "done" ? "play" : state.icon}
                  size={20}
                  color={state.state === "failed" ? "#f87171" : "#fff"}
                />
              </Focusable>
            );
          }}
        />
      )}
      <TvDialog
        visible={!!menu}
        title={menu?.job.title || ""}
        subtitle={menu ? statusText(menu.job) : undefined}
        actions={menu?.actions || []}
        onClose={() => setMenu(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: TV.bg, paddingTop: TV.safeY + 8 },
  title: { color: "#fff", fontSize: TV.text.title, fontWeight: "800", marginHorizontal: TV.safeX },
  hint: { color: TV.muted, fontSize: TV.text.small, marginHorizontal: TV.safeX, marginTop: 4, marginBottom: 12 },
  error: { color: "#f87171", fontSize: TV.text.body, marginHorizontal: TV.safeX, marginBottom: 8 },
  empty: { color: TV.muted, fontSize: TV.text.body, marginHorizontal: TV.safeX, marginTop: 8, maxWidth: 560, lineHeight: 19 },
  content: { paddingHorizontal: TV.safeX, paddingBottom: 40, maxWidth: 760 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 8,
    marginBottom: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  poster: { width: 48, height: 72, borderRadius: 4, backgroundColor: TV.surface },
  noPoster: { alignItems: "center", justifyContent: "center" },
  main: { flex: 1, gap: 4 },
  rowTitle: { color: "#fff", fontSize: TV.text.body, fontWeight: "700" },
  status: { color: TV.muted, fontSize: TV.text.small },
  failed: { color: "#fca5a5" },
  track: { height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)", marginTop: 2 },
  fill: { height: 4, borderRadius: 2 },
});
