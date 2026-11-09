// Friendly lines for the playback loading screen (no imports, unit-tested).

export type LoaderStage = "source" | "servers" | "audio" | "buffering";

/** Step labels, in order. */
export function loaderSteps(languageName: string | null): { key: LoaderStage; label: string }[] {
  return [
    { key: "source", label: "Finding the source" },
    { key: "servers", label: "Checking servers" },
    {
      key: "audio",
      label: languageName ? `Choosing HD · ${languageName} audio` : "Choosing the best HD stream",
    },
    { key: "buffering", label: "Buffering video" },
  ];
}

const LINES: Record<LoaderStage, string[]> = {
  source: [
    "Looking for this title on your providers…",
    "Opening the best match…",
    "Getting the stream links…",
  ],
  servers: [
    "Picking the fastest server…",
    "Skipping servers that don't respond…",
    "Testing the HD links…",
  ],
  audio: [
    "Matching your audio language…",
    "Choosing HD quality for a quick start…",
  ],
  buffering: [
    "Loading the first seconds of video…",
    "Almost there…",
    "Starting playback…",
  ],
};

/**
 * The line to show now. Rotates every `everyMs`; after 15s it reassures that
 * a slow server is still being tried.
 */
export function loaderLine(
  stage: LoaderStage,
  elapsedMs: number,
  languageName: string | null,
  everyMs = 2500,
): string {
  if (elapsedMs >= 15000) {
    return elapsedMs >= 30000
      ? "Still trying — if it doesn't start, the player will switch servers."
      : "This server is slow, still trying…";
  }
  const lines = [...LINES[stage]];
  if (stage === "audio" && languageName) lines.unshift(`Getting ${languageName} audio ready…`);
  const index = Math.floor(Math.max(0, elapsedMs) / everyMs) % lines.length;
  return lines[index];
}
