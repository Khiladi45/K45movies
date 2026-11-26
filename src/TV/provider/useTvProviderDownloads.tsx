// Provider Based TV: download episodes / movie links and play them offline.
// Same flow as the phone Provider page (pickDownloadStream in
// src/Home/screens/DetailScreen.tsx): provider streams → prefer servers that
// are not download-only → pick a quality if there are several → download.
// A download's id is the provider link it came from, so phone downloads of
// the same provider item show up here too.
import React, { useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { providerApi } from "@/lib/providerApi";
import { normalizeStreams, type PlayableStream } from "@/lib/streams";
import { downloadFileExists } from "@/lib/localPlayback";
import { formatBytes } from "@/services/downloadManager";
import { useDownloadsStore } from "@/store/useDownloadsStore";
import TvDialog, { type TvDialogAction } from "../components/TvDialog";
import { downloadButtonState, findLinkJob } from "../downloads/tvDownloadMatch";
import { jobActions, playTvDownload, startTvProviderDownload } from "../downloads/tvDownloads";

export type ProviderItem = { link: string; title?: string; type?: string };

type Dialog =
  | { kind: "items" }
  | { kind: "quality"; index: number; streams: PlayableStream[] }
  | { kind: "manage"; index: number }
  | null;

/** Streams worth downloading: not download-only servers first (phone rule). */
export function downloadableStreams(raw: any): PlayableStream[] {
  const normalized = normalizeStreams(Array.isArray(raw) ? raw : raw ? [raw] : []);
  const playable = normalized.filter((s) => !s.downloadOnly);
  return playable.length > 0 ? playable : normalized;
}

/** React keys in TvDialog are labels, so make repeated labels unique. */
function uniqueLabels(labels: string[]): string[] {
  const seen = new Map<string, number>();
  return labels.map((label) => {
    const n = (seen.get(label) || 0) + 1;
    seen.set(label, n);
    return n > 1 ? `${label} (${n})` : label;
  });
}

export function useTvProviderDownloads({
  items,
  post,
  providerId,
  title,
  image,
  series,
}: {
  items: ProviderItem[];
  post: { link: string };
  providerId: string;
  title: string;
  image?: string;
  series: boolean;
}) {
  const navigation = useNavigation<any>();
  const jobs = useDownloadsStore((s) => s.jobs);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loadingLink, setLoadingLink] = useState<string | null>(null);

  // A movie downloaded on the phone is keyed by its post link.
  const jobFor = (link: string) => findLinkJob(jobs, series ? [link] : [link, post.link]);
  const offlineFor = (link: string) => {
    const job = jobFor(link);
    return job && job.status === "completed" && downloadFileExists(job) ? job : null;
  };
  const stateFor = (link: string) => downloadButtonState(jobFor(link));
  const itemName = (index: number) =>
    items[index]?.title || (series ? `Episode ${index + 1}` : `Link ${index + 1}`);
  const fileTitle = (index: number) => (series ? `${title} - ${itemName(index)}` : title);
  const itemType = (index: number) => items[index]?.type || (series ? "series" : "movie");

  /** Plays the downloaded copy; false if there is none (or the file is gone). */
  const playOffline = (link: string) => {
    const job = offlineFor(link);
    if (!job) return false;
    const error = playTvDownload(job, (r) => navigation.navigate(r));
    setMessage(error);
    return !error;
  };

  const start = (index: number, stream?: PlayableStream) => {
    const item = items[index];
    if (!item) return;
    setMessage("Starting download…");
    startTvProviderDownload({
      link: item.link,
      providerId,
      type: itemType(index),
      title: fileTitle(index),
      image,
      stream,
    })
      .then((r) => setMessage(r.ok ? "Downloading — see Downloads in the menu." : r.error || "Could not start the download."))
      .catch(() => setMessage("Could not start the download."));
  };

  /** Loads the qualities for one item, then downloads (asking if there are several). */
  const begin = async (index: number) => {
    const item = items[index];
    if (!item || loadingLink) return;
    setLoadingLink(item.link);
    setMessage("Loading download qualities…");
    try {
      const data = await providerApi.getStream(providerId, item.link, itemType(index));
      const list = downloadableStreams(data);
      if (list.length === 0) {
        setMessage("This provider returned no downloadable stream.");
      } else if (list.length === 1) {
        start(index, list[0]);
      } else {
        setMessage(null);
        setDialog({ kind: "quality", index, streams: list });
      }
    } catch (error: any) {
      setMessage(error?.message || "Could not load the available qualities.");
    } finally {
      setLoadingLink(null);
    }
  };

  /** OK on "Download" for one item: manage an existing download or start one. */
  const openItemMenu = (index: number) => {
    const item = items[index];
    if (!item) return;
    setMessage(null);
    const job = jobFor(item.link);
    if (job && job.status !== "cancelled") setDialog({ kind: "manage", index });
    else void begin(index);
  };

  const onPressDownload = () => {
    setMessage(null);
    if (items.length === 0) setMessage("Nothing to download in this entry.");
    else if (items.length === 1) openItemMenu(0);
    else setDialog({ kind: "items" });
  };

  // Header button: the first item's state for a movie; a count for a series.
  const doneCount = items.filter((i) => stateFor(i.link).state === "done").length;
  const activeCount = items.filter((i) => stateFor(i.link).state === "active").length;
  const button = !series
    ? downloadButtonState(items[0] ? jobFor(items[0].link) : undefined)
    : {
        label: activeCount
          ? `Downloading ${activeCount}…`
          : doneCount
            ? `Downloaded ${doneCount}/${items.length}`
            : "Download",
        icon: (activeCount ? "hourglass-outline" : doneCount ? "checkmark-done" : "download-outline") as
          | "hourglass-outline"
          | "checkmark-done"
          | "download-outline",
        state: "none" as const,
      };

  const itemLabels = uniqueLabels(
    items.map((_, i) => {
      const st = stateFor(items[i].link);
      const suffix = st.state === "done" ? "  ✓" : st.state === "active" ? `  · ${st.label}` : "";
      return `${itemName(i)}${suffix}`;
    }),
  );
  const itemActions: TvDialogAction[] = items.map((_, i) => ({
    label: itemLabels[i],
    icon: stateFor(items[i].link).state === "done" ? "checkmark-done" : "download-outline",
    onPress: () => setTimeout(() => openItemMenu(i), 250),
  }));

  const qualityActions: TvDialogAction[] =
    dialog?.kind === "quality"
      ? dialog.streams.map((s, i) => {
          const size = Number(s.raw?.size) > 0 ? ` · ${formatBytes(Number(s.raw.size))}` : "";
          return {
            label: `${i + 1}. ${s.height ? `${s.height}p` : s.qualityLabel || "Auto"} · ${s.server || "Server"}${size}`,
            icon: "download-outline" as const,
            onPress: () => start(dialog.index, s),
          };
        })
      : [];

  const manageIndex = dialog?.kind === "manage" ? dialog.index : -1;
  const manageJob = manageIndex >= 0 && items[manageIndex] ? jobFor(items[manageIndex].link) : undefined;
  const manageActions: TvDialogAction[] = manageJob
    ? jobActions(manageJob, {
        playOffline: () => void playOffline(items[manageIndex].link),
        onMessage: setMessage,
        pickAnother: { label: "Choose another quality", onPress: () => setTimeout(() => void begin(manageIndex), 250) },
      })
    : [];

  const close = () => setDialog(null);
  const dialogs = (
    <>
      <TvDialog
        visible={dialog?.kind === "items"}
        title={series ? "Download which episode?" : "Download which link?"}
        subtitle={`${title} · saved on this TV, plays without internet`}
        actions={itemActions}
        onClose={close}
      />
      <TvDialog
        visible={dialog?.kind === "quality"}
        title="Choose download quality"
        subtitle={dialog?.kind === "quality" ? fileTitle(dialog.index) : undefined}
        actions={qualityActions}
        onClose={close}
      />
      <TvDialog
        visible={dialog?.kind === "manage"}
        title={manageJob?.title || (manageIndex >= 0 ? fileTitle(manageIndex) : title)}
        subtitle={manageJob?.error || (manageJob ? downloadButtonState(manageJob).label : undefined)}
        actions={manageActions}
        onClose={close}
      />
    </>
  );

  return { offlineFor, stateFor, playOffline, openItemMenu, onPressDownload, button, dialogs, message, loadingLink };
}
