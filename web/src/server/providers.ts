import "server-only";
import { createContext, Script } from "node:vm";
import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import { z } from "zod";
import type { Category, Episode, Post, Provider, ProviderDetail, Source } from "@/lib/catalog-types";
import { providerNetwork } from "./provider-network";
import { decodeReference, encodeReference } from "./references";
import { HttpError } from "./http";

const defaultBase = "https://raw.githubusercontent.com/Khiladi45/K45movies-api/fce60ad0758822f734f505ef08661f837a450cbb/";
const providerId = z.string().regex(/^[a-zA-Z0-9_-]{1,65}$/);
const manifestShape = z.object({
  providers: z.array(z.object({
    id: providerId, name: z.string(), version: z.string().nullish(),
    description: z.string().nullish(), type: z.string().nullish(), icon: z.string().nullish(),
  })),
});

function base() {
  return (process.env.K45MOVIES_API_BASE_URL || defaultBase).replace(/\/+$/, "") + "/";
}

type Cached<T> = { expires: number; task: Promise<T> };

let cachedManifest: Cached<Provider[]> | undefined;
const bundles = new Map<string, Cached<Script>>();

const item = (value: unknown): Record<string, unknown> => value && typeof value === "object" ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : undefined;
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const strings = (value: unknown) => list(value).filter((part): part is string => typeof part === "string").slice(0, 100);

function image(value: unknown) {
  const raw = text(value);
  if (!raw) return undefined;
  try {
    const parsed = new URL(raw.startsWith("//") ? "https:" + raw : raw);
    if (["http:", "https:"].includes(parsed.protocol) && !parsed.username && !parsed.password) return parsed.href;
  } catch { /* Some providers omit artwork. */ }
}

async function artifact(path: string) {
  const { request } = providerNetwork(AbortSignal.timeout(8_000));
  const res = await request(new URL(path, base()));
  if (!res.ok) throw new HttpError(502, "Could not load the provider registry.");
  return res;
}

export function getProviders() {
  if (cachedManifest && cachedManifest.expires > Date.now()) return cachedManifest.task;
  const task = (async () => {
    const res = await artifact("manifest.json");
    const data = await res.json();
    const parsed = manifestShape.parse(Array.isArray(data) ? { providers: data } : data);
    return parsed.providers.filter(({ id }) => !["moviesApi", "youtube"].includes(id)).map((entry) => ({
      id: entry.id, name: entry.name, version: entry.version ?? undefined,
      description: entry.description ?? undefined, type: entry.type ?? undefined,
      icon: image(entry.icon),
    }));
  })();
  cachedManifest = { task, expires: Date.now() + 300_000 };
  void task.catch(() => { if (cachedManifest?.task === task) cachedManifest = undefined; });
  return task;
}

async function compiled(id: string) {
  const match = (await getProviders()).find((provider) => provider.id === id);
  if (!match) throw new HttpError(404, "Provider is unavailable.");
  const cached = bundles.get(id);
  if (cached && cached.expires > Date.now()) return cached.task;

  // Only execute bundled artifacts from the deployment-configured provider repository.
  const task = artifact("bundled/" + id + ".js").then(async (res) =>
    new Script(await res.text(), { filename: id + ".provider.js" })
  );
  bundles.set(id, { task, expires: Date.now() + 300_000 });
  void task.catch(() => { if (bundles.get(id)?.task === task) bundles.delete(id); });
  return task;
}

const operations = {
  catalog: "catalog", posts: "getPosts", search: "getSearchPosts", title: "getMeta",
  episodes: "getEpisodes", sources: "getStream",
} as const;

export const providerRequest = z.discriminatedUnion("op", [
  z.object({ op: z.literal("catalog"), id: providerId }),
  z.object({ op: z.literal("posts"), id: providerId, filter: z.string().max(300), page: z.coerce.number().int().min(1).max(150) }),
  z.object({ op: z.literal("search"), id: providerId, q: z.string().trim().min(2).max(120) }),
  z.object({ op: z.literal("title"), id: providerId, ref: z.string().min(1).max(8000) }),
  z.object({ op: z.literal("episodes"), id: providerId, ref: z.string().min(1).max(8000) }),
  z.object({ op: z.literal("sources"), id: providerId, ref: z.string().min(1).max(8000), type: z.enum(["movie", "series"]).default("movie") }),
]);

let activeExecutions = 0;

async function execute(input: z.infer<typeof providerRequest>, args: Record<string, unknown>, requestSignal: AbortSignal) {
  if (activeExecutions >= 24) throw new HttpError(503, "Provider service is busy. Try again shortly.", "2");
  activeExecutions++;
  try {
    const bundle = await compiled(input.id);
    const signal = AbortSignal.any([requestSignal, AbortSignal.timeout(25_000)]);
    signal.throwIfAborted();
    const { request, http } = providerNetwork(signal);
    const values = new Map<string, unknown>();
    const exports: Record<string, unknown> = {};
    const context = createContext({
      exports, module: { exports }, Buffer, URL, URLSearchParams, TextEncoder, TextDecoder, atob, btoa,
      AbortController, AbortSignal, Headers, Response, setTimeout, clearTimeout,
      fetch: request, require: (name: string) => { if (name === "crypto") return {}; throw new Error("Module unavailable."); },
      console: { log() {}, info() {}, warn() {}, error() {}, debug() {} },
      options: {
        ...args, provider: input.id, providerValue: input.id, signal,
        providerContext: {
          axios: http, cheerio, commonHeaders: { "User-Agent": "Mozilla/5.0" },
          Aes: { sha1: async (value: string) => createHash("sha1").update(value).digest("hex") },
          openWebView: async () => { throw new Error("Interactive provider access is unavailable."); },
          kvStore: {
            get: async (key: string) => values.get(key),
            set: async (key: string, value: unknown) => { values.set(key, value); },
            delete: async (key: string) => values.delete(key),
            keys: async () => [...values.keys()],
            clear: async () => values.clear(),
          },
        },
      },
    });
    bundle.runInContext(context, { timeout: 500 });
    const operation = JSON.stringify(operations[input.op]);
    const invoke = new Script("(() => { const value = module.exports[" + operation +
      "]; return typeof value === 'function' ? value(options) : value; })()");
    let cancel: (() => void) | undefined;
    try {
      const expiration = new Promise<never>((_, reject) => {
        cancel = () => reject(new HttpError(504, "The provider took too long to respond."));
        signal.addEventListener("abort", cancel, { once: true });
      });
      return await Promise.race([Promise.resolve(invoke.runInContext(context, { timeout: 1000 })), expiration]);
    } finally {
      if (cancel) signal.removeEventListener("abort", cancel);
    }
  } finally {
    activeExecutions--;
  }
}

function categories(value: unknown): Category[] {
  return list(value).flatMap((entry) => {
    const raw = item(entry);
    const title = text(raw.title);
    const filter = typeof raw.filter === "string" ? raw.filter : text(raw.id);
    return title && filter !== undefined && filter.length <= 300 ? [{ title, filter }] : [];
  }).slice(0, 100);
}

function post(provider: string, value: unknown): Post[] {
  const raw = item(value);
  const title = text(raw.title);
  const link = text(raw.link);
  if (!title || !link || link.length > 5000) return [];
  return [{
    title, ref: encodeReference(provider, "title", link), image: image(raw.image),
    type: text(raw.type), tag: text(raw.tag),
  }];
}

function episodes(provider: string, value: unknown): Episode[] {
  return list(value).flatMap((entry) => {
    const raw = item(entry);
    const link = text(raw.link);
    if (!link || link.length > 5000) return [];
    return [{
      title: text(raw.title) ?? "Play", ref: encodeReference(provider, "source", link),
      type: text(raw.type), description: text(raw.description), image: image(raw.image),
    }];
  }).slice(0, 1000);
}

function details(provider: string, ref: string, value: unknown): ProviderDetail {
  const raw = item(value);
  const title = text(raw.title);
  if (!title) throw new HttpError(404, "This title is unavailable from the provider.");
  return {
    title, ref, image: image(raw.image), poster: image(raw.poster), type: text(raw.type), synopsis: text(raw.synopsis),
    tags: strings(raw.tags), cast: strings(raw.cast), rating: text(raw.rating),
    groups: list(raw.linkList).flatMap((entry) => {
      const group = item(entry);
      const link = text(group.episodesLink);
      const directLinks = episodes(provider, group.directLinks);
      if ((!link || link.length > 5000) && !directLinks.length) return [];
      return [{
        title: text(group.title) ?? text(group.quality) ?? "Source",
        quality: text(group.quality), directLinks,
        episodesRef: link && link.length <= 5000 ? encodeReference(provider, "episodes", link) : undefined,
      }];
    }).slice(0, 150),
  };
}

function sources(value: unknown): Source[] {
  return list(Array.isArray(value) ? value : [value]).flatMap((entry) => {
    const raw = item(entry);
    const link = text(raw.link);
    if (!link || raw.downloadOnly === true || raw.kind === "audio" || raw.kind === "video") return [];
    return [{
      server: text(raw.server) ?? "Stream", quality: text(raw.quality), type: text(raw.type),
      label: text(raw.tag), languages: [...strings(raw.languages), ...strings(raw.audioLanguages), ...strings(raw.tags)],
    }];
  }).slice(0, 100);
}

export async function runProvider(input: z.infer<typeof providerRequest>, signal: AbortSignal) {
  const id = input.id;
  switch (input.op) {
    case "catalog":
      return categories(await execute(input, {}, signal));
    case "posts": {
      const allowed = await runProvider({ id, op: "catalog" }, signal) as Category[];
      if (!allowed.some(({ filter }) => filter === input.filter)) throw new HttpError(400, "Unknown provider category.");
      return list(await execute(input, { filter: input.filter, page: input.page }, signal)).flatMap((value) => post(id, value)).slice(0, 300);
    }
    case "search":
      return list(await execute(input, { searchQuery: input.q, page: 1 }, signal)).flatMap((value) => post(id, value)).slice(0, 300);
    case "title":
      return details(id, input.ref, await execute(input, { link: decodeReference(id, "title", input.ref) }, signal));
    case "episodes":
      return episodes(id, await execute(input, { url: decodeReference(id, "episodes", input.ref) }, signal));
    case "sources":
      return sources(await execute(input, { link: decodeReference(id, "source", input.ref), type: input.type }, signal));
  }
}
