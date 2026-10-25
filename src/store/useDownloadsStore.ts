import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createMMKV } from "react-native-mmkv";

const mmkv = createMMKV();

const zustandMMKVStorage = {
  setItem: (name: string, value: string) => {
    mmkv.set(name, value);
  },
  getItem: (name: string) => {
    return mmkv.getString(name) ?? null;
  },
  removeItem: (name: string) => {
    mmkv.remove(name);
  },
};

export type DownloadStatus =
  | "queued"
  | "downloading"
  | "merging"
  | "saving"
  | "completed"
  | "error"
  | "cancelled";

export type DownloadDirectSource = {
  link: string;
  headers?: Record<string, string>;
  format?: string;
};

export type DownloadJob = {
  id: string;
  link: string;
  title: string;
  providerId: string;
  type?: string;
  image?: string;
  status: DownloadStatus;
  progress: number;
  bytesReceived: number;
  bytesTotal: number;
  segmentsDone?: number;
  segmentsTotal?: number;
  error?: string;
  /** Playable local URI (file:// or content:// from the chosen folder). */
  fileUri?: string;
  /** Quality picked in the download sheet; skips re-resolving the provider. */
  direct?: DownloadDirectSource;
  storage: "app" | "custom";
  /** Folder URI captured when the download started. */
  storageUri?: string;
  createdAt: number;
  completedAt?: number;
};

export const ACTIVE_DOWNLOAD_STATUSES: DownloadStatus[] = [
  "queued",
  "downloading",
  "merging",
  "saving",
];

export const isActiveDownload = (status: DownloadStatus) =>
  ACTIVE_DOWNLOAD_STATUSES.includes(status);

type DownloadsState = {
  jobs: DownloadJob[];
  upsertJob: (job: DownloadJob) => void;
  patchJob: (id: string, patch: Partial<DownloadJob>) => void;
  removeJob: (id: string) => void;
};

const normalizeJob = (job: Partial<DownloadJob>): DownloadJob | null => {
  if (!job.id || !job.link) return null;
  const active = isActiveDownload(job.status as DownloadStatus);
  const legacyGallery =
    job.status === "completed" && !job.fileUri && !!(job as any).assetId;
  let status = (job.status || "error") as DownloadStatus;
  let error = job.error;
  if (active) {
    status = "error";
    error = "Interrupted when the app closed. Retry to download again.";
  } else if (legacyGallery) {
    status = "error";
    error =
      "This old download was saved to the gallery only. Download it again to play inside the app.";
  }
  return {
    id: job.id,
    link: job.link,
    title: job.title || "Untitled",
    providerId: job.providerId || "",
    type: job.type,
    image: job.image,
    status,
    progress: typeof job.progress === "number" ? job.progress : 0,
    bytesReceived: job.bytesReceived || 0,
    bytesTotal: job.bytesTotal || 0,
    segmentsDone: job.segmentsDone,
    segmentsTotal: job.segmentsTotal,
    error,
    fileUri: job.fileUri,
    direct: job.direct,
    storage: job.storage === "custom" ? "custom" : "app",
    storageUri: job.storageUri,
    createdAt: job.createdAt || Date.now(),
    completedAt: job.completedAt,
  };
};

export const useDownloadsStore = create<DownloadsState>()(
  persist(
    (set) => ({
      jobs: [],

      upsertJob: (job) =>
        set((state) => {
          const exists = state.jobs.some((j) => j.id === job.id);
          return {
            jobs: exists
              ? state.jobs.map((j) => (j.id === job.id ? job : j))
              : [job, ...state.jobs],
          };
        }),

      patchJob: (id, patch) =>
        set((state) => ({
          jobs: state.jobs.map((j) => (j.id === id ? { ...j, ...patch } : j)),
        })),

      removeJob: (id) =>
        set((state) => ({
          jobs: state.jobs.filter((j) => j.id !== id),
        })),
    }),
    {
      name: "k45-downloads-storage",
      storage: createJSONStorage(() => zustandMMKVStorage),
      merge: (persisted, current) => {
        const persistedState = (persisted as { jobs?: Partial<DownloadJob>[] }) || {};
        const jobs = (persistedState.jobs || [])
          .map(normalizeJob)
          .filter((job): job is DownloadJob => job !== null);
        return {
          ...current,
          jobs,
        };
      },
    },
  ),
);
