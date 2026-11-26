// Pure helpers for TV downloads in the Movie Based layout (no imports,
// unit-tested with plain Node). A download is tied to a TMDB title or
// episode through the optional `tmdb` field on DownloadJob.

export type TmdbRef = {
  id: number;
  mediaType: "movie" | "tv";
  season?: number;
  episode?: number;
};

type JobLike = {
  id: string;
  status: string;
  progress?: number;
  createdAt?: number;
  tmdb?: TmdbRef;
};

const ACTIVE = new Set(["queued", "downloading", "merging", "saving"]);
export const isActiveStatus = (status: string) => ACTIVE.has(status);

/** Same movie, or same show + season + episode. */
export function sameTmdb(a: TmdbRef | undefined, b: TmdbRef): boolean {
  if (!a || a.id !== b.id || a.mediaType !== b.mediaType) return false;
  if (b.mediaType === "movie") return true;
  return a.season === b.season && a.episode === b.episode;
}

const rank = (status: string) => (status === "completed" ? 0 : isActiveStatus(status) ? 1 : 2);

/**
 * The download for this title/episode: a finished one first, then one in
 * progress, then a failed/cancelled one; newest wins inside each group.
 */
export function findTmdbJob<J extends JobLike>(jobs: J[], ref: TmdbRef): J | undefined {
  let best: J | undefined;
  for (const job of jobs) {
    if (!sameTmdb(job.tmdb, ref)) continue;
    if (
      !best ||
      rank(job.status) < rank(best.status) ||
      (rank(job.status) === rank(best.status) && (job.createdAt || 0) > (best.createdAt || 0))
    ) {
      best = job;
    }
  }
  return best;
}

/** Episode numbers of this show's season that are fully downloaded. */
export function downloadedEpisodes(jobs: JobLike[], showId: number, season: number): Set<number> {
  const out = new Set<number>();
  for (const job of jobs) {
    const t = job.tmdb;
    if (job.status === "completed" && t && t.mediaType === "tv" && t.id === showId && t.season === season && t.episode) {
      out.add(t.episode);
    }
  }
  return out;
}

/** Name saved with the file: "Title" or "Title · S1 E3 Name". */
export function downloadTitle(title: string, ref: TmdbRef, episodeName?: string): string {
  if (ref.mediaType !== "tv" || !ref.season || !ref.episode) return title;
  const ep = `S${ref.season} E${ref.episode}`;
  return `${title} · ${ep}${episodeName ? ` ${episodeName}` : ""}`;
}

/** Text and icon for the title page's Download button. */
export function downloadButtonState(job: JobLike | undefined): {
  label: string;
  icon: "download-outline" | "checkmark-done" | "close-circle-outline" | "hourglass-outline";
  state: "none" | "active" | "done" | "failed";
} {
  if (!job) return { label: "Download", icon: "download-outline", state: "none" };
  if (job.status === "completed") return { label: "Downloaded", icon: "checkmark-done", state: "done" };
  if (isActiveStatus(job.status)) {
    const pct = Math.round(Math.min(1, Math.max(0, job.progress || 0)) * 100);
    return {
      label: job.status === "queued" ? "Queued…" : `Downloading ${pct}%`,
      icon: "hourglass-outline",
      state: "active",
    };
  }
  return { label: "Download failed", icon: "close-circle-outline", state: "failed" };
}

/** Play button text when an offline copy exists. */
export const OFFLINE_SUFFIX = " (downloaded)";
