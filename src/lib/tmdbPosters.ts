// Providers whose listing pages carry no posters (e.g. 1TamilMV) still know
// the release name, so missing thumbnails are backfilled from TMDB by title.

import { tmdbConfigured, searchTmdb, tmdbImage } from "./tmdbApi";
import { fuzzyTitleScore } from "./fuzzy";

const cache = new Map<string, string | null>();
const MAX_LOOKUPS = 30;
const CONCURRENCY = 6;

const nameOf = (title: string) =>
  title
    .replace(/\s*\(\d{4}\).*$/, "")
    .replace(/\s+\d{3,4}p.*$/i, "")
    .replace(/\s*-\s*\[.*$/, "")
    .trim();

const yearOf = (title: string) => title.match(/\((\d{4})\)/)?.[1];

async function posterFor(title: string, signal?: AbortSignal): Promise<string | null> {
  const name = nameOf(title);
  if (!name) return null;

  const results = await searchTmdb(name, signal);
  const year = yearOf(title);
  let best: { poster: string | null; title: string; year: string } | null = null;
  let bestScore = 0;
  for (const item of results.slice(0, 8)) {
    let score = fuzzyTitleScore(name, item.title || item.originalTitle);
    if (year && item.year) {
      score += Math.abs(Number(year) - Number(item.year)) <= 1 ? 0.2 : -0.3;
    }
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  if (!best || bestScore < 0.6) return null;
  return tmdbImage(best.poster, "w342");
}

export const fillMissingPosters = async (
  posts: any[],
  signal?: AbortSignal,
): Promise<any[]> => {
  if (!Array.isArray(posts) || posts.length === 0 || !tmdbConfigured()) {
    return posts;
  }

  const missing = posts.filter((p) => p && !p.image && !cache.has(p.title));
  const queue = missing.slice(0, MAX_LOOKUPS);

  let cursor = 0;
  const worker = async () => {
    while (cursor < queue.length) {
      const post = queue[cursor++];
      try {
        cache.set(post.title, await posterFor(post.title, signal));
      } catch {
        cache.set(post.title, null);
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker),
  );

  return posts.map((p) =>
    p && !p.image && cache.get(p.title) ? { ...p, image: cache.get(p.title)! } : p,
  );
};
