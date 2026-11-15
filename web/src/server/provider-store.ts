import "server-only";

type Stored = { json: string; expires: number };
const runtime = globalThis as typeof globalThis & { k45ProviderValues?: Map<string, Stored> };
const memory = runtime.k45ProviderValues ??= new Map();
const ttlSeconds = 86_400;
const maxEntries = 4096;

async function redis<T>(endpoint: string, token: string, ...command: (string | number)[]) {
  const url = new URL(endpoint);
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("Provider KV requires an HTTPS REST endpoint.");
  }
  const response = await fetch(url, {
    method: "POST", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(3_000),
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  if (!response.ok) throw new Error("Provider KV REST request failed (HTTP " + response.status + ").");
  const body = await response.json() as { result: T; error?: string };
  if (body.error) throw new Error("Provider KV rejected the Redis command.");
  return body.result;
}

export function providerStore(id: string) {
  const prefix = "k45:provider:" + id + ":";
  const endpoint = process.env.K45_KV_REST_URL;
  const token = process.env.K45_KV_REST_TOKEN;
  if (endpoint || token) {
    if (!endpoint || !token) throw new Error("Provider KV requires both REST URL and token.");
    const command = <T>(...args: (string | number)[]) => redis<T>(endpoint, token, ...args);
    const scan = async () => {
      const found = new Set<string>();
      let cursor = "0";
      do {
        const [next, keys] = await command<[string, string[]]>("SCAN", cursor, "MATCH", prefix + "*", "COUNT", 100);
        cursor = String(next);
        keys.forEach((key) => { if (key.startsWith(prefix)) found.add(key); });
      } while (cursor !== "0");
      return [...found];
    };
    return {
      async get(key: string) {
        const json = await command<string | null>("GET", prefix + key);
        return json == null ? undefined : JSON.parse(json);
      },
      async set(key: string, value: unknown) {
        await command("SET", prefix + key, JSON.stringify(value ?? null), "EX", ttlSeconds);
      },
      async delete(key: string) { await command("DEL", prefix + key); return true; },
      async keys() { return (await scan()).map((key) => key.slice(prefix.length)); },
      async clear() {
        const keys = await scan();
        for (let index = 0; index < keys.length; index += 100) {
          await command("DEL", ...keys.slice(index, index + 100));
        }
      },
    };
  }

  function prune() {
    const now = Date.now();
    for (const [key, value] of memory) if (value.expires <= now) memory.delete(key);
  }

  return {
    async get(key: string) {
      const name = prefix + key;
      const entry = memory.get(name);
      if (!entry) return;
      if (entry.expires <= Date.now()) { memory.delete(name); return; }
      return JSON.parse(entry.json);
    },
    async set(key: string, value: unknown) {
      const name = prefix + key;
      const json = JSON.stringify(value ?? null);
      if (memory.size >= maxEntries) prune();
      memory.delete(name);
      if (memory.size >= maxEntries) {
        const oldest = memory.keys().next().value;
        if (oldest !== undefined) memory.delete(oldest);
      }
      memory.set(name, { json, expires: Date.now() + ttlSeconds * 1000 });
    },
    async delete(key: string) { memory.delete(prefix + key); return true; },
    async keys() {
      prune();
      return [...memory.keys()].filter((key) => key.startsWith(prefix)).map((key) => key.slice(prefix.length));
    },
    async clear() { for (const key of memory.keys()) if (key.startsWith(prefix)) memory.delete(key); },
  };
}
