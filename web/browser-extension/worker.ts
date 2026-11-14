import * as cheerio from "cheerio/slim";
import { z } from "zod";
import { HostAccess, httpsUrl, providerHttp } from "./network";
import bundles from "pinned-providers";

type Bundle = Record<string, unknown>;
const loaders: Record<string, () => Promise<Bundle>> = bundles;
const pageRoot = "/K45movies/";
const pageOrigin = "https://khiladi45.github.io";

const id = z.string().regex(/^[a-zA-Z0-9_-]{1,65}$/);
const link = z.string().min(1).max(6000).refine((value) => {
  if (value.startsWith("//")) return false;
  if (value.startsWith("/")) return !value.includes("\\");
  try { httpsUrl(value); return true; } catch { return false; }
});
const request = z.discriminatedUnion("op", [
  z.object({ op: z.literal("ping") }),
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
    if (item.downloadOnly || item.kind || /download[\s-]*only/i.test(text(item.server) ?? "")) return [];
    const link = text(item.link);
    try {
      const url = httpsUrl(link ?? "").href;
      return [{ url, server: text(item.server) ?? "Stream", type: text(item.type), quality: text(item.quality) }];
    } catch { return []; }
  });
}

let active = 0;
const stores = new Map<string, Map<string, unknown>>();

async function execute(input: z.infer<typeof request>) {
  if (input.op === "ping") return Object.keys(loaders);
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
  void execute(input.data).then((data) => respond({ ok: true, data }), async (error: unknown) => {
    if (error instanceof HostAccess) {
      await chrome.storage.local.set({ requestedOrigins: [error.origin] });
      respond({ ok: false, error: error.message });
    } else respond({ ok: false, error: "The provider could not complete this request. Try another provider or source." });
  });
  return true;
});
