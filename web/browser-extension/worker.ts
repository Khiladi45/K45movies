import * as cheerio from "cheerio/slim";
import { z } from "zod";
import { HostAccess, httpsUrl, providerFetch, providerHttp } from "./network";
import bundles from "pinned-providers";

type Bundle = Record<string, unknown>;
const loaders: Record<string, () => Promise<Bundle>> = bundles;
const pageRoot = "/K45movies/";
const pageOrigin = "https://khiladi45.github.io";

const id = z.string().regex(/^[a-zA-Z0-9_-]{1,65}$/);
const link = z.string().min(1).max(6000).refine((value) => {
  if (/^castle:\/\/(?:media|season|play)\/[a-zA-Z0-9_%.-]+$/.test(value)) return true;
  if (value.startsWith("//")) return false;
  if (value.startsWith("/")) return !value.includes("\\");
  try { httpsUrl(value); return true; } catch { return false; }
});
const request = z.discriminatedUnion("op", [
  z.object({ op: z.literal("ping") }),
  z.object({ op: z.literal("media"), ticket: z.string().uuid(), url: z.string().url().max(6000),
    start: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
    end: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional() }),
  z.object({ op: z.literal("catalog"), id }),
  z.object({ op: z.literal("posts"), id, filter: z.string().max(300), page: z.number().int().min(1).max(100) }),
  z.object({ op: z.literal("search"), id, q: z.string().min(2).max(120) }),
  z.object({ op: z.literal("title"), id, link }),
  z.object({ op: z.literal("episodes"), id, link }),
  z.object({ op: z.literal("sources"), id, link, series: z.boolean() }),
]);
const methods = { posts: "getPosts", search: "getSearchPosts", title: "getMeta", episodes: "getEpisodes", sources: "getStream" } as const;
const own = (value: unknown): Record<string, unknown> => value && typeof value === "object" ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === "string" ? value : undefined;
const list = (value: unknown) => Array.isArray(value) ? value.slice(0, 300) as unknown[] : [];

function categories(bundle: Bundle) {
  return list(bundle.catalog).flatMap((value) => {
    const item = own(value);
    const title = text(item.title);
    const filter = text(item.filter) ?? text(item.id);
    return title && filter !== undefined ? [{ title, filter }] : [];
  });
}

function entries(value: unknown) {
  return list(value).flatMap((value) => {
    const item = own(value);
    const ref = link.safeParse(item.link);
    return ref.success ? [{ title: text(item.title) ?? "Play", link: ref.data, image: text(item.image), type: text(item.type) }] : [];
  });
}

const mediaTickets = new Map<string, { urls: Set<string>; expires: number }>();

function mediaTicket(url: string) {
  for (const [key, entry] of mediaTickets) if (entry.expires <= Date.now()) mediaTickets.delete(key);
  if (mediaTickets.size >= 100) mediaTickets.delete(mediaTickets.keys().next().value!);
  const key = crypto.randomUUID();
  mediaTickets.set(key, { urls: new Set([url]), expires: Date.now() + 3 * 60 * 60_000 });
  return key;
}

async function media(input: Extract<z.infer<typeof request>, { op: "media" }>) {
  const entry = mediaTickets.get(input.ticket);
  const url = httpsUrl(input.url).href;
  if (!entry || entry.expires <= Date.now() || !entry.urls.has(url)) throw new Error("Refresh the playback source.");
  const headers = new Headers();
  if (input.start !== undefined) {
    if (input.end === undefined || input.end <= input.start || input.end - input.start > 8 * 1024 * 1024) {
      throw new Error("Invalid media range.");
    }
    headers.set("Range", "bytes=" + input.start + "-" + (input.end - 1));
  }
  const response = await providerFetch(url, { headers });
  if (!response.ok || !response.body) throw new Error("Media request failed.");
  if (input.start !== undefined && response.status !== 206) {
    await response.body.cancel();
    throw new Error("Media server ignored the range.");
  }
  const read = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const next = await read.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > 8 * 1024 * 1024) throw new Error("Media segment too large.");
      chunks.push(next.value);
    }
  } finally {
    await read.cancel().catch(() => {});
    read.releaseLock();
  }
  const data = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.byteLength; }
  const isPlaylist = /\.m3u8(?:[?#]|$)/i.test(url) || /mpegurl/i.test(response.headers.get("content-type") ?? "") ||
    new TextDecoder().decode(data.subarray(0, 12)).trimStart().startsWith("#EXTM3U");
  if (isPlaylist) {
    const playlist = new TextDecoder().decode(data);
    for (const line of playlist.split(/\r?\n/)) {
      const trimmed = line.trim();
      const refs = trimmed.startsWith("#") ? [...line.matchAll(/(?:^|[, :])URI="([^"]+)"/g)].map((match) => match[1])
        : trimmed ? [trimmed] : [];
      for (const ref of refs) {
        if (entry.urls.size >= 15000) break;
        try { entry.urls.add(httpsUrl(ref, url).href); } catch { /* Unsupported URL. */ }
      }
    }
    return { playlist, bytes };
  }
  let encoded = "";
  for (let i = 0; i < data.length; i += 8192) encoded += String.fromCharCode(...data.subarray(i, i + 8192));
  return { encoded: btoa(encoded), bytes };
}

function tidy(value: unknown, op: keyof typeof methods) {
  if (op === "posts" || op === "search" || op === "episodes") return entries(value);
  if (op === "title") {
    const data = own(value);
    return {
      title: text(data.title), image: text(data.poster) ?? text(data.image), synopsis: text(data.synopsis), type: text(data.type),
      groups: list(data.linkList).map((value) => {
        const group = own(value);
        return {
          title: text(group.title) ?? text(group.quality) ?? "Source",
          episodesLink: link.safeParse(group.episodesLink).data,
          entries: entries(group.directLinks),
        };
      }),
    };
  }
  return list(Array.isArray(value) ? value : [value]).flatMap((value) => {
    const item = own(value);
    if (item.kind || /^(?:torrent|embed|magnet)$/i.test(text(item.type) ?? "")) return [];
    if (item.downloadOnly && !/^(?:mp4|mkv|webm|hls|m3u8|m4v)$/i.test(text(item.type) ?? "")) return [];
    const link = text(item.link);
    try {
      const url = httpsUrl(link ?? "").href;
      return [{ url, ticket: mediaTicket(url), server: text(item.server) ?? "Stream", type: text(item.type), quality: text(item.quality) }];
    } catch { return []; }
  });
}

let active = 0;
const stores = new Map<string, Map<string, unknown>>();

async function execute(input: z.infer<typeof request>) {
  if (input.op === "ping") return Object.keys(loaders);
  if (input.op === "media") return media(input);
  if ("link" in input && input.link.startsWith("castle:") && input.id !== "castle") throw new Error("Invalid provider link.");
  if (!Object.hasOwn(loaders, input.id)) throw new Error("This provider is unavailable in this version of the extension.");
  if (active >= 6) throw new Error("Provider bridge is busy. Retry shortly.");
  active++;
  try {
    const bundle = await loaders[input.id]();
    if (input.op === "catalog") return categories(bundle);
    if (input.op === "posts" && !categories(bundle).some(({ filter }) => filter === input.filter)) throw new Error("Unknown category.");
    const run = bundle[methods[input.op]];
    if (typeof run !== "function") throw new Error("This provider does not offer this operation.");
    const values = stores.get(input.id) ?? new Map<string, unknown>();
    stores.set(input.id, values);
    const signal = AbortSignal.timeout(25000);
    let missing: HostAccess | undefined;
    const http = providerHttp(signal);
    http.interceptors.response.use(undefined, (error) => {
      if (error instanceof HostAccess) missing = error;
      throw error;
    });
    try {
      const args = input.op === "posts" ? { filter: input.filter, page: input.page } :
        input.op === "search" ? { searchQuery: input.q, page: 1 } :
        input.op === "episodes" ? { url: input.link } :
        { link: input.link, type: input.op === "sources" && input.series ? "series" : "movie" };
      const result = await run({ ...args, provider: input.id, providerValue: input.id, signal, providerContext: {
        axios: http, cheerio, commonHeaders: {},
        Aes: { sha1: async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(value))), (n) => n.toString(16).padStart(2, "0")).join("") },
        openWebView: async () => { throw new Error("This provider requires an interactive WebView."); },
        kvStore: {
          get: async (key: string) => values.get(key),
          set: async (key: string, value: unknown) => { if (values.size < 200) values.set(key, value); },
          delete: async (key: string) => values.delete(key),
          keys: async () => [...values.keys()],
          clear: async () => values.clear(),
        },
      } });
      const output = tidy(result, input.op);
      if (missing && (Array.isArray(output) ? !output.length : !("title" in output && output.title))) throw missing;
      return output;
    } catch (error) { throw missing ?? error; }
  } finally { active--; }
}

chrome.runtime.onMessageExternal.addListener((message: unknown, sender, respond) => {
  try {
    const url = new URL(sender.url ?? "");
    if (url.origin !== pageOrigin || !url.pathname.startsWith(pageRoot) || sender.frameId !== 0) return false;
  } catch { return false; }
  const input = request.safeParse(message);
  if (!input.success) { respond({ ok: false, error: "Invalid provider request." }); return false; }
  void execute(input.data).then((data) => respond({ ok: true, data }), (error: unknown) => {
    if (error instanceof HostAccess) {
      respond({ ok: false, error: error.message, needsAccess: true });
    } else respond({ ok: false, error: "The provider could not complete this request. Try another provider or source." });
  });
  return true;
});
