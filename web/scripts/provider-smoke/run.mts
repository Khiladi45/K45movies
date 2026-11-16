import { AsyncLocalStorage } from "node:async_hooks";
import { subscribe } from "node:diagnostics_channel";
import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { promisify } from "node:util";
import { Script } from "node:vm";
import type { Category, Episode, Post, Provider, ProviderDetail, ProviderIssue, Source, SourceAttempt, SourceReport } from "../../src/lib/catalog-types";

type Failure = { origin: string; targetFingerprint: string; method: string; headers: Record<string, string>; headerNames: string[]; ms: number; status?: number; error?: string };
type Trace = { requests: number; origins: Record<string, number>; statuses: Record<string, number>; errors: Set<string>; providerLogs: number; webViewCalls: number; firstFailure?: Failure };
type Outcome = { state: "pass" | "fail" | "empty" | "skipped"; ms?: number; http?: number; count?: number; error?: string; details?: ProviderIssue; attempts?: SourceAttempt[]; trace?: Omit<Trace, "errors"> & { errors: string[] } };

const trace = new AsyncLocalStorage<Trace>();
const safe = (message: unknown) => String(message)
  .replace(/https?:\/\/[^\s"'<>]+/gi, "[url]")
  .replace(/"(?:input|authorization|cookie|token|apiKey|secret)"\s*:\s*"[^"]*"/gi, '"value":"[redacted]"')
  .replace(/'[^']*'/g, "'[redacted]'")
  .replace(/\s+\|\s+\{.*$/s, "").slice(0, 240);

type UpstreamRequest = { origin: string; path: string; method: string; headers: string[] };
const upstreamTraces = new WeakMap<UpstreamRequest, { active: Trace; start: number }>();
function firstFailure(request: UpstreamRequest, outcome: { status?: number; error?: string }) {
  const entry = upstreamTraces.get(request);
  if (!entry || entry.active.firstFailure) return;
  const headers: Record<string, string> = {};
  const headerNames: string[] = [];
  for (let index = 0; index + 1 < request.headers.length; index += 2) {
    const name = request.headers[index].toLowerCase();
    headerNames.push(name);
    if (/^(accept|accept-encoding|accept-language|content-type|range|sec-fetch-mode|user-agent)$/.test(name)) {
      headers[name] = safe(request.headers[index + 1]);
    }
  }
  entry.active.firstFailure = {
    origin: request.origin, targetFingerprint: createHash("sha256").update(request.path).digest("hex").slice(0, 16),
    method: request.method, headers, headerNames, ms: Math.round(performance.now() - entry.start), ...outcome,
  };
}
subscribe("undici:request:create", ({ request }: { request: UpstreamRequest }) => {
  const active = trace.getStore();
  if (active) {
    active.requests++;
    active.origins[request.origin] = (active.origins[request.origin] ?? 0) + 1;
    upstreamTraces.set(request, { active, start: performance.now() });
  }
});
subscribe("undici:request:headers", ({ request, response }: { request: UpstreamRequest; response: { statusCode: number } }) => {
  const active = upstreamTraces.get(request)?.active;
  if (active) {
    const status = String(response.statusCode);
    active.statuses[status] = (active.statuses[status] ?? 0) + 1;
    if (response.statusCode >= 400) firstFailure(request, { status: response.statusCode });
  }
});
subscribe("undici:request:error", ({ request, error }: { request: UpstreamRequest; error: Error & { code?: string } }) => {
  const message = safe(typeof error.code === "string" ? error.code : error.name || error.message);
  upstreamTraces.get(request)?.active.errors.add(message);
  firstFailure(request, { error: message });
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

const args = process.argv.slice(2);
const flag = args.indexOf("--url");
const remote = flag < 0 ? undefined : new URL(args.splice(flag, 2)[1] ?? "");
if (remote && (!["https:", "http:"].includes(remote.protocol) || remote.username || remote.password || remote.search || remote.hash || remote.pathname !== "/")) {
  throw new Error("--url must be the HTTP(S) origin of the deployed website.");
}
const localRoutes = remote ? undefined : await Promise.all([
  import("../../src/app/api/proxy/providers/route"), import("../../src/app/api/proxy/media/[token]/route"),
]);
const [output, ...ids] = args;
if (!output) throw new Error("Usage: node --conditions=react-server --import tsx scripts/provider-smoke/run.mts OUTPUT.json [--url WEBSITE_ORIGIN] [provider ...]");
const query = process.env.K45_SMOKE_QUERY || "Batman";
const baseUrl = remote?.origin || process.env.K45_SMOKE_SITE_URL;
let clientCookie: string | undefined;
const supplementalIds = ["disneyMirror", "netflixMirror", "primeMirror", "youtube", "moviesApi"];
const started = new Date().toISOString();

async function call<T>(params: Record<string, string>) {
  const store: Trace = { requests: 0, origins: {}, statuses: {}, errors: new Set(), providerLogs: 0, webViewCalls: 0 };
  const url = new URL("/api/proxy/providers", remote?.origin || "http://localhost");
  url.search = new URLSearchParams(params).toString();
  const begin = performance.now();
  let response: Response;
  try {
    const request = new Request(url, {
      signal: AbortSignal.timeout(115_000), redirect: "error",
      headers: clientCookie ? { Cookie: clientCookie } : undefined,
    });
    response = localRoutes ? await trace.run(store, () => localRoutes[0].GET(request)) : await fetch(request);
    clientCookie ??= response.headers.getSetCookie().find((item) => item.startsWith("k45-provider-client="))?.split(";")[0];
  } catch (error) {
    return { data: undefined, outcome: { state: "fail", ms: Math.round(performance.now() - begin), error: safe(error) } satisfies Outcome };
  }
  const data = await response.json().catch(() => null);
  const usable = response.ok && data !== null;
  const sourceReport = params.op === "sources" && Array.isArray(data?.sources) ? data as SourceReport : undefined;
  const count = Array.isArray(data) ? data.length : sourceReport?.sources.length;
  const outcome: Outcome = {
    state: usable ? count === 0 ? "empty" : "pass" : "fail",
    ms: Math.round(performance.now() - begin), http: response.status, count,
    error: usable ? undefined : safe(data?.error ?? "Server returned a non-JSON response."),
    details: usable ? sourceReport?.issue : data?.details, attempts: sourceReport?.attempts,
    trace: localRoutes ? { ...store, errors: [...store.errors] } : undefined,
  };
  return { data: usable ? data as T : undefined, outcome };
}

const manifest = await call<Provider[]>({ op: "manifest" });
const manifestIds = manifest.data?.map(({ id }) => id) ?? [];
if (!manifest.data) throw new Error(JSON.stringify(manifest.outcome));
const providerIds = ids.length ? ids : [...new Set([...manifestIds, ...supplementalIds])];
const concurrency = Number(process.env.K45_SMOKE_CONCURRENCY || 4);
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4) throw new Error("K45_SMOKE_CONCURRENCY must be 1–4.");
const skipped = (error: string): Outcome => ({ state: "skipped", error });

async function media(source: Source) {
  const begin = performance.now();
  const url = new URL(source.url, baseUrl || "http://localhost");
  const headers = { Range: "bytes=0-4095" };
  const signal = AbortSignal.timeout(12_000);
  const metadata = { server: source.server, hint: source.type, quality: source.quality, hls: source.hls, format: source.format, probe: source.probe };
  try {
    if (url.origin !== new URL(baseUrl || "http://localhost").origin) throw Error("Media response left the website origin.");
    const response = baseUrl
      ? await fetch(url, { headers, signal, redirect: "error" })
      : await localRoutes![1].GET(new Request(url, { headers, signal }), { params: Promise.resolve({ token: url.pathname.split("/").at(-1)! }) });
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
  const streams = source ? await call<Source[] | SourceReport>({ id, op: "sources", ref: source.ref, type, diagnostics: "1" }) :
    { data: undefined, outcome: skipped("No source reference") };
  const results = {
    catalog: catalog.outcome, posts: posts.outcome, search: search.outcome, meta: meta.outcome,
    episodes: episodes.outcome, stream: streams.outcome,
  };
  console.log(id, Object.entries(results).map(([op, result]) => op + "=" + result.state + (result.ms === undefined ? "" : "/" + result.ms)).join(" "));
  const sources = Array.isArray(streams.data) ? streams.data : streams.data?.sources ?? [];
  const samples = await Promise.all(sources.slice(0, 3).map(media));
  return { id, title: meta.data?.title ?? first?.title, group: group?.title, results, samples };
}

const rows: Awaited<ReturnType<typeof smoke>>[] = [];
let cursor = 0;
await Promise.all(Array.from({ length: concurrency }, async () => {
  for (;;) {
    const index = cursor++;
    if (index >= providerIds.length) return;
    rows[index] = await smoke(providerIds[index]);
  }
}));
await writeFile(output, JSON.stringify({ started, target: remote?.origin ?? "in-process", finished: new Date().toISOString(), query, manifest: manifest.outcome, manifestIds, manifestSources: manifest.data.map(({ id, bundleSource }) => ({ id, bundleSource })), rows }, null, 2) + "\n");
