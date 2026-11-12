// Sizes for the 10-foot UI. Android TVs report ~960x540 dp at 1080p, so these
// are dp values chosen to read comfortably from a sofa.
export const TV = {
  safeX: 28, // horizontal TV-safe margin
  safeY: 20,
  navWidth: 64,
  poster: { width: 104, height: 156 },
  wide: { width: 196, height: 110 },
  gap: 12,
  radius: 8,
  focusScale: 1.07,
  text: {
    hero: 30,
    title: 22,
    row: 15,
    body: 13,
    small: 11,
  },
  // Provider Based layout (Phase 2): provider chips, row/page caps.
  providerChip: { width: 132, height: 44 },
  rowLimit: 20, // posters per home row before the "See all" card
  bg: "#0b0b0b",
  surface: "#1a1a1a",
  muted: "rgba(255,255,255,0.6)",
};
