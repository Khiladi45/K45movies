// Providers whose listing pages carry no posters (e.g. 1TamilMV) still know
// the release name, so missing thumbnails are backfilled from TMDB by title.
//
// Backfill must never block rendering: on networks where TMDB is blocked or
// slow, waiting for lookups made Home sit on skeletons indefinitely. Callers
// get the list immediately and receive the poster-enriched list via onUpdate.

import { tmdbConfigured, searchTmdb, tmdbImage } from "./tmdbApi";
import { fuzzyTitleScore } from "./fuzzy";

const cache = new Map<string, string | null>();
const pending = new Map<string, Promise<string | null>>();

const MAX_LOOKUPS = 20;
const CONCURRENCY = 4;
const NETWORK_FAILURE_LIMIT = 3;
const COOLDOWN_MS = 5 * 60_000;

let consecutiveFailures = 0;
let cooldownUntil = 0;

const nameOf = (title: string) =>
  title
    .replace(/\s*\(\d{4}\).*$/, "")
    .replace(/\s+\d{3,4}p.*$/i, "")
    .replace(/\s*-\s*\[.*$/, "")
    .trim();

const yearOf = (title: string) => title.match(/\((\d{4})\)/)?.[1];

const cacheKey = (title: string) =>
  `${nameOf(title).toLowerCase()}|${yearOf(title) || ""}`;

async function lookupPoster(
  title: string,
  signal?: AbortSignal,
): Promise<string | null> {
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

function posterFor(title: string, signal?: AbortSignal): Promise<string | null> {
  const key = cacheKey(title);
  if (cache.has(key)) return Promise.resolve(cache.get(key) ?? null);

  const inflight = pending.get(key);
  if (inflight) return inflight;

  const task = lookupPoster(title, signal)
    .then((poster) => {
      cache.set(key, poster);
      consecutiveFailures = 0;
      return poster;
    })
    .catch((error) => {
      // A cancelled lookup (navigation / provider switch) is not a TMDB
      // outage and must not open the circuit.
      if (!signal?.aborted) {
        consecutiveFailures += 1;
        if (consecutiveFailures >= NETWORK_FAILURE_LIMIT) {
          cooldownUntil = Date.now() + COOLDOWN_MS;
        }
      }
      return null;
    })
    .finally(() => {
      pending.delete(key);
    });

  pending.set(key, task);
  return task;
}

const withCachedPosters = (posts: any[]) =>
  posts.map((post) => {
    if (!post || post.image) return post;
    const poster = cache.get(cacheKey(post.title));
    return poster ? { ...post, image: poster } : post;
  });

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type FillOptions = {
  /** How long to wait for fresh lookups before returning. 0 = immediate. */
  waitMs?: number;
  /** Called with the poster-enriched list once background lookups finish. */
  onUpdate?: (posts: any[]) => void;
};

export const fillMissingPosters = async (
  posts: any[],
  signal?: AbortSignal,
  options: FillOptions = {},
): Promise<any[]> => {
  if (!Array.isArray(posts) || posts.length === 0 || !tmdbConfigured()) {
    return posts;
  }

  const initial = withCachedPosters(posts);
  if (Date.now() < cooldownUntil) return initial;

  const seen = new Set<string>();
  const queue = initial
    .filter((post) => post && !post.image)
    .filter((post) => {
      const key = cacheKey(post.title);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_LOOKUPS);

  if (queue.length === 0) return initial;

  let cursor = 0;
  const run = Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      while (cursor < queue.length) {
        const post = queue[cursor++];
        await posterFor(post.title, signal);
      }
    }),
  ).then(() => {
    options.onUpdate?.(withCachedPosters(posts));
  });

  if (!options.waitMs) return initial;
  await Promise.race([run, delay(options.waitMs)]);
  return withCachedPosters(posts);
};
