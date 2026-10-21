import { File } from "expo-file-system";
import { usePlayerStore } from "@/store/usePlayerStore";
import type { DownloadJob } from "@/store/useDownloadsStore";

export type LocalPlaybackResult =
  | { ok: true }
  | { ok: false; missing: boolean; error: string };

export const downloadFileExists = (job: DownloadJob): boolean => {
  if (!job.fileUri) return false;
  try {
    return new File(job.fileUri).exists;
  } catch {
    return false;
  }
};

/**
 * Plays the saved file directly. It never asks the provider for a fresh
 * stream, so offline playback keeps working after signed URLs expire.
 */
export const playDownloadedJob = (job: DownloadJob): LocalPlaybackResult => {
  if (!downloadFileExists(job) || !job.fileUri) {
    return {
      ok: false,
      missing: true,
      error: "The downloaded file is no longer on this device.",
    };
  }

  const ext = job.fileUri.split("?")[0].split(".").pop()?.toLowerCase();
  usePlayerStore.getState().open(
    job.fileUri,
    [{ link: job.fileUri, type: ext, server: "Downloaded" }],
    0,
    {
      title: job.title,
      link: job.fileUri,
      providerId: "__local",
      type: job.type,
      image: job.image,
    },
  );
  return { ok: true };
};
