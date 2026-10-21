import React from "react";
import { Alert, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  cancelDownload,
  deleteDownload,
  retryDownload,
  startDownload,
} from "@/services/downloadManager";
import {
  isActiveDownload,
  useDownloadsStore,
} from "@/store/useDownloadsStore";

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
  const active = !!job && isActiveDownload(job.status);
  const pct = Math.round((job?.progress || 0) * 100);

  const begin = async () => {
    const result = await startDownload({ link, title, providerId, type, image });
    if (!result.ok) {
      Alert.alert(
        "Download unavailable",
        result.error || "This title cannot be downloaded right now.",
      );
    }
  };

  const confirmDelete = () => {
    Alert.alert("Delete download", "Remove this file from your device?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => void deleteDownload(link),
      },
    ]);
  };

  const onPress = () => {
    if (active) {
      cancelDownload(link);
      return;
    }
    if (job?.status === "completed") {
      Alert.alert(
        "Already downloaded",
        "This title is available in your Downloads. Long-press to delete it.",
      );
      return;
    }
    if (job?.status === "error") {
      Alert.alert("Download failed", job.error || "Unknown error", [
        { text: "Close", style: "cancel" },
        {
          text: "Retry",
          onPress: () => {
            void retryDownload(link).then((result) => {
              if (!result.ok) {
                Alert.alert(
                  "Cannot retry",
                  result.error || "Please try again later.",
                );
              }
            });
          },
        },
      ]);
      return;
    }
    void begin();
  };

  const onLongPress = () => {
    if (job?.status === "completed") confirmDelete();
  };

  let iconName: any = "download-outline";
  let iconColor = color;
  if (job?.status === "queued") {
    iconName = "time-outline";
    iconColor = "#f59e0b";
  } else if (active) {
    iconName = "close-circle";
    iconColor = "#f59e0b";
  } else if (job?.status === "completed") {
    iconName = "checkmark-circle";
    iconColor = "#10b981";
  } else if (job?.status === "error") {
    iconName = "alert-circle";
    iconColor = "#ef4444";
  } else if (job?.status === "cancelled") {
    iconName = "refresh-circle-outline";
    iconColor = "#9ca3af";
  }

  const labelText = active
    ? job?.status === "queued"
      ? "Queued"
      : `${pct}%`
    : job?.status === "completed"
      ? "Downloaded"
      : job?.status === "cancelled"
        ? "Retry"
        : label;

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
      style={label ? styles.stack : undefined}
    >
      <Ionicons name={iconName} size={size} color={iconColor} />
      {!!labelText && (
        <Text style={[styles.label, { color: iconColor }]}>{labelText}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  stack: { alignItems: "center", minWidth: 56 },
  label: { fontSize: 12, marginTop: 6 },
});
