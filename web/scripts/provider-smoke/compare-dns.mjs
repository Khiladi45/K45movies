import { lookup } from "node:dns/promises";
import { readFile, writeFile } from "node:fs/promises";
import ipaddr from "ipaddr.js";

const [tracePath, output] = process.argv.slice(2);
if (!tracePath || !output) throw new Error("Pass in-process smoke JSON and output JSON.");
const trace = JSON.parse(await readFile(tracePath, "utf8"));
const hosts = new Set();
for (const { results } of trace.rows) {
  for (const result of Object.values(results)) {
    if (!["empty", "fail"].includes(result.state)) continue;
    for (const origin of Object.keys(result.trace?.origins ?? {})) hosts.add(new URL(origin).hostname);
    if (result.trace?.firstFailure) hosts.add(new URL(result.trace.firstFailure.origin).hostname);
  }
}
function addresses(values) {
  return [...new Set(values)].sort().map((address) => ({
    address, public: ipaddr.isValid(address) && ipaddr.process(address).range() === "unicast",
  }));
}
async function measure(task) {
  const start = performance.now();
  try { return { ...await task(), ms: Math.round(performance.now() - start) }; }
  catch (error) { return { error: error.cause?.code ?? error.code ?? error.name, ms: Math.round(performance.now() - start) }; }
}
async function doh(base, hostname) {
  const rows = await Promise.all(["A", "AAAA"].map(async (type) => {
    const url = new URL(base);
    url.search = new URLSearchParams({ name: hostname, type }).toString();
    const response = await fetch(url, { headers: { Accept: "application/dns-json" }, signal: AbortSignal.timeout(4500), redirect: "error" });
    if (!response.ok) throw new Error("Resolver HTTP " + response.status, { cause: { code: "HTTP_" + response.status } });
    const answer = await response.json();
    return [answer.Status, (answer.Answer ?? []).filter(({ type }) => type === 1 || type === 28).map(({ data }) => data)];
  }));
  return { status: rows.map(([status]) => status), answers: addresses(rows.flatMap(([, values]) => values)) };
}
const results = [];
const names = [...hosts].sort().filter((name) => name.includes(".") && /^[a-z0-9.-]+$/i.test(name) && !ipaddr.isValid(name));
for (let index = 0; index < names.length; index += 4) {
  results.push(...await Promise.all(names.slice(index, index + 4).map(async (hostname) => {
    const [system, cloudflare, google] = await Promise.all([
      measure(async () => ({ answers: addresses((await lookup(hostname, { all: true })).map(({ address }) => address)) })),
      measure(() => doh("https://cloudflare-dns.com/dns-query", hostname)),
      measure(() => doh("https://dns.google/resolve", hostname)),
    ]);
    return { hostname, system, cloudflare, google };
  })));
}
await writeFile(output, JSON.stringify({ measuredAt: new Date().toISOString(), traceStarted: trace.started, results }, null, 2) + "\n");
