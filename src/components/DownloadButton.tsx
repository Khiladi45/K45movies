import React from "react";
import { Alert, Text, TouchableOpacity, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  cancelDownload,
  deleteDownload,
  startDownload,
} from "@/services/downloadManager";
import { useDownloadsStore } from "@/store/useDownloadsStore";

type Props = {
  link: string;
  title: string;
  providerId: string;
  type?: string;
  image?: string;
  size?: number;
  color?: string;
  label?: string;
};

const ACTIVE = ["downloading", "merging", "saving"];

export default function DownloadButton({
  link,
  title,
  providerId,
  type,
  image,
  size = 22,
  color = "#F2F2F2",
  label,
}: Props) {
  const job = useDownloadsStore((s) => s.jobs.find((j) => j.id === link));
  const active = !!job && ACTIVE.includes(job.status);
  const pct = Math.round((job?.progress || 0) * 100);

  const begin = () =>
    startDownload({ link, title, providerId, type, image });

  const onPress = () => {
    if (active) {
      cancelDownload(link);
      return;
    }
    if (job?.status === "completed") {
      Alert.alert("Downloaded", "This title is saved in your gallery.");
      return;
    }
    if (job?.status === "error") {
      Alert.alert("Download failed", job.error || "Unknown error", [
        { text: "Cancel", style: "cancel" },
        { text: "Retry", onPress: begin },
      ]);
      return;
    }
    begin();
  };

  const onLongPress = () => {
    if (job?.status === "completed") {
      Alert.alert("Delete download", "Remove it from your gallery?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteDownload(link),
        },
      ]);
    }
  };

  let iconName: any = "download-outline";
  let iconColor = color;
  if (active) {
    iconName = "close-circle";
    iconColor = "#f59e0b";
  } else if (job?.status === "completed") {
    iconName = "checkmark-circle";
    iconColor = "#10b981";
  } else if (job?.status === "error") {
    iconName = "alert-circle";
    iconColor = "#ef4444";
  }

  const labelText = active
    ? `${pct}%`
    : job?.status === "completed"
      ? "Downloaded"
      : label;

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
      style={label ? styles.stack : undefined}
    >
      <Ionicons name={iconName} size={size} color={iconColor} />
      {!!labelText && <Text style={[styles.label, { color: iconColor }]}>{labelText}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  stack: { alignItems: "center", minWidth: 56 },
  label: { fontSize: 12, marginTop: 6 },
});
