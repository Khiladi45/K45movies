// Which layout is active, phone vs TV (no imports, unit-tested).
//
// Phones: "provider" by default, otherwise what was saved (unchanged logic).
// TV: "movie" unless a layout was chosen ON THE TV (tvLayoutChosen). The store
// persists its whole state on any change, so older TV installs can have
// layout "provider" saved without anyone choosing it; those stay on Movie.

export type AppLayoutName = "provider" | "movie" | "youtube";

export const PHONE_DEFAULT_LAYOUT: AppLayoutName = "provider";
export const TV_DEFAULT_LAYOUT: AppLayoutName = "movie";

const isLayout = (value: unknown): value is AppLayoutName =>
  value === "provider" || value === "movie" || value === "youtube";

export function resolveLayout(
  saved: { layout?: unknown; tvLayoutChosen?: unknown } | null | undefined,
  isTv: boolean,
): AppLayoutName {
  if (!isTv) {
    // Exactly the phone's previous merge: "movie"/"youtube" kept, else "provider".
    return saved?.layout === "movie" || saved?.layout === "youtube"
      ? saved.layout
      : PHONE_DEFAULT_LAYOUT;
  }
  return saved?.tvLayoutChosen === true && isLayout(saved.layout)
    ? saved.layout
    : TV_DEFAULT_LAYOUT;
}
