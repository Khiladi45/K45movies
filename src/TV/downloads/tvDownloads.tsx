// TV downloads for the Movie Based layout. Reuses the phone download manager
// (startDownload / cancel / retry / delete) and offline playback
// (playDownloadedJob). Files always go to app storage on TV, so the phone's
// folder-picker dialog never shows up with a remote.
import React, { useMemo, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import {
  cancelDownload,
  deleteDownload,
  retryDownload,
  startDownload,
  type StartResult,
} from "@/services/downloadManager";
import { useDownloadsStore, type DownloadJob } from "@/store/useDownloadsStore";
import { usePreferencesStore } from "@/store/usePreferencesStore";
import { downloadFileExists, playDownloadedJob } from "@/lib/localPlayback";
import { languageName } from "@/lib/languages";
import type { SourceOption } from "@/lib/titleBridge";
import TvDialog, { type TvDialogAction } from "../components/TvDialog";
import {
  downloadButtonState,
  downloadTitle,
  findTmdbJob,
  type TmdbRef,
} from "./tvDownloadMatch";

const MAX_DIALOG_SOURCES = 10;

/**
 * TV download settings: files go to the app's own storage (no folder picker),
 * and the phone's "Wi-Fi only" rule is off — TVs are often on Ethernet, have
 * no mobile data, and TV has no screen to change that setting.
 */
export function ensureAppStorageOnTv() {
  const prefs = usePreferencesStore.getState();
  if (prefs.wifiOnlyDownloads) prefs.setPreference("wifiOnlyDownloads", false);
  if (prefs.downloadLocation !== "app") prefs.setPreference("downloadLocation", "app");
  if (!prefs.downloadLocationChosen) prefs.setPreference("downloadLocationChosen", true);
}

export async function startTvDownload(
  option: SourceOption,
  ref: TmdbRef,
  title: string,
  image?: string,
  episodeName?: string,
): Promise<StartResult> {
  ensureAppStorageOnTv();
  const result = await startDownload({
    link: option.link,
    providerId: option.providerId,
    type: option.type,
    title: downloadTitle(title, ref, episodeName),
    image,
    tmdb: ref,
  });
  // A job retried from an older attempt keeps its link: make sure it is tied to this title.
  if (result.ok) useDownloadsStore.getState().patchJob(option.link, { tmdb: ref });
  return result;
}

/** Plays a finished download from the file; false (with a message) if it is gone. */
export function playTvDownload(job: DownloadJob, navigate: (route: string) => void): string | null {
  const result = playDownloadedJob(job);
  if (!result.ok) return result.error;
  navigate("Player");
  return null;
}

function sourceLabel(option: SourceOption, providerNames: Record<string, string>, index: number) {
  const langs = option.languages.map((c) => languageName(c)).filter(Boolean);
  return [
    `${index + 1}. ${providerNames[option.providerId] || option.providerId}`,
    option.height ? `${option.height}p` : "",
    option.sizeText || "",
    langs.length ? langs.slice(0, 2).join(", ") : option.multiAudio ? "Multi audio" : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Everything the TV title page needs for one movie or episode: the job, the
 * offline copy (if its file still exists), the Download button state and the
 * dialogs (pick a source / cancel / play offline / delete / retry).
 */
export function useTvTitleDownload({
  tmdb,
  title,
  image,
  episodeName,
  options,
  loading,
  providerNames,
}: {
  tmdb: TmdbRef;
  title: string;
  image?: string;
  episodeName?: string;
  options: SourceOption[];
  loading: boolean;
  providerNames: Record<string, string>;
}) {
  const navigation = useNavigation<any>();
  const jobs = useDownloadsStore((s) => s.jobs);
  const job = useMemo(
    () => findTmdbJob(jobs, tmdb),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [jobs, tmdb.id, tmdb.mediaType, tmdb.season, tmdb.episode],
  );
  const offline = job && job.status === "completed" && downloadFileExists(job) ? job : null;
  const button = downloadButtonState(job);
  const [dialog, setDialog] = useState<"pick" | "manage" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const playOffline = () => {
    if (!offline) return false;
    const error = playTvDownload(offline, (r) => navigation.navigate(r));
    setMessage(error);
    return !error;
  };

  const onPressDownload = () => {
    setMessage(null);
    if (!job || job.status === "cancelled") {
      if (options.length === 0) {
        setMessage(loading ? "Still finding sources — try again in a moment." : "No source to download.");
        return;
      }
      setDialog("pick");
      return;
    }
    setDialog("manage");
  };

  const pickActions: TvDialogAction[] = options.slice(0, MAX_DIALOG_SOURCES).map((option, index) => ({
    label: sourceLabel(option, providerNames, index),
    icon: "download-outline",
    onPress: () => {
      setMessage("Starting download…");
      startTvDownload(option, tmdb, title, image, episodeName)
        .then((r) => setMessage(r.ok ? "Downloading — see Downloads in the menu." : r.error || "Could not start the download."))
        .catch(() => setMessage("Could not start the download."));
    },
  }));

  let manageActions: TvDialogAction[] = [];
  if (job && button.state === "done") {
    manageActions = [
      { label: "Play offline", icon: "play", onPress: () => void playOffline() },
      { label: "Delete download", icon: "trash-outline", destructive: true, onPress: () => void deleteDownload(job.id) },
    ];
  } else if (job && button.state === "active") {
    manageActions = [
      { label: "Cancel download", icon: "close", destructive: true, onPress: () => cancelDownload(job.id) },
    ];
  } else if (job) {
    manageActions = [
      {
        label: "Retry download",
        icon: "refresh",
        onPress: () => {
          ensureAppStorageOnTv();
          retryDownload(job.id).then((r) => setMessage(r.ok ? null : r.error || "Retry failed."));
        },
      },
      { label: "Choose another source", icon: "list", onPress: () => setTimeout(() => setDialog("pick"), 250) },
      { label: "Remove", icon: "trash-outline", destructive: true, onPress: () => void deleteDownload(job.id) },
    ];
  }

  const dialogs = (
    <>
      <TvDialog
        visible={dialog === "pick"}
        title="Download which source?"
        subtitle={`${downloadTitle(title, tmdb, episodeName)} · saved on this TV, plays without internet`}
        actions={pickActions}
        onClose={() => setDialog(null)}
      />
      <TvDialog
        visible={dialog === "manage"}
        title={job?.title || title}
        subtitle={job?.error || button.label}
        actions={manageActions}
        onClose={() => setDialog(null)}
      />
    </>
  );

  return { job, offline, button, onPressDownload, playOffline, dialogs, message };
}
