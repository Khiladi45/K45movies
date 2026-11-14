export const accents = [
  { group: "Popular", colors: [
    ["Orange", "#F97316"], ["Royal Blue", "#2563EB"], ["Emerald", "#10B981"], ["Purple", "#A855F7"], ["Rose", "#E11D48"],
  ] },
  { group: "Vibrant", colors: [
    ["Crimson", "#FF0033"], ["Coral", "#FF6B6B"], ["Ocean", "#007AFF"], ["Gold", "#F59E0B"], ["Lime", "#84CC16"],
    ["Teal", "#14B8A6"], ["Cyan", "#06B6D4"], ["Sky", "#0EA5E9"], ["Indigo", "#6366F1"], ["Violet", "#8B5CF6"],
  ] },
  { group: "Soft", colors: [
    ["Pink", "#EC4899"], ["Magenta", "#D946EF"], ["Slate", "#64748B"], ["Mint", "#34D399"], ["Mellow", "#FACC15"],
    ["Lavender", "#C4B5FD"], ["Peach", "#FDBA74"], ["Blush", "#FDA4AF"], ["Sage", "#A3B18A"], ["Ice", "#BAE6FD"],
  ] },
] as const;
export const defaultAccent = "#8B5CF6";

export function isAccent(color: unknown): color is string {
  return accents.some(({ colors }) => colors.some(([, hex]) => hex === color));
}
