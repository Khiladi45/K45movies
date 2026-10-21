import { Platform, TextStyle } from "react-native";
import type { Preferences } from "@/store/usePreferencesStore";

export type SubtitleFont = "system" | "serif" | "monospace" | "rounded";
export type SubtitleWeight = "400" | "600" | "800";
export type SubtitleAlign = "left" | "center" | "right";

export type SubtitleCue = {
  start: number;
  end: number;
  text: string;
};

export const SUBTITLE_LANGUAGES: { label: string; value: string }[] = [
  { label: "Auto", value: "auto" },
  { label: "English", value: "en" },
  { label: "Tamil", value: "ta" },
  { label: "Telugu", value: "te" },
  { label: "Hindi", value: "hi" },
  { label: "Malayalam", value: "ml" },
  { label: "Kannada", value: "kn" },
  { label: "Bengali", value: "bn" },
  { label: "Marathi", value: "mr" },
  { label: "Urdu", value: "ur" },
  { label: "Spanish", value: "es" },
  { label: "French", value: "fr" },
];

export const SUBTITLE_FONTS: { label: string; value: SubtitleFont }[] = [
  { label: "System", value: "system" },
  { label: "Serif", value: "serif" },
  { label: "Mono", value: "monospace" },
  { label: "Rounded", value: "rounded" },
];

export const SUBTITLE_WEIGHTS: { label: string; value: SubtitleWeight }[] = [
  { label: "Regular", value: "400" },
  { label: "Semibold", value: "600" },
  { label: "Bold", value: "800" },
];

export const SUBTITLE_ALIGNS: { label: string; value: SubtitleAlign }[] = [
  { label: "Left", value: "left" },
  { label: "Center", value: "center" },
  { label: "Right", value: "right" },
];

export const SUBTITLE_TEXT_COLORS = [
  "#FFFFFF",
  "#FFF3C4",
  "#FFE45E",
  "#A5F3FC",
  "#BBF7D0",
  "#FBCFE8",
];

export const SUBTITLE_BACKGROUNDS = [
  "#000000",
  "#1E293B",
  "#172554",
  "#3F1D1D",
  "#143A2B",
  "#422006",
];

export const subtitleFontFamily = (font: SubtitleFont): string | undefined => {
  if (font === "serif") {
    return Platform.OS === "ios" ? "Georgia" : "serif";
  }
  if (font === "monospace") {
    return Platform.OS === "ios" ? "Menlo" : "monospace";
  }
  if (font === "rounded") {
    return Platform.OS === "ios" ? "Arial Rounded MT Bold" : "sans-serif-rounded";
  }
  return undefined;
};

export const hexToRgba = (hex: string, opacity: number): string => {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  const alpha = Math.min(1, Math.max(0, opacity));
  if (!match) return `rgba(0,0,0,${alpha})`;
  const value = parseInt(match[1], 16);
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha})`;
};

type SubtitleStylePreferences = Pick<
  Preferences,
  | "subtitleSize"
  | "subtitleFont"
  | "subtitleWeight"
  | "subtitleColor"
  | "subtitleBackground"
  | "subtitleBackgroundOpacity"
  | "subtitleShadow"
  | "subtitleAlign"
>;

/** Shared by the player overlay and the Preferences live preview. */
export const subtitleTextStyle = (
  prefs: SubtitleStylePreferences,
  scale = 1,
): TextStyle => {
  const size = Math.max(9, Math.round(prefs.subtitleSize * scale));
  const padding = Math.max(1, Math.round(5 * Math.max(0.55, scale)));
  return {
    color: prefs.subtitleColor,
    fontSize: size,
    lineHeight: Math.round(size * 1.32),
    fontWeight: prefs.subtitleWeight,
    fontFamily: subtitleFontFamily(prefs.subtitleFont),
    textAlign: prefs.subtitleAlign,
    backgroundColor: hexToRgba(
      prefs.subtitleBackground,
      prefs.subtitleBackgroundOpacity,
    ),
    paddingHorizontal: padding * 2,
    paddingVertical: padding,
    borderRadius: Math.round(6 * Math.max(0.55, scale)),
    overflow: "hidden",
    ...(prefs.subtitleShadow > 0
      ? {
          textShadowColor: "rgba(0,0,0,0.95)",
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: prefs.subtitleShadow,
        }
      : {}),
  };
};

const decodeEntities = (text: string) =>
  text
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&#x0*27;/gi, "'")
    .replace(/&amp;/gi, "&");

const stripCueMarkup = (lines: string[]): string =>
  decodeEntities(
    lines
      .join("\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]*>/g, "")
      .replace(/\{\\[^}]*\}/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n"),
  ).trim();

const vttTimeToSeconds = (value: string): number => {
  const clean = value.trim().replace(",", ".");
  const parts = clean.split(":").map((part) => Number(part));
  if (parts.some((part) => !Number.isFinite(part))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return 0;
};

export const parseVttCues = (source: string): SubtitleCue[] => {
  const blocks = source
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/);
  const cues: SubtitleCue[] = [];

  for (const block of blocks) {
    let lines = block.split("\n");
    if (/^WEBVTT/i.test(lines[0]?.trim() || "")) lines = lines.slice(1);
    if (lines.every((line) => !line.trim())) continue;
    if (/^(NOTE|STYLE|REGION)\b/i.test(lines[0].trim())) continue;

    const timingIndex = lines.findIndex((line) => line.includes("-->"));
    if (timingIndex < 0) continue;

    const [startRaw, endRaw] = lines[timingIndex].split("-->");
    const start = vttTimeToSeconds(startRaw || "");
    const end = vttTimeToSeconds((endRaw || "").trim().split(/\s+/)[0] || "");
    if (!(end > start)) continue;

    const text = stripCueMarkup(lines.slice(timingIndex + 1));
    if (!text) continue;
    cues.push({ start, end, text });
  }

  return cues.sort((a, b) => a.start - b.start);
};

export const cueAt = (
  cues: SubtitleCue[],
  time: number,
): SubtitleCue | null => {
  if (cues.length === 0 || !Number.isFinite(time)) return null;
  let low = 0;
  let high = cues.length - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (cues[mid].start <= time) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  // Walk back a few entries so overlapping cues still resolve.
  for (let i = found; i >= 0 && i > found - 4; i--) {
    if (time >= cues[i].start && time <= cues[i].end) return cues[i];
  }
  return null;
};
