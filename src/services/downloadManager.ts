import { Directory, File, FileMode, Paths } from "expo-file-system";
import * as Network from "expo-network";
import { providerApi } from "@/lib/providerApi";
import { selectPlaybackStreams } from "@/lib/streams";
import { DEFAULT_UA } from "@/services/SandboxManager";
import {
  DownloadJob,
  isActiveDownload,
  useDownloadsStore,
} from "@/store/useDownloadsStore";
import { usePreferencesStore } from "@/store/usePreferencesStore";

const MAX_CONCURRENT = 2;
const HLS_CONCURRENCY = 6;
const APP_DOWNLOAD_DIR = "k45-downloads";

const queue: string[] = [];
const running = new Set<string>();
const cancelRequested = new Set<string>();
const abortControllers = new Map<string, AbortController>();

export type StartResult = { ok: boolean; error?: string };

const hasHeader = (headers: Record<string, string>, name: string) =>
  Object.keys(headers).some((k) => k.toLowerCase() === name.toLowerCase());

const withUa = (headers?: Record<string, string>): Record<string, string> => {
  const copy: Record<string, string> = {};
  if (headers) {
    for (const [key, value] of Object.entries(headers)) {
      if (value != null) copy[key] = String(value);
    }
  }
  if (!hasHeader(copy, "user-agent")) copy["User-Agent"] = DEFAULT_UA;
  return copy;
};

const shortHash = (value: string) => {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) + hash + value.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36).slice(0, 7);
};

const sanitizeFileName = (name: string) =>
  name
    .replace(/[\\/:*?"<>|#%&{}$!'@+`=\r\n]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 70) || "video";

const extFromUrl = (url: string): string | null => {
  const clean = url.split(/[?#]/)[0];
  const match = clean.match(/\.([a-zA-Z0-9]{2,5})$/);
  return match ? match[1].toLowerCase() : null;
};

const mimeForExt = (ext: string) => {
  switch (ext) {
    case "mp4":
    case "m4v":
      return "video/mp4";
    case "mkv":
      return "video/x-matroska";
    case "webm":
      return "video/webm";
    case "mov":
      return "video/quicktime";
    case "ts":
      return "video/mp2t";
    default:
      return "video/mp4";
  }
};

const isHls = (url: string, type?: string) =>
  type === "m3u8" || /\.m3u8($|\?)/i.test(url);

const resolveUrl = (base: string, relative: string): string => {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(relative)) return relative;
  try {
    return new URL(relative, base).toString();
  } catch {
    if (relative.startsWith("/")) {
      const match = base.match(/^(https?:\/\/[^/]+)/i);
      if (match) return match[1] + relative;
    }
    const baseDir = base.slice(0, base.lastIndexOf("/") + 1);
    return baseDir + relative;
  }
};

const abortError = () => {
  const error: any = new Error("Download cancelled");
  error.name = "AbortError";
  return error;
};

const assertNotAborted = (signal: AbortSignal) => {
  if (signal.aborted) throw abortError();
};

const networkAllowsDownload = async (): Promise<StartResult> => {
  const prefs = usePreferencesStore.getState();
  if (!prefs.wifiOnlyDownloads) return { ok: true };
  try {
    const state = await Network.getNetworkStateAsync();
    if (
      state.isConnected !== false &&
      state.type === Network.NetworkStateType.WIFI
    ) {
      return { ok: true };
    }
  } catch {
    // Fall through to the honest error below.
  }
  return {
    ok: false,
    error:
      "Wi-Fi only downloads are enabled. Connect to Wi-Fi (or turn the setting off in Preferences) and try again.",
  };
};

const appDirectory = () => {
  const dir = new Directory(Paths.document, APP_DOWNLOAD_DIR);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
};

const customDirectory = (uri?: string) => {
  if (!uri) {
    throw new Error(
      "No download folder is selected. Choose one in Profile → Preferences → Download location.",
    );
  }
  const dir = new Directory(uri);
  let exists = false;
  try {
    exists = dir.exists;
  } catch {
    exists = false;
  }
  if (!exists) {
    throw new Error(
      "The selected download folder is no longer accessible. Choose it again in Preferences.",
    );
  }
  return dir;
};

const deleteQuietly = (file: File | null | undefined) => {
  if (!file) return;
  try {
    if (file.exists) file.delete();
  } catch {}
};

async function fetchText(
  url: string,
  headers: Record<string, string>,
  signal: AbortSignal,
) {
  const response = await fetch(url, { headers, signal });
  if (!response.ok) {
    throw new Error(`Playlist request failed (${response.status})`);
  }
  return response.text();
}

type HlsVariant = { url: string; bandwidth: number };

function parseVariants(masterText: string, baseUrl: string): HlsVariant[] {
  const lines = masterText.split(/\r?\n/);
  const variants: HlsVariant[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith("#EXT-X-STREAM-INF")) continue;
    const bandwidth = parseInt(
      line.match(/BANDWIDTH=(\d+)/)?.[1] || "0",
      10,
    );
    for (let j = i + 1; j < lines.length; j++) {
      const candidate = lines[j].trim();
      if (!candidate || candidate.startsWith("#")) continue;
      variants.push({
        url: resolveUrl(baseUrl, candidate),
        bandwidth,
      });
      break;
    }
  }
  return variants;
}

const pickVariant = (
  variants: HlsVariant[],
  quality: "best" | "smallest",
): HlsVariant => {
  const sorted = [...variants].sort((a, b) => a.bandwidth - b.bandwidth);
  return quality === "smallest" ? sorted[0] : sorted[sorted.length - 1];
};

function parseMediaPlaylist(mediaText: string, baseUrl: string) {
  if (!/#EXT-X-ENDLIST/i.test(mediaText) && /#EXTINF/i.test(mediaText)) {
    throw new Error(
      "Live HLS streams cannot be downloaded. Choose a video-on-demand source.",
    );
  }
  if (
    /#EXT-X-(?:SESSION-)?KEY:[^#]*METHOD=(AES-128|SAMPLE-AES)/i.test(
      mediaText,
    )
  ) {
    throw new Error(
      "This stream is encrypted (AES-128/SAMPLE-AES), so it cannot be saved for offline playback.",
    );
  }
  if (/#EXT-X-BYTERANGE/i.test(mediaText)) {
    throw new Error(
      "This stream uses byte-range segments, which are not supported for offline download.",
    );
  }

  const initSegments: string[] = [];
  const mapRegex = /#EXT-X-MAP:([^\r\n]+)/gi;
  let mapMatch: RegExpExecArray | null;
  while ((mapMatch = mapRegex.exec(mediaText)) !== null) {
    const attrs = mapMatch[1];
    if (/BYTERANGE=/i.test(attrs)) {
      throw new Error(
        "This stream uses byte-range initialization segments, which are not supported for offline download.",
      );
    }
    const uri = attrs.match(/URI="([^"]+)"/i)?.[1];
    if (uri) initSegments.push(resolveUrl(baseUrl, uri));
  }
  if (initSegments.length > 1) {
    throw new Error(
      "This stream changes initialization segments mid-playback, which cannot be saved as one file.",
    );
  }

  const segments = mediaText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => resolveUrl(baseUrl, line));

  return { segments, initSegment: initSegments[0] || null };
}

async function downloadToFile(
  url: string,
  headers: Record<string, string>,
  destFile: File,
  jobId: string,
  controller: AbortController,
  onProgress?: (bytesWritten: number, totalBytes: number) => void,
) {
  const task = File.createDownloadTask(url, destFile, {
    headers,
    signal: controller.signal,
    onProgress: ({ bytesWritten, totalBytes }) => {
      onProgress?.(bytesWritten, totalBytes);
    },
  });
  try {
    await task.downloadAsync();
  } finally {
    task.release();
  }
}

async function downloadHls(
  url: string,
  headers: Record<string, string>,
  jobId: string,
  controller: AbortController,
  quality: "best" | "smallest",
): Promise<{ merged: File; tempDir: Directory; ext: "mp4" | "ts" }> {
  const { signal } = controller;

  let playlistUrl = url;
  let playlist = await fetchText(url, headers, signal);
  assertNotAborted(signal);

  const isMaster = /#EXT-X-STREAM-INF/i.test(playlist);
  if (isMaster) {
    if (
      /#EXT-X-MEDIA:(?=[^\r\n]*TYPE=AUDIO)(?=[^\r\n]*URI=")/i.test(playlist)
    ) {
      throw new Error(
        "This HLS stream keeps audio in a separate playlist, so it cannot be saved as one offline file.",
      );
    }
    const variants = parseVariants(playlist, url);
    if (variants.length === 0) {
      throw new Error("This HLS stream has no downloadable variants.");
    }
    const variant = pickVariant(variants, quality);
    playlistUrl = variant.url;
    playlist = await fetchText(playlistUrl, headers, signal);
    assertNotAborted(signal);
  }

  const { segments, initSegment } = parseMediaPlaylist(playlist, playlistUrl);
  if (segments.length === 0) {
    throw new Error("This stream's playlist contains no downloadable segments.");
  }

  const ext: "mp4" | "ts" = initSegment ? "mp4" : "ts";
  const tempDir = new Directory(Paths.cache, "k45-hls", shortHash(jobId));
  if (tempDir.exists) tempDir.delete();
  tempDir.create({ intermediates: true });

  const merged = new File(tempDir, `merged.${ext}`);
  merged.create();
  const handle = merged.open(FileMode.Append);

  useDownloadsStore.getState().patchJob(jobId, {
    status: "merging",
    segmentsDone: 0,
    segmentsTotal: segments.length,
    progress: 0,
  });

  let bytesReceived = 0;
  let nextIndex = 0;
  let done = 0;
  let firstError: any = null;
  let appendChain: Promise<void> = Promise.resolve();

  const appendSegments = async () => {
    if (initSegment) {
      const initFile = new File(tempDir, `init-${shortHash(initSegment)}`);
      await downloadToFile(
        initSegment,
        headers,
        initFile,
        jobId,
        controller,
      );
      assertNotAborted(signal);
      handle.writeBytes(await initFile.bytes());
      bytesReceived += initFile.size || 0;
      deleteQuietly(initFile);
    }

    const worker = async () => {
      while (nextIndex < segments.length) {
        if (firstError) return;
        try {
          assertNotAborted(signal);
        } catch (error) {
          firstError = firstError || error;
          return;
        }
        const index = nextIndex++;
        const segmentFile = new File(tempDir, `seg_${index}`);
        try {
          await downloadToFile(
            segments[index],
            headers,
            segmentFile,
            jobId,
            controller,
          );
        } catch (error) {
          firstError = firstError || error;
          return;
        }
        appendChain = appendChain.then(async () => {
          if (firstError) return;
          const bytes = await segmentFile.bytes();
          handle.writeBytes(bytes);
          bytesReceived += bytes.byteLength;
          done += 1;
          deleteQuietly(segmentFile);
          useDownloadsStore.getState().patchJob(jobId, {
            status: "merging",
            segmentsDone: done,
            segmentsTotal: segments.length,
            progress: done / segments.length,
            bytesReceived,
          });
        });
      }
    };

    const workerCount = Math.min(HLS_CONCURRENCY, segments.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    await appendChain;
    if (firstError) throw firstError;
  };

  try {
    await appendSegments();
    assertNotAborted(signal);
    handle.close();
    if (!merged.exists || merged.size <= 0) {
      throw new Error("The downloaded stream is empty.");
    }
    return { merged, tempDir, ext };
  } catch (error) {
    try {
      handle.close();
    } catch {}
    deleteQuietly(merged);
    try {
      if (tempDir.exists) tempDir.delete();
    } catch {}
    throw error;
  }
}

async function finalizeHls(
  merged: File,
  tempDir: Directory,
  ext: "mp4" | "ts",
  fileName: string,
  job: DownloadJob,
): Promise<File> {
  if (job.storage === "custom") {
    const dir = customDirectory(job.storageUri);
    const target = new File(tempDir, fileName);
    if (merged.uri !== target.uri) {
      deleteQuietly(target);
      await merged.move(target);
    }
    await target.copy(dir, { overwrite: true });
    deleteQuietly(target);
    const copied = dir
      .list()
      .find((entry): entry is File => entry.name === fileName);
    if (!copied) {
      throw new Error(
        "The file was downloaded but could not be placed in the selected folder.",
      );
    }
    return copied;
  }

  const dir = appDirectory();
  const target = new File(dir, fileName);
  deleteQuietly(target);
  await merged.move(target);
  return target;
}

const ensureVerified = (file: File, expectedBytes?: number) => {
  if (!file.exists) {
    throw new Error("The downloaded file could not be verified.");
  }
  const size = file.size || 0;
  if (size <= 0) {
    throw new Error("The downloaded file is empty.");
  }
  if (expectedBytes && expectedBytes > 0 && size < expectedBytes) {
    throw new Error(
      "The download is incomplete (file size does not match the server). Please retry.",
    );
  }
  return size;
};

async function runJob(id: string) {
  const store = useDownloadsStore.getState();
  const job = store.jobs.find((item) => item.id === id);
  if (!job || job.status !== "queued") return;

  const allowed = await networkAllowsDownload();
  if (!allowed.ok) {
    store.patchJob(id, {
      status: "error",
      error: allowed.error,
    });
    return;
  }

  const controller = new AbortController();
  abortControllers.set(id, controller);
  if (cancelRequested.has(id)) controller.abort();
  store.patchJob(id, {
    status: "downloading",
    error: undefined,
    progress: 0,
    bytesReceived: 0,
    bytesTotal: 0,
    segmentsDone: undefined,
    segmentsTotal: undefined,
  });

  let createdFile: File | null = null;
  let hlsTempDir: Directory | null = null;

  try {
    assertNotAborted(controller.signal);
    const prefs = usePreferencesStore.getState();
    const data: any = await providerApi.getStream(
      job.providerId,
      job.link,
      job.type || "movie",
    );
    assertNotAborted(controller.signal);

    const streams: any[] = Array.isArray(data) ? data : data ? [data] : [];
    // Pick a verified candidate instead of blindly using the first URL; this
    // also applies the best/smallest quality preference to separate-quality
    // servers. HLS variants are still selected inside downloadHls.
    const selection = await selectPlaybackStreams(streams, {
      preference:
        prefs.downloadQuality === "smallest" ? "lowest" : "highest",
      signal: controller.signal,
      budgetMs: 7000,
      includeDownloadOnly: true,
    });
    assertNotAborted(controller.signal);
    const chosen =
      selection.streams[selection.startIndex] || selection.streams[0];
    if (!chosen) throw new Error("This provider returned no playable stream.");

    const url = chosen.link;
    if (chosen.format === "dash") {
      throw new Error(
        "DASH/MPD streams are not supported for offline downloads.",
      );
    }

    const headers = withUa(chosen.headers);
    const hls = chosen.format === "hls" || isHls(url);
    const baseName = `${sanitizeFileName(job.title)}-${shortHash(job.link)}`;

    if (hls) {
      const result = await downloadHls(
        url,
        headers,
        id,
        controller,
        prefs.downloadQuality === "smallest" ? "smallest" : "best",
      );
      hlsTempDir = result.tempDir;
      const fileName = `${baseName}.${result.ext}`;

      useDownloadsStore.getState().patchJob(id, {
        status: "saving",
        progress: 1,
      });
      const finalFile = await finalizeHls(
        result.merged,
        result.tempDir,
        result.ext,
        fileName,
        job,
      );
      createdFile = finalFile;
      assertNotAborted(controller.signal);
      const size = ensureVerified(finalFile);
      useDownloadsStore.getState().patchJob(id, {
        status: "completed",
        progress: 1,
        bytesReceived: size,
        bytesTotal: size,
        fileUri: finalFile.uri,
        completedAt: Date.now(),
        error: undefined,
      });
    } else {
      const ext = extFromUrl(url) || "mp4";
      const fileName = `${baseName}.${ext}`;
      if (job.storage === "custom") {
        const dir = customDirectory(job.storageUri);
        createdFile = dir.createFile(fileName, mimeForExt(ext));
      } else {
        const dir = appDirectory();
        const target = new File(dir, fileName);
        deleteQuietly(target);
        createdFile = target;
      }

      await downloadToFile(
        url,
        headers,
        createdFile,
        id,
        controller,
        (bytesWritten, totalBytes) => {
          useDownloadsStore.getState().patchJob(id, {
            status: "downloading",
            bytesReceived: bytesWritten,
            bytesTotal: totalBytes > 0 ? totalBytes : 0,
            progress: totalBytes > 0 ? bytesWritten / totalBytes : 0,
          });
        },
      );

      assertNotAborted(controller.signal);

      useDownloadsStore.getState().patchJob(id, {
        status: "saving",
        progress: 1,
      });
      const size = ensureVerified(createdFile);
      useDownloadsStore.getState().patchJob(id, {
        status: "completed",
        progress: 1,
        bytesReceived: size,
        bytesTotal: size,
        fileUri: createdFile.uri,
        completedAt: Date.now(),
        error: undefined,
      });
    }
  } catch (error: any) {
    const cancelled = controller.signal.aborted;
    if (cancelled) {
      const current = useDownloadsStore
        .getState()
        .jobs.find((item) => item.id === id);
      if (current?.status !== "completed") {
        useDownloadsStore.getState().patchJob(id, {
          status: "cancelled",
          error: undefined,
          progress: 0,
          bytesReceived: 0,
          bytesTotal: 0,
          fileUri: undefined,
          completedAt: undefined,
        });
      }
      deleteQuietly(createdFile);
    } else {
      deleteQuietly(createdFile);
      useDownloadsStore.getState().patchJob(id, {
        status: "error",
        error: error?.message || "Download failed.",
      });
    }
  } finally {
    if (hlsTempDir) {
      try {
        if (hlsTempDir.exists) hlsTempDir.delete();
      } catch {}
    }
  }
}

function pumpQueue() {
  while (running.size < MAX_CONCURRENT && queue.length > 0) {
    const id = queue.shift();
    if (!id || running.has(id)) continue;
    const job = useDownloadsStore.getState().jobs.find((item) => item.id === id);
    if (!job || job.status !== "queued") continue;
    running.add(id);
    void runJob(id)
      .catch(() => {})
      .finally(() => {
        abortControllers.delete(id);
        cancelRequested.delete(id);
        running.delete(id);
        pumpQueue();
      });
  }
}

const enqueue = (id: string) => {
  if (!queue.includes(id) && !running.has(id)) queue.push(id);
  pumpQueue();
};

type StartOptions = {
  link: string;
  title: string;
  providerId: string;
  type?: string;
  image?: string;
};

export async function startDownload(
  options: StartOptions,
): Promise<StartResult> {
  const id = options.link;
  const store = useDownloadsStore.getState();
  const existing = store.jobs.find((job) => job.id === id);

  if (existing) {
    if (existing.status === "completed") {
      return { ok: false, error: "This title is already downloaded." };
    }
    if (isActiveDownload(existing.status)) {
      return { ok: false, error: "This title is already being downloaded." };
    }
    return retryDownload(id);
  }

  const allowed = await networkAllowsDownload();
  if (!allowed.ok) return allowed;

  const prefs = usePreferencesStore.getState();
  const useCustom =
    prefs.downloadLocation === "custom" && !!prefs.downloadDirectoryUri;

  store.upsertJob({
    id,
    link: options.link,
    title: options.title,
    providerId: options.providerId,
    type: options.type,
    image: options.image,
    status: "queued",
    progress: 0,
    bytesReceived: 0,
    bytesTotal: 0,
    storage: useCustom ? "custom" : "app",
    storageUri: useCustom ? prefs.downloadDirectoryUri! : undefined,
    createdAt: Date.now(),
  });
  enqueue(id);
  return { ok: true };
}

export async function retryDownload(id: string): Promise<StartResult> {
  const store = useDownloadsStore.getState();
  const job = store.jobs.find((item) => item.id === id);
  if (!job) return { ok: false, error: "Download not found." };
  if (job.status === "completed") {
    return { ok: false, error: "This title is already downloaded." };
  }
  if (isActiveDownload(job.status)) return { ok: true };

  const allowed = await networkAllowsDownload();
  if (!allowed.ok) {
    store.patchJob(id, { status: "error", error: allowed.error });
    return allowed;
  }

  store.patchJob(id, {
    status: "queued",
    error: undefined,
    progress: 0,
    bytesReceived: 0,
    bytesTotal: 0,
    segmentsDone: undefined,
    segmentsTotal: undefined,
    fileUri: undefined,
    completedAt: undefined,
  });
  enqueue(id);
  return { ok: true };
}

export function cancelDownload(id: string) {
  const index = queue.indexOf(id);
  if (index >= 0) queue.splice(index, 1);
  const store = useDownloadsStore.getState();
  const job = store.jobs.find((item) => item.id === id);
  if (!job || job.status === "completed" || job.status === "cancelled") return;

  if (running.has(id)) cancelRequested.add(id);
  abortControllers.get(id)?.abort();
  if (!running.has(id)) {
    cancelRequested.delete(id);
    store.patchJob(id, {
      status: "cancelled",
      error: undefined,
      progress: 0,
      bytesReceived: 0,
      bytesTotal: 0,
      fileUri: undefined,
    });
  }
}

export async function deleteDownload(id: string) {
  cancelDownload(id);
  const store = useDownloadsStore.getState();
  const job = store.jobs.find((item) => item.id === id);
  if (!job) return;

  if (job.fileUri) {
    try {
      const file = new File(job.fileUri);
      if (file.exists) file.delete();
    } catch {}
  }

  // Let an in-flight job finish tearing down its partial file before removal.
  if (running.has(id)) {
    await new Promise<void>((resolve) => setTimeout(() => resolve(), 250));
  }
  useDownloadsStore.getState().removeJob(id);
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}
