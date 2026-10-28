import type { PlayerEpisode } from "@/store/usePlayerStore";

// Strips things that look like numbers but are not episode numbers
// (resolutions, codecs, sizes, years, "Season N").
const clean = (title: string) =>
  title
    .replace(/\bseason\s*\d+\b/gi, " ")
    .replace(/\b\d{3,4}p\b/gi, " ")
    .replace(/\b\d(?:\.\d+)?\s?k\b/gi, " ")
    .replace(/\b(?:x|h\.?)\s?26[45]\b/gi, " ")
    .replace(/\b\d+(?:\.\d+)?\s?(?:gb|mb|kbps|mbps)\b/gi, " ")
    .replace(/\b(?:19|20)\d{2}\b/g, " ")
    .replace(/\b10\s?bit\b/gi, " ");

/**
 * Episode number from a list title: "Episode 3", "Ep.03", "E03", "S01E03",
 * "03 - Name", "3". Returns null when no sensible number is present.
 */
export function parseEpisodeNumber(title?: string | null): number | null {
  if (!title) return null;
  const text = clean(String(title));

  const sxe = text.match(/\bs\d{1,2}\s*[._-]?\s*e(?:p(?:isode)?)?\s*[._-]?\s*(\d{1,4})\b/i);
  if (sxe) return Number(sxe[1]);

  const word = text.match(/\b(?:episode|ep)\s*[._#:-]?\s*(\d{1,4})\b/i);
  if (word) return Number(word[1]);

  const short = text.match(/\be(\d{1,4})\b/i);
  if (short) return Number(short[1]);

  const leading = text.match(/^\s*#?\s*(\d{1,4})\b/);
  if (leading) return Number(leading[1]);

  const any = text.match(/\b(\d{1,3})\b/);
  return any ? Number(any[1]) : null;
}

export function parseSeasonNumber(title?: string | null): number | null {
  if (!title) return null;
  const match = String(title).match(/\bs(?:eason)?\s*[._-]?\s*0*(\d{1,2})\b/i);
  return match ? Number(match[1]) : null;
}

export function toPlayerEpisodes(
  items: { title?: string; link?: string; type?: string }[] | null | undefined,
): PlayerEpisode[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item && item.link)
    .map((item) => ({
      title: String(item.title || ""),
      link: String(item.link),
      type: item.type,
      number: parseEpisodeNumber(item.title),
    }));
}

/** Ascending by episode number when every title has one, else list order. */
export function orderEpisodes(episodes: PlayerEpisode[]): PlayerEpisode[] {
  if (episodes.length > 1 && episodes.every((ep) => ep.number != null)) {
    return [...episodes].sort((a, b) => (a.number as number) - (b.number as number));
  }
  return episodes;
}

export function episodeLabel(ep: PlayerEpisode | undefined, fallbackIndex = 0) {
  if (ep?.number != null) return `Episode ${ep.number}`;
  if (ep?.title) return ep.title;
  return `Episode ${fallbackIndex + 1}`;
}

/** Same episode number in another quality's list (falls back to same position). */
export function findSameEpisode(
  episodes: PlayerEpisode[],
  number: number | null | undefined,
  fallbackIndex: number,
): PlayerEpisode | undefined {
  if (number != null) {
    const hit = episodes.find((ep) => ep.number === number);
    if (hit) return hit;
    // The list is numbered but this episode is missing: do not guess.
    if (episodes.some((ep) => ep.number != null)) return undefined;
  }
  return episodes[fallbackIndex];
}

/** The episode after the current one, or undefined on the last episode. */
export function findNextEpisode(
  episodes: PlayerEpisode[],
  number: number | null | undefined,
  currentLink?: string,
): PlayerEpisode | undefined {
  const ordered = orderEpisodes(episodes);
  if (ordered.length < 2) return undefined;
  if (number != null && ordered.every((ep) => ep.number != null)) {
    return ordered.find((ep) => (ep.number as number) > number);
  }
  const index = ordered.findIndex((ep) => ep.link === currentLink);
  return index >= 0 ? ordered[index + 1] : undefined;
}
