// Auto screen fit for the player (no imports, unit-tested with plain Node).

/** Up to this relative shape difference the picture is stretched to fill. */
export const AUTO_STRETCH_TOLERANCE = 0.08;

/**
 * "stretch" when the video's shape is close to the screen's (fills the screen
 * with no thin bars and no visible distortion), otherwise "fit" (whole picture,
 * black bars). Unknown video size → "fit".
 */
export function autoFit(
  videoAspect: number | null | undefined,
  screenAspect: number,
): "stretch" | "fit" {
  if (!videoAspect || !(videoAspect > 0) || !(screenAspect > 0)) return "fit";
  const diff = Math.abs(videoAspect - screenAspect) / screenAspect;
  return diff <= AUTO_STRETCH_TOLERANCE ? "stretch" : "fit";
}

/** Screen-fit mode that stretches only the height. */
export const HEIGHT_120 = "height120";

/** Zoom (uniform) or fill (stretched) the picture so no black bars show. */
export const FILL_NO_BARS = "fillNoBars";

/**
 * Many files are 16:9 with a 2.39:1 film letterboxed inside (the black bars
 * are part of the picture). 16/9 ÷ 2.39 ≈ 0.744 → ×1.34 hides those bars.
 */
export const BAKED_BARS_ZOOM = 1.34;
/** Most a wide film is stretched in height (beyond this it looks wrong). */
export const MAX_HEIGHT_STRETCH = 1.6;
const WIDE_TOLERANCE = 0.03;

export type FitTransform = { resize: "contain" | "cover"; scaleX: number; scaleY: number };

/**
 * Size/transform for the two "no black bars" modes; null for every other mode.
 *  - FILL_NO_BARS: a wide film (2.39:1 etc.) is zoomed to cover the screen,
 *    keeping its shape (left/right edges cropped). A 16:9 file — whose bars are
 *    usually baked into the picture — is zoomed ×1.34 to hide them.
 *  - HEIGHT_120 ("Height fill"): the width stays, the height is stretched
 *    until the bars are gone (wide film: exactly to the screen, at most ×1.6;
 *    16:9 file with baked-in bars: ×1.34). Nothing is cropped left/right.
 */
export function fitTransform(
  aspectKey: unknown,
  videoAspect: number | null | undefined,
  screenAspect: number,
): FitTransform | null {
  if (aspectKey !== FILL_NO_BARS && aspectKey !== HEIGHT_120) return null;
  const known = !!videoAspect && videoAspect > 0 && screenAspect > 0;
  const wide = known && (videoAspect as number) > screenAspect * (1 + WIDE_TOLERANCE);
  const narrow = known && (videoAspect as number) < screenAspect * (1 - WIDE_TOLERANCE);
  if (aspectKey === FILL_NO_BARS) {
    if (wide || narrow) return { resize: "cover", scaleX: 1, scaleY: 1 };
    return { resize: "contain", scaleX: BAKED_BARS_ZOOM, scaleY: BAKED_BARS_ZOOM };
  }
  if (wide) {
    const stretch = Math.min(MAX_HEIGHT_STRETCH, (videoAspect as number) / screenAspect);
    return { resize: "contain", scaleX: 1, scaleY: stretch };
  }
  return { resize: "contain", scaleX: 1, scaleY: BAKED_BARS_ZOOM };
}

/** Kept for older callers: vertical stretch of a 16:9 picture in Height mode. */
export function scaleYFor(aspectKey: unknown): number {
  return aspectKey === HEIGHT_120 ? BAKED_BARS_ZOOM : 1;
}
