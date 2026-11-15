import "server-only";
import { createContext, Script } from "node:vm";
import { createHash, webcrypto } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import * as cheerio from "cheerio";
import { z } from "zod";
import type { Category, Episode, Post, Provider, ProviderDetail, QualityPreference, Source } from "@/lib/catalog-types";
import { providerNetwork, streamUpstream } from "./provider-network";
import { decodeReference, encodeReference } from "./references";
import { createMediaLink, mediaHeaders } from "./media";
import { HttpError } from "./http";
import { providerStore } from "./provider-store";
import { providerResult } from "./provider-cache";
import { ProviderError, providerMessage } from "./provider-errors";
import { normalizeStreams, preferredStreams } from "@/lib/streams";
import { probeCandidates, probePlayback } from "@/lib/stream-probe";

const defaultBase = "https://raw.githubusercontent.com/Khiladi45/K45movies-api/fce60ad0758822f734f505ef08661f837a450cbb/";
const androidHeaders = { "User-Agent": "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36" };
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

const vendorDir = resolve("vendor/android/src/providers");
const mirrorNames: Record<string, string> = { disneyMirror: "Disney Mirror", netflixMirror: "Netflix Mirror", primeMirror: "Prime Mirror" };
let vendoredIds: Promise<string[]> | undefined;

function localProviders() {
  vendoredIds ??= readFile(resolve(vendorDir, "registry.js"), "utf8").then((source) => {
    const registryModule = { exports: {} as { ids: () => unknown } };
    new Script(source, { filename: "android-provider-registry.js" }).runInNewContext({ module: registryModule }, { timeout: 500 });
    return z.array(providerId).parse(registryModule.exports.ids());
  });
  return vendoredIds;
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
  if (!res.ok) throw new ProviderError(502, "Provider registry request failed with HTTP " + res.status + ".", "registry", res.status);
  return res;
}

export function getProviders() {
  if (cachedManifest && cachedManifest.expires > Date.now()) return cachedManifest.task;
  const task = (async () => {
    const apiOnly = process.env.K45_PROVIDER_SOURCE === "api";
    const local = apiOnly ? [] : await localProviders();
    const remote = await artifact("manifest.json").then(async (res) => {
      const data = await res.json();
      const parsed = manifestShape.parse(Array.isArray(data) ? { providers: data } : data);
      return parsed.providers;
    }).catch((error) => {
      if (apiOnly) throw error;
      console.warn("Provider API manifest unavailable", { stage: "registry", message: providerMessage(error) });
      return [];
    });
    const metadata = new Map(remote.map((entry) => [entry.id, entry]));
    const builtIn = new Set(local);
    return [...new Set([...remote.map(({ id }) => id), ...local])]
      .filter((id) => !["moviesApi", "youtube"].includes(id))
      .map((id): Provider => {
        const entry = metadata.get(id);
        return {
          id, name: entry?.name ?? (Object.hasOwn(mirrorNames, id) ? mirrorNames[id] : id),
          version: entry?.version ?? undefined, description: entry?.description ?? undefined,
          type: entry?.type ?? undefined, icon: image(entry?.icon), bundleSource: builtIn.has(id) ? "vendored" : "api",
        };
      });
  })();
  cachedManifest = { task, expires: Date.now() + 300_000 };
  void task.catch(() => { if (cachedManifest?.task === task) cachedManifest = undefined; });
  return task;
}

async function compiled(id: string) {
  const match = (await getProviders()).find((provider) => provider.id === id);
  if (!match) throw new ProviderError(404, "Provider is unavailable.", "registry");
  const cached = bundles.get(id);
  if (cached && cached.expires > Date.now()) return cached.task;

  const source = match.bundleSource === "vendored" ? readFile(resolve(vendorDir, "bundles", id + ".js"), "utf8") :
    artifact("bundled/" + id + ".js").then((response) => response.text());
  const task = source.then((code) => new Script(code, { filename: id + ".provider.js" }));
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
  z.object({ op: z.literal("sources"), id: providerId, ref: z.string().min(1).max(8000), type: z.enum(["movie", "series"]).default("movie"), quality: z.enum(["auto", "highest", "lowest"]).default("auto") }),
]);

let activeExecutions = 0;

async function execute(input: z.infer<typeof providerRequest>, args: Record<string, unknown>, requestSignal: AbortSignal) {
  if (activeExecutions >= 24) throw new ProviderError(503, "Provider service is busy. Try again shortly.", "runtime", undefined, "2");
  activeExecutions++;
  try {
    const bundle = await compiled(input.id).catch((error) => {
      if (error instanceof ProviderError) throw error;
      throw new ProviderError(502, providerMessage(error) || "Provider bundle could not be loaded.", "bundle");
    });
    const signal = AbortSignal.any([requestSignal, AbortSignal.timeout(25_000)]);
    signal.throwIfAborted();
    let upstream: ProviderError | undefined;
    let verification: ProviderError | undefined;
    let logged = "";
    const { request, http } = providerNetwork(signal, androidHeaders, ({ message, status, timeout }) => {
      const issue = new ProviderError(timeout ? 504 : 502, message, "upstream", status);
      if (status || !upstream?.upstreamStatus) upstream = issue;
    });
    const observe = (...values: unknown[]) => {
      logged = values.map(providerMessage).find(Boolean) || logged;
    };
    const exports: Record<string, unknown> = {};
    const context = createContext({
      exports, module: { exports }, Buffer, URL, URLSearchParams, TextEncoder, TextDecoder, atob, btoa,
      AbortController, AbortSignal, Headers, Request, Response, FormData, Blob, performance,
      crypto: webcrypto, process: { env: { NODE_ENV: process.env.NODE_ENV } }, setTimeout, clearTimeout,
      fetch: request, require: (name: string) => { if (name === "crypto") return {}; throw new Error("Module unavailable."); },
      console: { log: observe, info: observe, warn: observe, error: observe, debug: observe },
      options: {
        ...args, provider: input.id, providerValue: input.id, signal,
        providerContext: {
          axios: http, cheerio, commonHeaders: { ...androidHeaders },
          Aes: { sha1: async (value: string) => createHash("sha1").update(String(value)).digest("hex") },
          openWebView: async () => {
            verification = new ProviderError(503, "The provider requested interactive browser verification.", "verification", upstream?.upstreamStatus);
            throw verification;
          },
          kvStore: providerStore(input.id),
        },
      },
    });
    try { bundle.runInContext(context, { timeout: 500 }); }
    catch (error) { throw new ProviderError(502, providerMessage(error) || "Provider bundle initialization failed.", "bundle"); }
    const operation = JSON.stringify(operations[input.op]);
    const invoke = new Script("(() => { const value = module.exports[" + operation +
      "]; if (value === undefined) throw Error('The provider does not support this operation.'); return typeof value === 'function' ? value(options) : value; })()");
    let cancel: (() => void) | undefined;
    try {
      signal.throwIfAborted();
      const expiration = new Promise<never>((_, reject) => {
        cancel = () => reject(new ProviderError(504, "The provider exceeded the operation deadline.", "runtime"));
        signal.addEventListener("abort", cancel, { once: true });
      });
      const result = await Promise.race([Promise.resolve(invoke.runInContext(context, { timeout: 1000 })), expiration]);
      if (result == null || (Array.isArray(result) && result.length === 0)) {
        if (verification || upstream) throw verification ?? upstream;
        if (logged && /invalid url/i.test(logged)) throw new ProviderError(502, logged, "runtime");
      }
      return result;
    } catch (error) {
      if (verification) throw verification;
      if (error instanceof ProviderError) throw error;
      const message = providerMessage(error) || logged;
      if (/search is unavailable|does not support this operation/i.test(message)) throw new ProviderError(422, message, "runtime");
      if (upstream) throw upstream;
      throw new ProviderError(502, message || "Provider operation failed without an error message.", "runtime");
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
  if (!title) throw new ProviderError(404, "This title is unavailable from the provider.", "normalize");
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

async function sources(value: unknown, preference: QualityPreference, signal: AbortSignal) {
  const streams = preferredStreams(normalizeStreams(value), preference);
  return probeCandidates(streams, async (stream, deadline): Promise<Source | undefined> => {
    const { raw, server, serverKey, quality } = stream;
    const headers = { "user-agent": androidHeaders["User-Agent"], ...mediaHeaders(raw.headers) };
    if (stream.url.length > 5500) return;
    const probe = await probePlayback(async (method, abort) => {
      const outgoing = new Headers(headers);
      outgoing.set("accept-encoding", "identity");
      if (method === "GET") outgoing.set("range", "bytes=0-8191");
      const { response } = await streamUpstream(stream.url, method, outgoing, abort);
      return response as unknown as Response;
    }, stream.format, deadline);
    if (probe.status !== "ok") return;
    const format = probe.format ?? stream.format;
    const url = createMediaLink(stream.url, headers, "media", undefined, format);
    if (!url) return;
    const subtitles = list(raw.subtitles).flatMap((entry) => {
      const subtitle = item(entry);
      const uri = text(subtitle.uri);
      const output = uri && createMediaLink(uri, headers, "subtitle", stream.url);
      return output ? [{
        url: output, language: text(subtitle.language) ?? "und",
        label: text(subtitle.title) ?? text(subtitle.language) ?? "Subtitles",
      }] : [];
    }).slice(0, 40);
    return {
      url, subtitles, server, serverKey, quality, format, probe, hls: format === "hls",
      type: stream.type || undefined, label: text(raw.tag),
      languages: [...strings(raw.languages), ...strings(raw.audioLanguages), ...strings(raw.tags)],
    };
  }, signal);
}

const cacheTtl = { catalog: 300_000, title: 180_000, episodes: 90_000 };

export function runProvider(input: z.infer<typeof providerRequest>, signal: AbortSignal) {
  if (input.op === "catalog" || input.op === "title" || input.op === "episodes") {
    return providerResult(JSON.stringify(input), cacheTtl[input.op], signal, (shared) => resolveProvider(input, shared));
  }
  return resolveProvider(input, signal);
}

async function resolveProvider(input: z.infer<typeof providerRequest>, signal: AbortSignal): Promise<Category[] | Post[] | ProviderDetail | Episode[] | Source[]> {
  const id = input.id;
  switch (input.op) {
    case "catalog": {
      const result = categories(await execute(input, {}, signal));
      if (!result.length) throw new ProviderError(502, "The provider returned no usable catalog categories.", "normalize");
      return result;
    }
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
      return sources(await execute(input, { link: decodeReference(id, "source", input.ref), type: input.type }, signal), input.quality, signal);
  }
}
