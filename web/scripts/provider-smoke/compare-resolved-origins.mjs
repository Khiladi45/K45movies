import { lookup } from "node:dns/promises";
import { readFile, writeFile } from "node:fs/promises";
import { request } from "node:https";
import { isIP } from "node:net";
import ipaddr from "ipaddr.js";

const [input, output, ...hosts] = process.argv.slice(2);
if (!input || !output) throw new Error("Pass DNS report and output JSON paths.");
const report = JSON.parse(await readFile(input, "utf8"));
const publicIp = (address) => ipaddr.isValid(address) && ipaddr.process(address).range() === "unicast";
const publicHost = (host) => /^[a-z0-9.-]+$/i.test(host) && host.includes(".") && !isIP(host);

async function measure(host, addresses) {
  const start = performance.now();
  if (!publicHost(host) || !publicIp(addresses)) throw new Error("Probe requires a public destination.");
  return new Promise((resolve) => {
    const req = request({ hostname: addresses, servername: host, path: "/", method: "HEAD", rejectUnauthorized: true,
      headers: { Host: host }, signal: AbortSignal.timeout(4500), agent: false }, (res) => {
      res.resume();
      resolve({ status: res.statusCode, ms: Math.round(performance.now() - start) });
    });
    req.once("error", (error) => resolve({
      error: error.code ?? error.name, ms: Math.round(performance.now() - start),
    }));
    req.end();
  });
}

async function doh(hostname, url) {
  const answers = await Promise.all(["A", "AAAA"].map(async (type) => {
    const resource = new URL(url);
    resource.search = new URLSearchParams({ name: hostname, type });
    const response = await fetch(resource, { headers: { Accept: "application/dns-json" }, redirect: "error", signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error("Resolver HTTP " + response.status);
    const payload = await response.json();
    return (payload.Answer ?? []).filter((entry) => entry.type === 1 || entry.type === 28).map(({ data }) => data);
  }));
  return [...new Set(answers.flat())].sort();
}

const rows = [];
const results = report.results.filter(({ hostname }) => publicHost(hostname) && (!hosts.length || hosts.includes(hostname)));
for (let index = 0; index < results.length; index += 3) {
  rows.push(...await Promise.all(results.slice(index, index + 3).map(async ({ hostname, system }) => {
    const resolved = await Promise.allSettled([
      lookup(hostname, { all: true }).then((answers) => answers.map(({ address }) => address)),
      doh(hostname, "https://cloudflare-dns.com/dns-query"),
      doh(hostname, "https://dns.google/resolve"),
    ]);
    const resolvers = ["system", "cloudflare", "google"];
    const sets = Object.fromEntries(resolved.map((entry, i) => [resolvers[i], entry.status === "fulfilled" ?
      [...new Set(entry.value)].sort() : { error: entry.reason.code ?? entry.reason.message }]));
    const historicalSystem = (system.answers ?? []).map(({ address }) => address).filter((address) => !sets.system.includes?.(address));
    const addresses = [...new Set([...Object.values(sets).filter(Array.isArray).flat(), ...historicalSystem])];
    const probes = [];
    for (let start = 0; start < addresses.length; start += 3) {
      probes.push(...await Promise.all(addresses.slice(start, start + 3).map(async (address) => ({
        address, resolvers: [...resolvers.filter((key) => Array.isArray(sets[key]) && sets[key].includes(address)),
          ...(historicalSystem.includes(address) ? ["historical system"] : [])],
        ...(publicIp(address) ? await measure(hostname, address) : { error: "destination rejected" }),
      }))));
    }
    return { hostname, ...sets, probes };
  })));
}
await writeFile(output, JSON.stringify({ measuredAt: new Date().toISOString(), method: "HEAD", path: "/", rows }, null, 2) + "\n");
