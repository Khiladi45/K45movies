import assert from "node:assert/strict";
import { test } from "node:test";
import { providerResult } from "../../src/server/provider-cache";
import { providerDestination, publicDnsAnswers } from "../../src/server/provider-network";
import { mediaTarget, mediaUrl } from "../../src/server/media-token";
import { encodeReference } from "../../src/server/references";
import { GET } from "../../src/app/api/proxy/providers/route";
import { enqueueProvider } from "../../src/server/provider-client-queue";
import { providerCookieSession } from "../../src/server/provider-cookies";
import { providerStore } from "../../src/server/provider-store";

test("provider queue limits each client to three active and 32 waiting operations", async () => {
  const signal = new AbortController().signal;
  const held = Promise.withResolvers<number>();
  let started = 0;
  const work = () => { started++; return held.promise; };
  const running = Array.from({ length: 3 }, () => enqueueProvider("queue-test", signal, work));
  const cancel = new AbortController();
  const canceled = enqueueProvider("queue-test", cancel.signal, work);
  const waiting = Array.from({ length: 31 }, () => enqueueProvider("queue-test", signal, work));
  assert.equal(started, 3);
  await assert.rejects(enqueueProvider("queue-test", signal, work), { status: 429, stage: "queue" });
  assert.equal(await enqueueProvider("other-client", signal, async () => 5), 5);
  cancel.abort();
  await assert.rejects(canceled, { name: "AbortError" });
  held.resolve(1);
  await Promise.all([...running, ...waiting]);
  assert.equal(started, 34);
});

test("provider cookie sessions persist by service and stay scoped by provider, domain and path", async () => {
  const alpha = await providerCookieSession("cookie-test-alpha");
  const origin = "https://example.org/catalog/items";
  alpha.receive(origin, ["sample=shared; Path=/catalog; Secure; HttpOnly", "expired=no; Max-Age=0"]);
  const later = await providerCookieSession("cookie-test-alpha");
  assert.equal(later.header(origin), "sample=shared");
  assert.equal(later.header("https://example.org/sources"), "");
  assert.equal(later.header("https://example.net/catalog/items"), "");
  assert.equal((await providerCookieSession("cookie-test-beta")).header(origin), "");
  assert.equal(await providerStore("cookie-test-alpha").get("cookies"), undefined);
  assert.ok((await providerStore("cookie-test-alpha", "network").get("cookies")).cookies.length);
});

test("Sources API validates quality and rejects malformed or cross-provider references", async () => {
  const issue = async (params: Record<string, string>) => {
    const url = new URL("/api/proxy/providers", "http://localhost");
    url.search = new URLSearchParams({ op: "sources", id: "vega", ...params }).toString();
    const response = await GET(new Request(url));
    const body = await response.json();
    assert.equal(body.details.operation, "sources");
    return response.status;
  };
  assert.equal(await issue({ ref: "anything", quality: "invalid" }), 400);
  assert.equal(await issue({ ref: "bad-format" }), 400);
  const other = encodeReference("other", "source", "fixture");
  assert.equal(await issue({ ref: other, quality: "highest" }), 400);
});

test("destination and DNS policies reject non-public answers on redirects and on reconnect", () => {
  const original = providerDestination("https://example.org/catalog");
  assert.throws(() => providerDestination(new URL("https://127.0.0.1/", original)));
  assert.throws(() => providerDestination("https://[::1]/"));
  assert.throws(() => providerDestination("https://192.168.1.10/"));
  const globalAnswer = { address: "93.184.215.14", family: 4 };
  const internalAnswer = { address: "10.0.0.2", family: 4 };
  assert.equal(publicDnsAnswers([globalAnswer]), true);
  assert.equal(publicDnsAnswers([globalAnswer, internalAnswer]), false);
  assert.equal(publicDnsAnswers([internalAnswer]), false);
  assert.equal(publicDnsAnswers([]), false);
});

test("encrypted media targets expire exactly at the deadline", () => {
  const target = { url: "https://example.org/watch", kind: "media" as const };
  const token = (expires: number) => mediaUrl({ ...target, expires }).split("/").at(-1)!;
  const valid = token(Date.now() + 60_000);
  assert.equal(mediaTarget(valid).url, target.url);
  assert.equal(Buffer.from(valid, "base64url").includes(target.url), false);
  assert.throws(() => mediaTarget(token(Date.now())), { status: 410 });
});

test("shared provider work cancels when the last caller leaves", async () => {
  const first = new AbortController();
  const second = new AbortController();
  let upstream: AbortSignal | undefined;
  const load = async (signal: AbortSignal) => {
    upstream = signal;
    return new Promise<void>((_, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }));
  };
  const a = providerResult("phase5:cancel", 1000, first.signal, load);
  const b = providerResult("phase5:cancel", 1000, second.signal, load);
  first.abort();
  await assert.rejects(a, { name: "AbortError" });
  assert.equal(upstream?.aborted, false);
  second.abort();
  await assert.rejects(b, { name: "AbortError" });
  assert.equal(upstream?.aborted, true);
});

test("provider cache evicts completed entries under repeated load", async () => {
  const signal = new AbortController().signal;
  const measures = [];
  for (let wave = 0; wave < 5; wave++) {
    for (let index = 0; index < 600; index++) {
      await providerResult("phase5:" + wave + ":" + index, 60_000, signal, async () => new Uint8Array(4096));
    }
    globalThis.gc?.();
    const { heapUsed, arrayBuffers } = process.memoryUsage();
    measures.push({ heapUsed, arrayBuffers });
  }
  let evicted = false;
  await providerResult("phase5:0:0", 60_000, signal, async () => { evicted = true; return true; });
  assert.ok(evicted);
  const retained = measures.at(-1)!;
  if (globalThis.gc) {
    assert.ok(retained.arrayBuffers - measures[0].arrayBuffers < 3 * 1024 * 1024);
    assert.ok(retained.heapUsed - measures[0].heapUsed < 8 * 1024 * 1024);
  }
  console.log(JSON.stringify({ cacheWaves: measures, lookups: 3000, oldestEntryEvicted: evicted, gc: !!globalThis.gc }));
});
