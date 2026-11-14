const yearPattern = /\b(?:19|20)\d{2}\b/;
const releaseWords = /^(?:tamil|telugu|malayalam|hindi|kannada|english|dubbed|multi|audio|web|hdrip|webdl|webrip|bluray|hd|fhd|\d{3,4}p|x26[45]|hevc|full|movie|\d+)(?: |$)/;
const normalized = (title) => title.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "")
  .replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export function titleIdentity(title) {
  const year = title.match(yearPattern)?.[0];
  return { name: normalized(title.split(yearPattern)[0] || title), year };
}

export function sameMovie(entry, candidate) {
  const identity = titleIdentity(entry.name);
  const other = titleIdentity(candidate);
  const year = entry.year || identity.year;
  if (!year || other.year !== year || !identity.name) return false;
  if (candidate.search(/\b(?:season|episode|s\d{2}e\d{2})\b/i) >= 0) return false;
  return [identity.name, entry.original && titleIdentity(entry.original).name].some((name) =>
    name && (other.name === name || (other.name.startsWith(name + " ") && releaseWords.test(other.name.slice(name.length + 1)))));
}

export async function firstAvailable(items, load) {
  for (const item of items) {
    try {
      const value = await load(item);
      if (value?.length) return { item, value };
    } catch (error) {
      if (error.needsAccess || error.bridgeMissing) throw error;
    }
  }
  return null;
}
