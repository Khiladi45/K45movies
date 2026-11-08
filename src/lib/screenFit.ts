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
