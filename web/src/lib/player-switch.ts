import { providers } from "./catalog-api";
import type { LinkGroup, Source } from "./catalog-types";
import { episodeNumberOf, findSameEpisode, orderEpisodes, parseSeasonNumber } from "./episodes";
import type { PlaybackItem, PlaybackTarget } from "./playback";
import { usePlayerPreferences } from "./player-preferences";
import { streamLanguages } from "./title-bridge";

export function qualityLabel(group: LinkGroup) {
  return group.quality && !group.title.includes(group.quality) ? group.title + " · " + group.quality : group.title;
}

export function playerQualityOptions(target: PlaybackTarget) {
  const groups = target.qualities ?? [];
  const current = groups[target.qualityIndex ?? 0];
  const season = parseSeasonNumber(current?.title) ?? target.seasonNumber;
  return groups.map((group, index) => ({ group, label: qualityLabel(group), index })).filter(({ group }) => {
    const option = parseSeasonNumber(group.title);
    return !target.item.series || season == null || option == null || season === option;
  });
}

export function qualityRisk(label: string) {
  return Number(/hevc|[xh]\.?265/i.test(label)) * 2 +
    Number(/10[\s-]?bit/i.test(label)) * 3 +
    Number(/hdr|dolby|\bdv\b|dovi|vision/i.test(label)) * 3 +
    Number(/2160p|\b4k\b|uhd/i.test(label)) * 3 +
    Number(/\b(?:e-?ac-?3|ddp|dd\+)\b/i.test(label)) * 2 -
    Number(/[xh]\.?264|avc/i.test(label)) * 2;
}

export function fallbackQualities(target: PlaybackTarget, attempted: Set<number>) {
  return playerQualityOptions(target).filter(({ index }) => index !== target.qualityIndex && !attempted.has(index))
    .sort((a, b) => qualityRisk(a.label) - qualityRisk(b.label));
}

export async function switchQuality(target: PlaybackTarget, index: number, signal: AbortSignal): Promise<PlaybackTarget> {
  const option = playerQualityOptions(target).find((item) => item.index === index);
  if (!option) throw new Error("This quality is unavailable for this season.");
  const { group } = option;
  const provider = target.item.provider;
  const remote = group.episodesRef ? await providers.episodes(provider, group.episodesRef, signal) : [];
  const items = (remote.length ? remote : group.directLinks).map(({ ref, title }) => ({
    ref, title, provider, series: target.item.series,
  }));
  const episodes = orderEpisodes(items);
  const number = target.episodeNumber ?? episodeNumberOf(target.item);
  const currentIndex = Math.max(0, target.episodes.findIndex(({ ref }) => ref === target.item.ref));
  const item = target.item.series ? findSameEpisode(episodes, number, currentIndex) :
    items[Math.min(target.itemIndex ?? 0, items.length - 1)];
  if (!item) throw new Error(target.item.series ? "This episode is unavailable in " + option.label + "." : "This quality has no playable entry.");
  return {
    ...target, item, episodes: target.item.series ? episodes : [], qualityIndex: index,
    episodeNumber: target.item.series ? episodeNumberOf(item) ?? number ?? undefined : undefined,
  };
}

function capability(source: Source, video: HTMLVideoElement) {
  const format = source.format ?? source.probe?.format;
  const codec = source.probe;
  if (codec?.audioCodec && !video.canPlayType('audio/mp4; codecs="' + (codec.audioCodec === "eac3" ? "ec-3" : "ac-3") + '"')) return -1;
  if (source.hls) {
    if (video.canPlayType("application/vnd.apple.mpegurl")) return 1;
    const types = codec?.codecs?.map((entry) => (/^(?:mp4a|ac-3|ec-3)/i.test(entry) ? "audio" : "video") +
      '/mp4; codecs="' + entry + '"') ?? ['video/mp4; codecs="avc1.42E01E"'];
    return typeof MediaSource !== "undefined" && types.every((type) => MediaSource.isTypeSupported(type)) ? 1 : -1;
  }
  if (format === "dash" || format === "avi") return -1;
  const mime = format === "mp4" ? "video/mp4" : format === "mkv" ? "video/x-matroska" : format === "webm" ? "video/webm" : undefined;
  if (!mime) return 0;
  const videoCodec = codec?.videoCodec === "hevc" ? "hvc1.1.6.L120.B0" : codec?.videoCodec === "h264" ? "avc1.640028" : "";
  const type = videoCodec ? mime + '; codecs="' + videoCodec + '"' : mime;
  return video.canPlayType(type) ? 1 : -1;
}

export function orderBrowserSources(sources: Source[], language?: string) {
  if (typeof document === "undefined") return sources;
  const video = document.createElement("video");
  const preference = (source: Source) => language && language !== "none" && streamLanguages(source.languages).includes(language) ? 1 : 0;
  return sources.map((source) => ({ source, capability: capability(source, video), preference: preference(source) }))
    .sort((a, b) => b.capability - a.capability || b.preference - a.preference)
    .map(({ source }) => source);
}

export async function playbackSources(item: PlaybackItem, signal: AbortSignal, language?: string) {
  const list = await providers.sources(item.provider, item.ref, item.series ? "series" : "movie", signal,
    usePlayerPreferences.getState().defaultQuality);
  return orderBrowserSources(list, language);
}
