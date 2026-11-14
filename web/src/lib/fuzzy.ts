// Title normalisation and fuzzy matching used by the Movie Based layout to
// find a TMDB title among provider posts ("Viswanath & Sons" must match
// "Viswanath and Sons" and "Viswanath & Sons 2026").

const STOP = new Set(["the", "a", "an", "of", "and"]);

/** Lower-case, strip accents, "&" -> "and", drop years and punctuation. */
export function normalizeTitle(text: string): string {
  const base = String(text || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ");
  const tidy = (value: string) =>
    value.replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
  const withoutYears = tidy(base.replace(/\b(?:19|20)\d{2}\b/g, " "));
  // A title that is only a year ("1917", "2012") keeps it.
  return withoutYears || tidy(base);
}

/** Same, but without filler words like "the" / "and" (for matching only). */
export function significantTokens(text: string): string[] {
  const tokens = normalizeTitle(text).split(" ").filter(Boolean);
  const filtered = tokens.filter((token) => !STOP.has(token));
  return filtered.length > 0 ? filtered : tokens;
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_v, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= b.length; j += 1) {
      row[j] = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = row;
  }
  return prev[b.length];
}

/** 0..1 similarity from edit distance. */
export function levenshteinSimilarity(a: string, b: string): number {
  const longest = Math.max(a.length, b.length);
  return longest === 0 ? 1 : 1 - levenshtein(a, b) / longest;
}

export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const window = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatch = new Array<boolean>(a.length).fill(false);
  const bMatch = new Array<boolean>(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i += 1) {
    const from = Math.max(0, i - window);
    const to = Math.min(b.length - 1, i + window);
    for (let j = from; j <= to; j += 1) {
      if (bMatch[j] || a[i] !== b[j]) continue;
      aMatch[i] = true;
      bMatch[j] = true;
      matches += 1;
      break;
    }
  }
  if (matches === 0) return 0;
  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < a.length; i += 1) {
    if (!aMatch[i]) continue;
    while (!bMatch[k]) k += 1;
    if (a[i] !== b[k]) transpositions += 1;
    k += 1;
  }
  const jaro =
    (matches / a.length +
      matches / b.length +
      (matches - transpositions / 2) / matches) /
    3;
  let prefix = 0;
  while (prefix < 4 && a[prefix] && a[prefix] === b[prefix]) prefix += 1;
  return jaro + prefix * 0.1 * (1 - jaro);
}

/** Two single words are "the same" despite spelling variants. */
export function tokensMatch(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length < 4 || b.length < 4) return false; // short words must be exact
  return jaroWinkler(a, b) >= 0.92 || levenshtein(a, b) <= (a.length >= 8 ? 2 : 1);
}

/**
 * 0..1 match between a wanted title and a candidate post title: the better of
 * a token-level F-score (tolerant of spelling variants and extra words such
 * as years/quality tags) and a whole-string similarity.
 */
export function fuzzyTitleScore(wanted: string, candidate: string): number {
  const want = significantTokens(wanted);
  const have = significantTokens(candidate);
  if (want.length === 0 || have.length === 0) return 0;

  const usedHave = new Set<number>();
  let hits = 0;
  want.forEach((token) => {
    const index = have.findIndex(
      (other, i) => !usedHave.has(i) && tokensMatch(token, other),
    );
    if (index >= 0) {
      usedHave.add(index);
      hits += 1;
    }
  });
  const recall = hits / want.length;
  const precision = hits / have.length;
  const tokenScore =
    recall === 0 || precision === 0
      ? 0
      : (2 * recall * precision) / (recall + precision);

  // Whole-string similarity rescues joined/split spellings ("spider man" vs
  // "spiderman") but only counts when it is genuinely close, so short unrelated
  // titles ("Jawan" vs "Pathaan") are not matched.
  const whole = levenshteinSimilarity(
    want.join("").replace(/ /g, ""),
    have.join("").replace(/ /g, ""),
  );
  return Math.max(tokenScore, whole >= 0.8 ? whole : 0);
}

/** Search-box variants so provider search engines that choke on "&" or a
 * trailing year still find the title. Most specific first, deduplicated. */
export function searchVariants(title: string): string[] {
  const clean = String(title || "").trim();
  if (!clean) return [];
  const normalized = normalizeTitle(clean);
  const noStop = significantTokens(clean).join(" ");
  const asciiAnd = clean.replace(/&/g, "and").replace(/\s+/g, " ").trim();
  const firstWords = noStop.split(" ").slice(0, 3).join(" ");
  const list = [clean, asciiAnd, normalized, noStop];
  if (firstWords && firstWords !== noStop) list.push(firstWords);
  const seen = new Set<string>();
  return list.filter((query) => {
    const key = query.toLowerCase();
    if (!query || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
