// Date range for "new releases" rows (no imports, unit-tested).

const ymd = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

/** {from, to} as YYYY-MM-DD: the last `days` days up to and including today. */
export function releaseWindow(today: Date, days: number): { from: string; to: string } {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - days);
  return { from: ymd(start), to: ymd(today) };
}

/** Rated titles first (best rating first), then the rest in their order. */
export function bestRatedFirst<T extends { id: number; rating: number }>(
  rated: T[],
  others: T[],
): T[] {
  const seen = new Set<number>();
  const out: T[] = [];
  [...rated]
    .filter((item) => item.rating > 0)
    .sort((a, b) => b.rating - a.rating)
    .forEach((item) => {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        out.push(item);
      }
    });
  [...rated, ...others].forEach((item) => {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      out.push(item);
    }
  });
  return out;
}
