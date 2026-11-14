type CaptionCue = { start: number; end: number; text: string };

function seconds(clock: string) {
  return clock.replace(",", ".").split(":").reduce((sum, part) => sum * 60 + Number(part), 0);
}

export function parseCues(input: string): CaptionCue[] {
  return input.replace(/\r/g, "").split(/\n\s*\n/).flatMap((block) => {
    const lines = block.split("\n");
    const index = lines.findIndex((line) => line.includes("-->"));
    if (index < 0) return [];
    const match = lines[index].match(/^\s*([\d:.,]+)\s*-->\s*([\d:.,]+)/);
    if (!match) return [];
    const start = seconds(match[1]);
    const end = seconds(match[2]);
    const text = lines.slice(index + 1).join("\n").replace(/<[^>]*>/g, "");
    return Number.isFinite(start) && end > start && text ? [{ start, end, text }] : [];
  }).sort((a, b) => a.start - b.start);
}
