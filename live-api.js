const root = "https://raw.githubusercontent.com/Khiladi45/K45movies-api/main/";
const bridge = "clmdkafdliblcnolllgpholokkololjb";
const registry = fetch(root + "manifest.json", { signal: AbortSignal.timeout(12000) }).then(async (response) => {
  if (!response.ok) throw new Error("Unable to load provider manifest.");
  const manifest = await response.json();
  return manifest.providers.filter(({ id }) => !["vega", "youtube", "moviesApi"].includes(id));
});
registry.catch(() => {});

export const manifest = () => registry;
export function provider(op, args = {}) {
  return new Promise((resolve, reject) => {
    if (!globalThis.chrome?.runtime?.sendMessage) {
      reject(Object.assign(new Error("Install the K45movies Browser Bridge, then reload this page."), { bridgeMissing: true }));
      return;
    }
    const timer = setTimeout(() => reject(new Error("The provider timed out. Please retry.")), op === "media" ? 18000 : 30000);
    globalThis.chrome.runtime.sendMessage(bridge, { op, ...args }, (response) => {
      clearTimeout(timer);
      if (globalThis.chrome.runtime.lastError || !response) {
        reject(Object.assign(new Error("Install or reload the K45movies Browser Bridge, then reload this page."), { bridgeMissing: true }));
      } else if (!response.ok) reject(Object.assign(new Error(response.error), { needsAccess: response.needsAccess === true }));
      else resolve(response.data);
    });
  });
}

const keyName = "k45-pages-tmdb";
export const tmdbKey = () => localStorage.getItem(keyName) ?? "";
export function saveTmdbKey(value) {
  if (value && !/^[a-f0-9]{32}$/i.test(value)) throw new Error("Enter a TMDB v3 API key.");
  if (value) localStorage.setItem(keyName, value);
  else localStorage.removeItem(keyName);
}

export async function tmdb(path, parameters = {}) {
  const key = tmdbKey();
  if (!key) throw new Error("Add your TMDB v3 API key in Settings to browse Movie Based.");
  const query = new URLSearchParams({ ...parameters, api_key: key, language: "en-US" });
  const response = await fetch("https://api.themoviedb.org/3/" + path + "?" + query, {
    signal: AbortSignal.timeout(12000),
  });
  if (response.status === 401) throw new Error("TMDB rejected the API key. Check Settings.");
  if (!response.ok) throw new Error("TMDB request failed (" + response.status + ").");
  return response.json();
}

export function tmdbTitle(raw, fallback) {
  const type = raw.media_type ?? fallback;
  if (type !== "movie" && type !== "tv") return null;
  return {
    name: raw.title ?? raw.name,
    original: raw.original_title ?? raw.original_name,
    kind: "tmdb", type, id: raw.id,
    image: raw.poster_path ? "https://image.tmdb.org/t/p/w342" + raw.poster_path : "",
    poster: raw.poster_path ? "https://image.tmdb.org/t/p/w500" + raw.poster_path : "",
    backdrop: raw.backdrop_path ? "https://image.tmdb.org/t/p/w1280" + raw.backdrop_path : "",
    year: (raw.release_date ?? raw.first_air_date ?? "").slice(0, 4),
    synopsis: raw.overview,
  };
}
