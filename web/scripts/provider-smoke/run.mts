import { AsyncLocalStorage } from "node:async_hooks";
import { subscribe } from "node:diagnostics_channel";
import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { Script } from "node:vm";
import { GET } from "../../src/app/api/proxy/providers/route";
import { GET as mediaGET } from "../../src/app/api/proxy/media/[token]/route";
import type { Category, Episode, Post, Provider, ProviderDetail, ProviderIssue, Source } from "../../src/lib/catalog-types";

type Trace = { requests: number; statuses: Record<string, number>; errors: Set<string>; providerLogs: number; webViewCalls: number };
type Outcome = { state: "pass" | "fail" | "empty" | "skipped"; ms?: number; http?: number; count?: number; error?: string; details?: ProviderIssue; trace?: Omit<Trace, "errors"> & { errors: string[] } };

const trace = new AsyncLocalStorage<Trace>();
const safe = (message: unknown) => String(message)
  .replace(/https?:\/\/[^\s"'<>]+/gi, "[url]")
  .replace(/'[^']*'/g, "'[redacted]'")
  .replace(/\s+\|\s+\{.*$/s, "").slice(0, 240);

const upstreamTraces = new WeakMap<object, Trace>();
subscribe("undici:request:create", ({ request }: { request: object }) => {
  const active = trace.getStore();
  if (active) { active.requests++; upstreamTraces.set(request, active); }
});
subscribe("undici:request:headers", ({ request, response }: { request: object; response: { statusCode: number } }) => {
  const active = upstreamTraces.get(request);
  if (active) {
    const status = String(response.statusCode);
    active.statuses[status] = (active.statuses[status] ?? 0) + 1;
  }
});
subscribe("undici:request:error", ({ request, error }: { request: object; error: Error & { code?: string } }) => {
  upstreamTraces.get(request)?.errors.add(safe(error.code ?? error.message));
});

// The diagnostic process runs the same route and VM. Observe before error
// serialization, preserving the normal return values and error propagation.
const runInContext = Script.prototype.runInContext;
const instrumented = new WeakSet<object>();
Script.prototype.runInContext = function (context, options) {
  const active = trace.getStore();
  if (active && context.options?.providerContext && !instrumented.has(context)) {
    instrumented.add(context);
    const provider = context.options.providerContext;
    const openWebView = provider.openWebView;
    provider.openWebView = (...args: unknown[]) => {
      active.webViewCalls++;
      return openWebView(...args).catch((error: Error) => {
        active.errors.add(safe(error.message));
        throw error;
      });
    };
    for (const method of Object.keys(context.console)) {
      const original = context.console[method];
      context.console[method] = (...args: unknown[]) => {
        original(...args);
        active.providerLogs++;
        // Bundle log strings can contain credentials or provider tokens.
        for (const value of args) {
          if (value && typeof value === "object" && "message" in value) {
            active.errors.add(safe(value.message));
          }
        }
      };
    }
  }
  try {
    const result = runInContext.call(this, context, options);
    if (!active || !result || typeof result.then !== "function") return result;
    return Promise.resolve(result).catch((error: Error) => {
      active.errors.add(safe(error.message));
      throw error;
    });
  } catch (error) {
    if (active && error && typeof error === "object" && "message" in error) active.errors.add(safe(error.message));
    throw error;
  }
};

const [output, ...ids] = process.argv.slice(2);
if (!output) throw new Error("Usage: node --conditions=react-server --import tsx scripts/provider-smoke/run.mts OUTPUT.json [provider ...]");
const query = process.env.K45_SMOKE_QUERY || "Batman";
const baseUrl = process.env.K45_SMOKE_SITE_URL;
const supplementalIds = ["disneyMirror", "netflixMirror", "primeMirror", "youtube", "moviesApi"];
const started = new Date().toISOString();

async function call<T>(params: Record<string, string>) {
  const store: Trace = { requests: 0, statuses: {}, errors: new Set(), providerLogs: 0, webViewCalls: 0 };
  const url = new URL("/api/proxy/providers", "http://localhost");
  url.search = new URLSearchParams(params).toString();
  const begin = performance.now();
  const response = await trace.run(store, () => GET(new Request(url, {
    signal: AbortSignal.timeout(65_000),
  })));
  const data = await response.json();
  const count = Array.isArray(data) ? data.length : undefined;
  const outcome: Outcome = {
    state: response.ok ? count === 0 ? "empty" : "pass" : "fail",
    ms: Math.round(performance.now() - begin), http: response.status, count,
    error: response.ok ? undefined : safe(data.error),
    details: response.ok ? undefined : data.details,
    trace: { ...store, errors: [...store.errors] },
  };
  return { data: response.ok ? data as T : undefined, outcome };
}

const manifest = await call<Provider[]>({ op: "manifest" });
const manifestIds = manifest.data?.map(({ id }) => id) ?? [];
if (!manifest.data) throw new Error(JSON.stringify(manifest.outcome));
const providerIds = ids.length ? ids : [...new Set([...manifestIds, ...supplementalIds])];
const skipped = (error: string): Outcome => ({ state: "skipped", error });

async function media(source: Source) {
  const begin = performance.now();
  const url = new URL(source.url, baseUrl || "http://localhost");
  const headers = { Range: "bytes=0-4095" };
  const signal = AbortSignal.timeout(12_000);
  const metadata = { server: source.server, hint: source.type, quality: source.quality, hls: source.hls };
  try {
    const response = baseUrl
      ? await fetch(url, { headers, signal })
      : await mediaGET(new Request(url, { headers, signal }), { params: Promise.resolve({ token: url.pathname.split("/").at(-1)! }) });
    const reader = response.body?.getReader();
    const prefix = (await reader?.read())?.value?.slice(0, 4096) ?? new Uint8Array();
    await reader?.cancel();
    const info = {
      ...metadata, status: response.status, contentType: response.headers.get("content-type"),
      range: response.headers.get("content-range"),
      signature: new TextDecoder().decode(prefix.slice(0, 7)) === "#EXTM3U" ? "HLS" :
        Buffer.from(prefix.slice(0, 4)).toString("hex") === "1a45dfa3" ? "EBML" :
        new TextDecoder().decode(prefix.slice(4, 8)) === "ftyp" ? "ISO BMFF" : undefined,
      ms: Math.round(performance.now() - begin),
    };
    const ffprobe = process.env.K45_SMOKE_FFPROBE;
    if (!ffprobe || !baseUrl || !response.ok || !["127.0.0.1", "localhost"].includes(url.hostname)) return info;
    try {
      const { stdout } = await promisify(execFile)(ffprobe, [
        "-v", "error", "-protocol_whitelist", "http,https,tcp,tls,crypto",
        "-probesize", "262144", "-analyzeduration", "1500000", "-show_entries",
        "format=format_name:stream=codec_type,codec_name,profile", "-of", "json", url.href,
      ], { timeout: 12_000 });
      return { ...info, codecs: JSON.parse(stdout) };
    } catch (error) {
      const failure = error as { code?: string | number; killed?: boolean; stderr?: string };
      return { ...info, codecError: failure.killed ? "ffprobe timed out" : safe(failure.stderr || failure.code) };
    }
  } catch (error) {
    return { ...metadata, error: safe(error), ms: Math.round(performance.now() - begin) };
  }
}

async function smoke(id: string) {
  const catalog = await call<Category[]>({ id, op: "catalog" });
  const category = catalog.data?.[0];
  const [posts, search] = await Promise.all([
    category ? call<Post[]>({ id, op: "posts", page: "1", filter: category.filter }) :
      { data: undefined, outcome: skipped("No category returned") },
    call<Post[]>({ id, op: "search", q: query }),
  ]);
  const items = [...posts.data ?? [], ...search.data ?? []];
  const first = items.find(({ type }) => /series|tv|show/i.test(type ?? "")) ?? items[0];
  const meta = first ? await call<ProviderDetail>({ id, op: "title", ref: first.ref }) :
    { data: undefined, outcome: skipped("No title from posts or search") };
  const group = meta.data?.groups.find(({ episodesRef }) => episodesRef) ?? meta.data?.groups[0];
  const episodes = group?.episodesRef ? await call<Episode[]>({ id, op: "episodes", ref: group.episodesRef }) :
    { data: undefined, outcome: skipped(group ? "Direct links; no episode reference" : "No group from meta") };
  const source = episodes.data?.[0] ?? group?.directLinks[0] ?? meta.data?.groups.find(({ directLinks }) => directLinks.length)?.directLinks[0];
  const type = group?.episodesRef || /series|tv|show/i.test(meta.data?.type ?? "") ? "series" : "movie";
  const streams = source ? await call<Source[]>({ id, op: "sources", ref: source.ref, type }) :
    { data: undefined, outcome: skipped("No source reference") };
  const results = {
    catalog: catalog.outcome, posts: posts.outcome, search: search.outcome, meta: meta.outcome,
    episodes: episodes.outcome, stream: streams.outcome,
  };
  console.log(id, Object.entries(results).map(([op, result]) => op + "=" + result.state + (result.ms === undefined ? "" : "/" + result.ms)).join(" "));
  const samples = await Promise.all((streams.data ?? []).slice(0, 3).map(media));
  return { id, title: meta.data?.title ?? first?.title, group: group?.title, results, samples };
}

const rows: Awaited<ReturnType<typeof smoke>>[] = [];
let cursor = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  for (;;) {
    const index = cursor++;
    if (index >= providerIds.length) return;
    rows[index] = await smoke(providerIds[index]);
  }
}));
await writeFile(output, JSON.stringify({ started, finished: new Date().toISOString(), query, manifest: manifest.outcome, manifestIds, manifestSources: manifest.data.map(({ id, bundleSource }) => ({ id, bundleSource })), rows }, null, 2) + "\n");
