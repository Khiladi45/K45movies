import assert from "node:assert/strict";
import { providerResult } from "../../src/server/provider-cache";
import { providerNetwork } from "../../src/server/provider-network";
import { providerRateLimit } from "../../src/server/provider-rate-limit";
import { providerStore } from "../../src/server/provider-store";
import { queueProviderRequest } from "../../src/lib/provider-queue";

const pending = Promise.withResolvers();
const request1 = new AbortController();
const request2 = new AbortController();
let calls = 0;
const load = () => { calls++; return pending.promise; };
const canceled = providerResult("check:coalesce", 1000, request1.signal, load);
const joined = providerResult("check:coalesce", 1000, request2.signal, load);
request1.abort();
await assert.rejects(canceled, { name: "AbortError" });
pending.resolve(["shared"]);
assert.deepEqual(await joined, ["shared"]);
assert.deepEqual(await providerResult("check:coalesce", 1000, request2.signal, load), ["shared"]);
assert.equal(calls, 1);
let emptyCalls = 0;
const empty = () => { emptyCalls++; return Promise.resolve([]); };
await providerResult("check:empty", 1000, request2.signal, empty);
await providerResult("check:empty", 1000, request2.signal, empty);
assert.equal(emptyCalls, 2);

delete process.env.K45_KV_REST_URL;
delete process.env.K45_KV_REST_TOKEN;
const fixture = providerStore("fixture");
await fixture.set("key", { value: 3 });
assert.deepEqual(await providerStore("fixture").get("key"), { value: 3 });
assert.equal(await providerStore("other").get("key"), undefined);
assert.deepEqual(await fixture.keys(), ["key"]);
assert.ok(await fixture.delete("key"));
await fixture.set("old", 5);
const clock = Date.now;
Date.now = () => clock() + 86_401_000;
try { assert.equal(await fixture.get("old"), undefined); }
finally { Date.now = clock; }

const originalFetch = globalThis.fetch;
const redisCommands = [];
process.env.K45_KV_REST_URL = "https://example.com/";
process.env.K45_KV_REST_TOKEN = "fixture-only";
globalThis.fetch = async (url, options) => {
  assert.equal(String(url), "https://example.com/");
  assert.equal(options.headers.Authorization, "Bearer fixture-only");
  const args = JSON.parse(options.body);
  redisCommands.push(args);
  return Response.json({ result: args[0] === "GET" ? "{\"value\":3}" : args[0] === "SCAN" ? ["0", ["k45:provider:redis:key"]] : "OK" });
};
try {
  const remote = providerStore("redis");
  await remote.set("key", { value: 3 });
  assert.deepEqual(await remote.get("key"), { value: 3 });
  assert.deepEqual(await remote.keys(), ["key"]);
  await remote.clear();
  assert.deepEqual(redisCommands[0], ["SET", "k45:provider:redis:key", "{\"value\":3}", "EX", 86400]);
  assert.deepEqual(redisCommands.at(-1), ["DEL", "k45:provider:redis:key"]);
} finally {
  globalThis.fetch = originalFetch;
  delete process.env.K45_KV_REST_URL;
  delete process.env.K45_KV_REST_TOKEN;
}

let active = 0;
let peak = 0;
const controllers = Array.from({ length: 12 }, () => new AbortController());
const tasks = controllers.map(({ signal }) => queueProviderRequest(signal, async () => {
  peak = Math.max(peak, ++active);
  await new Promise((resolve) => setTimeout(resolve, 5));
  active--;
}));
controllers[8].abort();
const settled = await Promise.allSettled(tasks);
assert.equal(peak, 4);
assert.equal(settled.filter(({ status }) => status === "fulfilled").length, 11);

delete process.env.K45_TRUSTED_CLIENT_IP_HEADER;
const address = "http://localhost/api/proxy/providers";
const anonymous = () => new Request(address);
const cookie1 = providerRateLimit(anonymous()).split(";")[0];
const cookie2 = providerRateLimit(anonymous()).split(";")[0];
const request = (cookie) => new Request(address, { headers: { Cookie: cookie } });
for (let i = 1; i < 360; i++) providerRateLimit(request(cookie1));
assert.throws(() => providerRateLimit(request(cookie1)), { status: 429 });
assert.equal(providerRateLimit(request(cookie2)), undefined);

process.env.K45_TRUSTED_CLIENT_IP_HEADER = "x-test-client";
const trustedRequest = (ip) => new Request(address, { headers: { "x-test-client": ip } });
for (let i = 0; i < 360; i++) providerRateLimit(trustedRequest("192.0.2.10"));
assert.throws(() => providerRateLimit(trustedRequest("192.0.2.10")), { status: 429 });
assert.equal(providerRateLimit(trustedRequest("192.0.2.20")), undefined);

const network = providerNetwork(AbortSignal.timeout(1000));
for (const destination of ["http://127.0.0.1/", "http://[::1]/", "https://example.com:8443/"]) {
  await assert.rejects(network.request(destination), /destination is unavailable/);
}
console.log(JSON.stringify({
  coalescedCalls: calls, emptyCalls, kvRoundTrip: true, providerScopesIsolated: true, kvExpired: true, redisRestProtocol: true,
  queuePeak: peak, queuedCancellation: true, perClient429: true, ingressIsolation: true, blockedDestinations: 3,
}));
