import { queryClient } from "@/lib/queryClient";
import { providerApi } from "@/lib/providerApi";
import { selectPlaybackStreams } from "@/lib/streams";
import {
  episodeLabel,
  findNextEpisode,
  findSameEpisode,
  parseSeasonNumber,
  toPlayerEpisodes,
} from "@/lib/episodes";
import { usePreferencesStore } from "@/store/usePreferencesStore";
import {
  usePlayerStore,
  type PlayerEpisode,
  type PlayerMeta,
} from "@/store/usePlayerStore";

/** Same cache key as useEpisodes, so a list already shown on the detail page is reused. */
export async function loadEpisodes(
  providerId: string,
  episodesLink: string,
): Promise<PlayerEpisode[]> {
  const data = await queryClient.fetchQuery({
    queryKey: ["episodes", providerId, episodesLink],
    queryFn: ({ signal }) =>
      providerApi.getEpisodes(providerId, episodesLink, signal),
  });
  return toPlayerEpisodes(data as any[]);
}

/**
 * Qualities the player offers. For a series, only entries of the same season
 * as the current one (a season's 720p/1080p), never a different season.
 */
export function playerQualityOptions(
  meta: PlayerMeta,
): { index: number; label: string }[] {
  const list = meta?.qualities || [];
  if (list.length < 2) return [];
  const currentSeason = parseSeasonNumber(list[meta?.qualityIndex ?? 0]?.label);
  const options = list
    .map((quality, index) => ({
      index,
      label: quality.label,
      season: parseSeasonNumber(quality.label),
    }))
    .filter(
      (option) =>
        !meta?.isSeries ||
        currentSeason == null ||
        option.season == null ||
        option.season === currentSeason,
    )
    .map(({ index, label }) => ({ index, label }));
  return options.length > 1 ? options : [];
}

export function getNextEpisode(meta: PlayerMeta): PlayerEpisode | undefined {
  if (!meta?.isSeries) return undefined;
  return findNextEpisode(meta.episodes || [], meta.episodeNumber, meta.link);
}

async function openStream(
  link: string,
  type: string,
  nextMeta: NonNullable<PlayerMeta>,
  expectedLink: string | undefined,
): Promise<boolean> {
  const raw = await providerApi.getStream(nextMeta.providerId || "", link, type);
  const streams: any[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const selection = await selectPlaybackStreams(streams, {
    preference: usePreferencesStore.getState().defaultQuality,
    budgetMs: 3000,
    probeTimeoutMs: 2600,
  });
  if (selection.streams.length === 0) {
    throw new Error(
      selection.skippedDownloadOnly > 0
        ? "This selection only has download-only servers."
        : "No playable stream found for this selection.",
    );
  }
  const store = usePlayerStore.getState();
  // The user closed the player or started something else while we resolved.
  if (!store.currentVideoUrl || store.playerMeta?.link !== expectedLink) {
    return false;
  }
  const chosen =
    selection.streams[selection.startIndex] || selection.streams[0];
  store.setVideo(chosen.link, selection.streams, selection.startIndex, nextMeta);
  return true;
}

/** Play the same title/episode in another detail-page quality. */
export async function switchQuality(index: number, resumeAt: number) {
  const meta = usePlayerStore.getState().playerMeta;
  const quality = meta?.qualities?.[index];
  if (!meta || !meta.providerId || !quality) {
    throw new Error("This quality is not available.");
  }

  const items: PlayerEpisode[] = quality.episodesLink
    ? await loadEpisodes(meta.providerId, quality.episodesLink)
    : quality.directLinks || [];

  const currentIndex = Math.max(
    0,
    (meta.episodes || []).findIndex((ep) => ep.link === meta.link),
  );

  let target: PlayerEpisode | undefined;
  let linkIndex: number | undefined;
  if (meta.isSeries) {
    target = findSameEpisode(items, meta.episodeNumber, currentIndex);
  } else {
    linkIndex = Math.min(meta.linkIndex ?? 0, Math.max(0, items.length - 1));
    target = items[linkIndex];
  }
  if (!target) {
    throw new Error(
      meta.isSeries
        ? `${meta.episode || "This episode"} is not available in ${quality.label}.`
        : "This quality has no playable link.",
    );
  }

  const number = meta.isSeries ? (target.number ?? meta.episodeNumber ?? null) : null;
  const type = target.type || (quality.episodesLink ? "series" : "movie");
  const nextMeta: NonNullable<PlayerMeta> = {
    ...meta,
    link: target.link,
    type,
    qualityIndex: index,
    episodes: items,
    episodeNumber: number,
    linkIndex,
    episode: meta.isSeries
      ? episodeLabel({ ...target, number }, currentIndex)
      : undefined,
    resumeAt: resumeAt > 2 ? resumeAt : undefined,
  };
  return openStream(target.link, type, nextMeta, meta.link);
}

/** Play another episode of the current quality (Next Episode). */
export async function playEpisode(episode: PlayerEpisode) {
  const meta = usePlayerStore.getState().playerMeta;
  if (!meta || !meta.providerId) throw new Error("Nothing is playing.");
  const quality = meta.qualities?.[meta.qualityIndex ?? 0];
  const type = episode.type || (quality?.episodesLink ? "series" : "movie");
  const index = (meta.episodes || []).findIndex((ep) => ep.link === episode.link);
  const nextMeta: NonNullable<PlayerMeta> = {
    ...meta,
    link: episode.link,
    type,
    episodeNumber: episode.number,
    episode: episodeLabel(episode, Math.max(0, index)),
    resumeAt: undefined,
  };
  return openStream(episode.link, type, nextMeta, meta.link);
}
