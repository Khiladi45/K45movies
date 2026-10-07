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
  | "downloading"
  | "merging"
  | "saving"
  | "completed"
  | "error";

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
  error?: string;
  fileUri?: string;
  assetId?: string;
  createdAt: number;
  completedAt?: number;
};

type DownloadsState = {
  jobs: DownloadJob[];
  upsertJob: (job: DownloadJob) => void;
  patchJob: (id: string, patch: Partial<DownloadJob>) => void;
  removeJob: (id: string) => void;
};

const ACTIVE_STATUSES: DownloadStatus[] = [
  "downloading",
  "merging",
  "saving",
];

// Reconcile on boot: an in-flight job cannot survive an app restart,
// so surface it as an error the user can retry instead of a stuck bar.
const reconcile = (jobs: DownloadJob[]): DownloadJob[] =>
  jobs.map((job) =>
    ACTIVE_STATUSES.includes(job.status)
      ? {
          ...job,
          status: "error" as DownloadStatus,
          error: "Interrupted when the app closed. Please retry.",
        }
      : job,
  );

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
          jobs: state.jobs.map((j) =>
            j.id === id ? { ...j, ...patch } : j,
          ),
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
        const persistedState = (persisted as Partial<DownloadsState>) || {};
        return {
          ...current,
          ...persistedState,
          jobs: reconcile(persistedState.jobs || []),
        };
      },
    },
  ),
);
