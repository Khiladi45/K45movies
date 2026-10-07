import { Directory, File, FileMode, Paths } from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import { providerApi } from "@/lib/providerApi";
import { DEFAULT_UA } from "@/services/SandboxManager";
import { useDownloadsStore } from "@/store/useDownloadsStore";

const abortControllers = new Map<string, AbortController>();

const HLS_CONCURRENCY = 6;

const hasHeader = (headers: Record<string, string>, name: string) =>
  Object.keys(headers).some((k) => k.toLowerCase() === name.toLowerCase());

const withUa = (headers?: Record<string, string>): Record<string, string> => {
  const copy: Record<string, string> = {};
  if (headers) {
    for (const [k, v] of Object.entries(headers)) {
      if (v != null) copy[k] = String(v);
    }
  }
  if (!hasHeader(copy, "user-agent")) copy["User-Agent"] = DEFAULT_UA;
  return copy;
};

const isAbort = (e: any) =>
  e?.name === "AbortError" || String(e?.message || "").includes("cancel");

const abortError = () => {
  const e: any = new Error("Aborted");
  e.name = "AbortError";
  return e;
};

const sanitizeFileName = (name: string) =>
  name
    .replace(/[\\/:*?"<>|#%&{}$!'@+`=\r\n]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "video";

const extFromUrl = (url: string): string | null => {
  const clean = url.split(/[?#]/)[0];
  const match = clean.match(/\.([a-zA-Z0-9]{2,5})$/);
  return match ? match[1].toLowerCase() : null;
};

const isHls = (url: string, type?: string) =>
  type === "m3u8" || /\.m3u8($|\?)/i.test(url);

const resolveUrl = (base: string, relative: string): string => {
  if (/^https?:\/\//i.test(relative)) return relative;
  try {
    return new URL(relative, base).toString();
  } catch {
    if (relative.startsWith("/")) {
      const m = base.match(/^(https?:\/\/[^/]+)/i);
      if (m) return m[1] + relative;
    }
    const baseDir = base.slice(0, base.lastIndexOf("/") + 1);
    return baseDir + relative;
  }
};

async function fetchText(url: string, headers: Record<string, string>) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.text();
}

function pickVariant(masterText: string, baseUrl: string): string {
  const lines = masterText.split(/\r?\n/);
  let best: { url: string; bandwidth: number } | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith("#EXT-X-STREAM-INF")) continue;
    const bw = parseInt(
      line.match(/BANDWIDTH=(\d+)/)?.[1] || "0",
      10,
    );
    for (let j = i + 1; j < lines.length; j++) {
      const candidate = lines[j].trim();
      if (!candidate || candidate.startsWith("#")) continue;
      const abs = resolveUrl(baseUrl, candidate);
      if (!best || bw > best.bandwidth) best = { url: abs, bandwidth: bw };
      break;
    }
  }
  if (!best) throw new Error("No stream variant found in master playlist");
  return best.url;
}

function parseSegments(mediaText: string, baseUrl: string): string[] {
  if (/#EXT-X-KEY:[^#]*METHOD=(AES-128|SAMPLE-AES)/i.test(mediaText)) {
    throw new Error("Encrypted streams (AES-128) cannot be downloaded");
  }
  if (/#EXT-X-MAP:/i.test(mediaText)) {
    throw new Error("fMP4 streams cannot be downloaded");
  }
  if (/#EXT-X-BYTERANGE/i.test(mediaText)) {
    throw new Error("Byterange playlists cannot be downloaded");
  }
  return mediaText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => resolveUrl(baseUrl, l));
}

async function downloadDirect(
  url: string,
  headers: Record<string, string>,
  destFile: File,
  jobId: string,
  controller: AbortController,
) {
  const task = File.createDownloadTask(url, destFile, {
    headers,
    signal: controller.signal,
    onProgress: ({ bytesWritten, totalBytes }) => {
      useDownloadsStore.getState().patchJob(jobId, {
        bytesReceived: bytesWritten,
        bytesTotal: totalBytes > 0 ? totalBytes : 0,
        progress: totalBytes > 0 ? bytesWritten / totalBytes : 0,
      });
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
  destFile: File,
  jobId: string,
  controller: AbortController,
) {
  const { signal } = controller;
  let playlist = await fetchText(url, headers);
  if (playlist.includes("#EXT-X-STREAM-INF")) {
    playlist = await fetchText(pickVariant(playlist, url), headers);
  }
  const segments = parseSegments(playlist, url);
  if (segments.length === 0) throw new Error("Playlist has no segments");

  const tempDir = new Directory(Paths.cache, "k45-hls", jobId);
  if (tempDir.exists) tempDir.delete();
  tempDir.create();

  if (destFile.exists) destFile.delete();
  destFile.create();
  const handle = destFile.open(FileMode.Append);

  let appendChain: Promise<void> = Promise.resolve();
  let nextIndex = 0;
  let done = 0;

  const worker = async () => {
    while (nextIndex < segments.length) {
      if (signal.aborted) throw abortError();
      const index = nextIndex++;
      const segFile = new File(tempDir, `seg_${index}.ts`);
      const task = File.createDownloadTask(segments[index], segFile, {
        headers,
        signal,
      });
      try {
        await task.downloadAsync();
      } catch (e) {
        controller.abort();
        throw e;
      } finally {
        task.release();
      }
      // Appends must happen in playlist order even though downloads finish
      // out of order, so chain them instead of writing from the workers.
      appendChain = appendChain.then(async () => {
        handle.writeBytes(await segFile.bytes());
        segFile.delete();
        done += 1;
        useDownloadsStore.getState().patchJob(jobId, {
          bytesReceived: done,
          bytesTotal: segments.length,
          progress: done / segments.length,
        });
      });
    }
  };

  const failures: any[] = [];
  const track = (p: Promise<void>) => {
    p.catch((e) => failures.push(e));
    return p;
  };

  try {
    const workerPromises = Array.from(
      { length: Math.min(HLS_CONCURRENCY, segments.length) },
      () => track(worker()),
    );
    await Promise.all(workerPromises);
    await appendChain;
    if (failures.length > 0) throw failures[0];
  } finally {
    handle.close();
    if (tempDir.exists) tempDir.delete();
  }
}

async function saveToGallery(file: File): Promise<string> {
  const perm = await MediaLibrary.requestPermissionsAsync(true, ["video"]);
  if (!perm.granted) throw new Error("Gallery permission denied");
  const asset = await MediaLibrary.Asset.create(file.uri);
  return asset.id;
}

export async function startDownload(opts: {
  link: string;
  title: string;
  providerId: string;
  type?: string;
  image?: string;
}) {
  const jobId = opts.link;
  const store = useDownloadsStore.getState();
  const existing = store.jobs.find((j) => j.id === jobId);
  if (existing && ["downloading", "merging", "saving"].includes(existing.status)) {
    return;
  }

  const controller = new AbortController();
  abortControllers.set(jobId, controller);

  store.upsertJob({
    id: jobId,
    link: opts.link,
    title: opts.title,
    providerId: opts.providerId,
    type: opts.type,
    image: opts.image,
    status: "downloading",
    progress: 0,
    bytesReceived: 0,
    bytesTotal: 0,
    createdAt: Date.now(),
  });

  const outDir = new Directory(Paths.cache, "k45-downloads");
  if (!outDir.exists) outDir.create();

  try {
    const data: any = await providerApi.getStream(
      opts.providerId,
      opts.link,
      opts.type || "movie",
    );
    if (controller.signal.aborted) throw abortError();

    const streams: any[] = Array.isArray(data) ? data : data ? [data] : [];
    const stream = streams.find((s) => s?.link);
    if (!stream) throw new Error("No stream link returned by provider");

    const headers = withUa(stream.headers);
    const hls = isHls(stream.link, stream.type);
    const ext = hls ? "ts" : extFromUrl(stream.link) || "mp4";
    const destFile = new File(
      outDir,
      `${sanitizeFileName(opts.title)}.${ext}`,
    );

    if (hls) {
      await downloadHls(stream.link, headers, destFile, jobId, controller);
    } else {
      await downloadDirect(stream.link, headers, destFile, jobId, controller);
    }

    useDownloadsStore.getState().patchJob(jobId, { status: "saving", progress: 1 });
    const assetId = await saveToGallery(destFile);
    if (destFile.exists) destFile.delete();

    useDownloadsStore.getState().patchJob(jobId, {
      status: "completed",
      assetId,
      fileUri: undefined,
      completedAt: Date.now(),
    });
  } catch (e: any) {
    if (isAbort(e)) {
      useDownloadsStore.getState().removeJob(jobId);
    } else {
      useDownloadsStore.getState().patchJob(jobId, {
        status: "error",
        error: e?.message || "Download failed",
      });
    }
  } finally {
    abortControllers.delete(jobId);
  }
}

export function cancelDownload(id: string) {
  abortControllers.get(id)?.abort();
}

export async function deleteDownload(id: string) {
  abortControllers.get(id)?.abort();
  const job = useDownloadsStore.getState().jobs.find((j) => j.id === id);
  if (!job) return;
  if (job.assetId) {
    try {
      await new MediaLibrary.Asset(job.assetId).delete();
    } catch {}
  }
  if (job.fileUri) {
    try {
      const file = new File(job.fileUri);
      if (file.exists) file.delete();
    } catch {}
  }
  useDownloadsStore.getState().removeJob(id);
}
