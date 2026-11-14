import { providers } from "./catalog-api";
import type { Episode, LinkGroup, Post, ProviderDetail, TitleDetail } from "./catalog-types";
import { fuzzyTitleScore, normalizeTitle, searchVariants } from "./fuzzy";
import { normalizeLangCode, TEXT_LANGUAGE_ABBREVIATIONS, TEXT_LANGUAGE_NAMES } from "./languages";

export type Choice = { provider: string; episode: Episode; episodes: Episode[]; label: string; languages: string[] };
export type Match = { post: Post; detail: ProviderDetail };
const noise = new Set("download watch movie series season episode web dl hd fhd uhd webrip bluray hevc x264 x265 multi dual audio dubbed esub aac hdr complete".split(" "));

function score(title: TitleDetail, post: Post) {
  const core = normalizeTitle(post.title).split(" ").filter((term) =>
    !noise.has(term) && !TEXT_LANGUAGE_NAMES[term] && !/^(?:s\d+(?:e\d+)?|e\d+|\d{3,4}p|\d+gb)$/.test(term)
  ).join(" ");
  const match = Math.max(fuzzyTitleScore(title.title, core), fuzzyTitleScore(title.originalTitle, core),
    fuzzyTitleScore(title.title, post.title));
  const years = post.title.match(/\b(?:19|20)\d{2}\b/g);
  return title.mediaType === "movie" && title.year && years &&
    !years.some((year) => Math.abs(Number(year) - Number(title.year)) <= 1) ? match / 2 : match;
}

export async function matchProvider(provider: string, title: TitleDetail, signal: AbortSignal) {
  const variations = Array.from(new Set([...searchVariants(title.title), ...searchVariants(title.originalTitle)]))
    .filter((query) => query.length >= 2 && query.length <= 120).slice(0, 4);
  const candidates = new Map<string, Post>();
  const threshold = title.mediaType === "movie" ? 0.6 : 0.55;
  let success = false;
  let failure: unknown;
  for (const query of variations) {
    signal.throwIfAborted();
    try {
      const posts = await providers.search(provider, query, signal);
      success = true;
      for (const post of posts) if (score(title, post) >= threshold) candidates.set(post.ref, post);
    } catch (error) { failure = error; }
    if ([...candidates.values()].some((post) => score(title, post) > 0.96)) break;
  }
  if (!success && failure) throw failure;
  const ranked = [...candidates.values()].sort((a,b) => score(title,b) - score(title,a)).slice(0, title.mediaType === "movie" ? 2 : 4);
  const details = await Promise.allSettled(ranked.map(async (post) => ({ post, detail: await providers.title(provider, post.ref, signal) })));
  signal.throwIfAborted();
  if (details.length && details.every((entry) => entry.status === "rejected")) {
    const first = details[0];
    if (first.status === "rejected") throw first.reason;
  }
  return details.flatMap((entry): Match[] => {
    if (entry.status !== "fulfilled") return [];
    const type = entry.value.detail.type?.toLowerCase();
    if (title.mediaType === "movie" && /series|tv|show/.test(type ?? "")) return [];
    if (title.mediaType === "tv" && type === "movie") return [];
    return entry.value.detail.groups.length ? [entry.value] : [];
  });
}

export function detectAudio(label: string) {
  const clean = label.toLowerCase().replace(/\b(?:[a-z]+\s+)?(?:subs?|subtitles?|esubs?)\b/g, " ");
  const named = clean.split(/[^a-z]+/).flatMap((word) => TEXT_LANGUAGE_NAMES[word] ?? []);
  const abbreviations = [...clean.matchAll(/[[(]([^\])]{2,40})[\])]/g)].flatMap((match) => {
    const words = match[1].split(/[\s+&,/|\-]+/).filter(Boolean);
    if (!words.every((word) => TEXT_LANGUAGE_ABBREVIATIONS[word] || TEXT_LANGUAGE_NAMES[word] || ["dual", "multi", "audio"].includes(word))) return [];
    return words.flatMap((word) => TEXT_LANGUAGE_ABBREVIATIONS[word] ?? []);
  });
  return [...new Set([...named, ...abbreviations])];
}

export const streamLanguages = (values: string[]) => [...new Set(values.flatMap((value) => {
  const code = normalizeLangCode(value);
  return code ? [code] : detectAudio(value);
}))];

export function episodeNumber(title: string) {
  const match = /(?:s\d{1,2}\s*[-._]?)?\be(?:p(?:isode)?)?\s*[-._:#]?\s*(\d{1,4})\b|s\d{1,2}e(\d{1,4})\b|^\s*#?(\d{1,4})\b/i.exec(title);
  return match ? Number(match[1] || match[2] || match[3]) : undefined;
}

export function seasonNumber(title: string) {
  const match = /\bs(?:eason)?\s*[-._]?\s*(\d{1,2})(?:\b|e\d)/i.exec(title);
  return match ? Number(match[1]) : undefined;
}

export async function groupEpisodes(provider: string, group: LinkGroup, signal: AbortSignal) {
  return group.episodesRef ? providers.episodes(provider, group.episodesRef, signal) : group.directLinks;
}

export async function choicesFor(provider: string, matches: Match[], season: number, episode: number, seasons: number, signal: AbortSignal) {
  const output = new Map<string, Choice>();
  let failure: unknown;
  for (const match of matches) {
    for (const group of match.detail.groups) {
      const groupSeason = seasonNumber(group.title) ?? seasonNumber(match.post.title);
      if (season && (groupSeason !== undefined ? groupSeason !== season : season !== 1 && seasons > 1)) continue;
      signal.throwIfAborted();
      let items: Episode[];
      try {
        items = await groupEpisodes(provider, group, signal);
      } catch (error) {
        failure = error;
        continue;
      }
      const episodes = episode ? items : [];
      if (episode) {
        const exact = items.find((item) => episodeNumber(item.title) === episode);
        const selected = exact ?? (items.every((item) => episodeNumber(item.title) === undefined) ? items[episode - 1] : undefined);
        items = selected ? [selected] : [];
      }
      for (const item of items) {
        const label = group.quality || group.title || item.title;
        const languages = detectAudio([label, item.title, match.post.title].join(" "));
        if (!output.has(item.ref)) output.set(item.ref, { provider, episode: item, episodes, label, languages });
      }
    }
  }
  signal.throwIfAborted();
  if (!output.size && failure) throw failure;
  return [...output.values()];
}
