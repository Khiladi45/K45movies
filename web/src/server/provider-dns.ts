import "server-only";
import { request } from "node:https";
import { isIP } from "node:net";

type Address = { address: string; family: 4 | 6 };
type Answer = { data?: string; TTL?: number; type?: number };
type Resolved = { addresses: Address[]; expires: number };

const endpoints = [
  { address: "1.1.1.1", hostname: "cloudflare-dns.com", path: "/dns-query" },
  { address: "8.8.8.8", hostname: "dns.google", path: "/resolve" },
];
const cache = new Map<string, Resolved>();
const pending = new Map<string, Promise<Address[] | undefined>>();

function query(endpoint: typeof endpoints[number], hostname: string, type: "A" | "AAAA") {
  return new Promise<Answer[]>((resolve, reject) => {
    const search = new URLSearchParams({ name: hostname, type });
    const req = request({
      hostname: endpoint.address, servername: endpoint.hostname, path: endpoint.path + "?" + search,
      headers: { Host: endpoint.hostname, Accept: "application/dns-json" },
      method: "GET", rejectUnauthorized: true, signal: AbortSignal.timeout(1800),
    }, (res) => {
      if (res.statusCode !== 200) { res.resume(); reject(new Error("DNS resolver returned HTTP " + res.statusCode)); return; }
      res.setEncoding("utf8");
      let json = "";
      res.on("data", (part: string) => {
        if (json.length + part.length > 65_536) { res.destroy(new Error("DNS response exceeded its size limit.")); return; }
        json += part;
      });
      res.on("error", reject);
      res.on("end", () => {
        try {
          const payload = JSON.parse(json) as { Status?: number; Answer?: Answer[] };
          if (payload.Status !== 0 && payload.Status !== 3) throw new Error("DNS resolver did not return a usable answer.");
          resolve(Array.isArray(payload.Answer) ? payload.Answer : []);
        } catch (error) { reject(error); }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

async function resolveDoh(hostname: string) {
  for (const endpoint of endpoints) {
    const result = await Promise.allSettled([query(endpoint, hostname, "A"), query(endpoint, hostname, "AAAA")]);
    const records = result.flatMap((entry) => entry.status === "fulfilled" ? entry.value : []);
    const found = new Map<string, Address>();
    let ttl = 300;
    for (const record of records) {
      if (Number.isFinite(record.TTL) && record.TTL! >= 0) ttl = Math.min(ttl, record.TTL!);
      if (record.type !== 1 && record.type !== 28) continue;
      const address = record.data;
      const family = record.type === 1 ? 4 : 6;
      if (!address || isIP(address) !== family) throw new Error("DNS resolver returned an invalid address.");
      found.set(address, { address, family });
    }
    if (!found.size) continue;
    const addresses = [...found.values()].sort((a, b) => a.family - b.family);
    if (ttl > 0) {
      if (cache.size >= 512) {
        const first = cache.keys().next().value;
        if (first !== undefined) cache.delete(first);
      }
      cache.set(hostname, { addresses, expires: Date.now() + ttl * 1000 });
    }
    return addresses;
  }
}

export function secureDnsAnswers(hostname: string) {
  const cached = cache.get(hostname);
  if (cached && cached.expires > Date.now()) return Promise.resolve(cached.addresses);
  if (cached) cache.delete(hostname);
  const existing = pending.get(hostname);
  if (existing) return existing;
  if (pending.size >= 128) return Promise.reject(new Error("The DNS resolver queue is full."));
  const task = resolveDoh(hostname).finally(() => pending.delete(hostname));
  pending.set(hostname, task);
  return task;
}
