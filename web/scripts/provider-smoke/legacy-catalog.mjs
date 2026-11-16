import { AsyncLocalStorage } from "node:async_hooks";
import { subscribe } from "node:diagnostics_channel";
import { writeFile } from "node:fs/promises";
import { getProviders, loadProviderCatalog, runProvider } from "../../src/server/providers.ts";

const [output, mode = "doh", ...requested] = process.argv.slice(2);
if (!output || !["system", "doh", "short"].includes(mode)) throw new Error("Specify output, mode and optional provider IDs.");
delete process.env.K45_KV_REST_URL;
delete process.env.K45_KV_REST_TOKEN;
process.env.K45_DOH = mode === "system" ? "0" : "1";
if (mode === "short") {
  const timeout = AbortSignal.timeout.bind(AbortSignal);
  AbortSignal.timeout = (ms) => timeout(ms === 75_000 ? 25_000 : ms);
}
const ids = requested.length ? requested : ["disneyPlus","hotstar","marvel","netflix","pixar","primeVideo","starWars"];
const active = new AsyncLocalStorage();
const pending = new WeakMap();
subscribe("undici:request:create", ({ request }) => {
  const requests = active.getStore();
  if (!requests) return;
  const path = request.path.split("?")[0];
  const stage = /verif|userver/i.test(request.origin + path) ? "session checks" : /\/mobile\/home/.test(path) ? "catalog or session bootstrap" : "other";
  pending.set(request, { requests, stage, start: performance.now() });
});
function outcome(request, status) {
  const sample = pending.get(request);
  if (!sample) return;
  pending.delete(request);
  sample.requests.push({ stage: sample.stage, status, ms: Math.round(performance.now() - sample.start) });
}
subscribe("undici:request:headers", ({request,response}) => outcome(request,response.statusCode));
subscribe("undici:request:error", ({request,error}) => outcome(request,error?.code ?? error?.name));
await getProviders();
const rows = [];
for (let i = 0; i < ids.length; i += 3) {
  rows.push(...await Promise.all(ids.slice(i, i + 3).map(async (id) => {
    const run = async (fetchCatalog) => {
      const requests = [];
      const start = performance.now();
      try {
        const value = await active.run(requests, () => fetchCatalog(AbortSignal.timeout(88_000)));
        return { ms: Math.round(performance.now() - start), count: value.length, requests };
      } catch (error) { return { ms: Math.round(performance.now() - start), error: error.message, requests }; }
    };
    const cached = (signal) => runProvider({ id, op: "catalog" }, signal);
    const cold = await run(cached);
    const warm = cold.count ? await run(cached) : undefined;
    const warmUncached = cold.count ? await run((signal) => loadProviderCatalog(id, signal)) : undefined;
    console.log(id, cold.ms, warm?.ms, warmUncached?.ms);
    return { id, cold, warm, warmUncached };
  })));
  await writeFile(output, JSON.stringify({mode,rows}, null, 2) + "\n");
}
