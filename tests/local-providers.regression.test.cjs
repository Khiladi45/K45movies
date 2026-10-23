/**
 * Regression test for the on-device provider path.
 *
 * Bundles src/services/LocalProviderRunner.ts (which pulls in the real
 * providerContext.ts, runtimeGlobals.ts, wafSolver.ts, registry.js and all 61
 * generated provider bundles) with Node stubs for the two native-only modules,
 * then executes real provider calls through it.
 *
 *   node tests/local-providers.regression.test.cjs [--live]
 *
 * Without --live it verifies structure only (no network).
 */
const crypto = require("crypto");
const esbuild = require("esbuild");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const LIVE = process.argv.includes("--live");

const failures = [];
const notes = [];

function check(label, condition, detail) {
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
    failures.push(label);
  }
}

function writeStub(dir, name, source) {
  const file = path.join(dir, name);
  fs.writeFileSync(file, source, "utf8");
  return file;
}

async function buildRunner() {
  const stubDir = fs.mkdtempSync(path.join(os.tmpdir(), "k45-local-providers-"));

  const asyncStub = writeStub(
    stubDir,
    "async-storage.js",
    `const store = new Map();
module.exports = {
  __esModule: true,
  default: {
    getItem: async (k) => (store.has(k) ? store.get(k) : null),
    setItem: async (k, v) => { store.set(k, String(v)); },
    removeItem: async (k) => { store.delete(k); },
    getAllKeys: async () => Array.from(store.keys()),
    multiRemove: async (keys) => { keys.forEach((k) => store.delete(k)); },
  },
};
`,
  );

  const cryptoStub = writeStub(
    stubDir,
    "expo-crypto.js",
    `const nodeCrypto = require("crypto");
module.exports = {
  __esModule: true,
  CryptoDigestAlgorithm: { SHA1: "sha1", SHA256: "sha256", SHA512: "sha512", MD5: "md5" },
  CryptoEncoding: { HEX: "hex", BASE64: "base64" },
  digestStringAsync: async (algorithm, data) =>
    nodeCrypto.createHash(algorithm).update(String(data), "utf8").digest("hex"),
};
`,
  );

  const outfile = path.join(stubDir, "runner.cjs");
  // LocalProviderRunner does not re-export the context, so the harness needs an
  // entry that pulls both through the real module graph.
  const entry = writeStub(
    stubDir,
    "entry.ts",
    `export { LocalProviderRunner } from ${JSON.stringify(
      path.join(ROOT, "src/services/LocalProviderRunner.ts").replace(/\\/g, "/"),
    )};\nexport { providerContext } from ${JSON.stringify(
      path.join(ROOT, "src/lib/providerContext.ts").replace(/\\/g, "/"),
    )};\n`,
  );
  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node18",
    outfile,
    alias: {
      "@react-native-async-storage/async-storage": asyncStub,
      "expo-crypto": cryptoStub,
    },
    logLevel: "warning",
  });

  return { outfile, stubDir, size: fs.statSync(outfile).size };
}

function structuralTests(runner, registry) {
  console.log("\n[1] Registry and bundle structure");
  const ids = registry.ids();
  const onDisk = fs
    .readdirSync(path.join(ROOT, "src/providers/bundles"))
    .filter((f) => f.endsWith(".js"))
    .map((f) => f.replace(/\.js$/, ""));
  check("registry is non-empty", ids.length > 0, `got ${ids.length}`);
  check(
    "registry matches the bundles on disk",
    ids.length === onDisk.length && ids.every((id) => onDisk.includes(id)),
    `registry=${ids.length} disk=${onDisk.length}`,
  );
  check(
    "registry.has() rejects unknown ids",
    registry.has("vega") && !registry.has("does-not-exist"),
  );

  let bad = [];
  for (const id of ids) {
    const modules = registry.modulesOf(id);
    let bundle;
    try {
      bundle = registry.load(id);
    } catch (error) {
      bad.push(`${id}: load threw ${error.message}`);
      continue;
    }
    const expected = {
      catalog: modules.includes("catalog"),
      getPosts: modules.includes("posts"),
      getMeta: modules.includes("meta"),
      getStream: modules.includes("stream"),
    };
    if (id === "moviesApi") {
      // Aggregator helper: ships only mpGetStream, by design.
      if (typeof bundle.mpGetStream !== "function") {
        bad.push(`${id}: missing mpGetStream`);
      }
      continue;
    }
    for (const [name, required] of Object.entries(expected)) {
      if (!required) continue;
      const value = bundle[name];
      // catalog is an array on most providers and a function on a few.
      const ok =
        typeof value === "function" || Array.isArray(value) || value != null;
      if (!ok) bad.push(`${id}: missing ${name}`);
    }
  }
  check("every bundle exposes its declared modules", bad.length === 0, bad.join("; "));

  console.log("\n[2] LocalProviderRunner dispatch");
  const catalog = runner.LocalProviderRunner.has("vega");
  check("runner.has() agrees with registry", catalog === true);
  check("runner.ids() agrees with registry", runner.LocalProviderRunner.ids().length === ids.length);
}

async function contextTests(runner) {
  console.log("\n[3] providerContext contract");
  const { providerContext } = runner;

  check("axios present", typeof providerContext.axios?.get === "function");
  check("cheerio.load present", typeof providerContext.cheerio?.load === "function");
  check(
    "commonHeaders carries a Chrome mobile UA",
    /Chrome\/\d+.*Mobile Safari/.test(providerContext.commonHeaders["User-Agent"] || ""),
    providerContext.commonHeaders["User-Agent"],
  );
  check("openWebView is a function", typeof providerContext.openWebView === "function");

  const $ = providerContext.cheerio.load("<div class='x'>hello</div>");
  check("cheerio actually parses", $(".x").text() === "hello", $(".x").text());

  const digest = await providerContext.Aes.sha1("avatar");
  const expected = crypto.createHash("sha1").update("avatar", "utf8").digest("hex");
  check("Aes.sha1 matches node crypto", digest === expected, `${digest} != ${expected}`);

  const kv = providerContext.kvStore;
  await kv.set("k45-test", { a: 1 });
  const round = await kv.get("k45-test");
  check("kvStore round-trips objects", round && round.a === 1, JSON.stringify(round));
  const keys = await kv.keys();
  check("kvStore.keys() is scoped and prefix-stripped", keys.includes("k45-test"), keys.join(","));
  check("kvStore.get() returns undefined for missing keys", (await kv.get("nope")) === undefined);
  await kv.delete("k45-test");
  check("kvStore.delete() removes", (await kv.get("k45-test")) === undefined);
  await kv.set("k45-test-2", "v");
  await kv.clear();
  check("kvStore.clear() empties scope", (await kv.keys()).length === 0);

  console.log("\n[4] openWebView without a mounted solver");
  try {
    await providerContext.openWebView("https://example.com");
    check("rejects when no WAF handler is registered", false, "resolved instead");
  } catch (error) {
    check(
      "rejects when no WAF handler is registered",
      /unavailable/i.test(error.message),
      error.message,
    );
  }
  try {
    await providerContext.openWebView("file:///etc/passwd");
    check("rejects non-HTTP verification URLs", false, "resolved instead");
  } catch (error) {
    check("rejects non-HTTP verification URLs", /Blocked non-HTTP/.test(error.message), error.message);
  }
}

async function cancellationTests(runner) {
  console.log("\n[5] Cancellation");
  const controller = new AbortController();
  const pending = runner.LocalProviderRunner.execute(
    "vega",
    "posts",
    "getSearchPosts",
    { searchQuery: "avatar", page: 1, providerValue: "vega" },
    controller.signal,
  );
  setTimeout(() => controller.abort(), 50);
  try {
    await pending;
    check("aborted call rejects", false, "resolved instead");
  } catch (error) {
    check("aborted call rejects with 'canceled'", /cancel/i.test(error.message), error.message);
  }

  const preAborted = new AbortController();
  preAborted.abort();
  try {
    await runner.LocalProviderRunner.execute("vega", "posts", "getPosts", {}, preAborted.signal);
    check("pre-aborted signal rejects immediately", false, "resolved instead");
  } catch (error) {
    check("pre-aborted signal rejects immediately", /cancel/i.test(error.message), error.message);
  }

  try {
    await runner.LocalProviderRunner.execute("vega", "posts", "noSuchMethod", {});
    check("unknown method throws a clear error", false, "resolved instead");
  } catch (error) {
    check(
      "unknown method throws a clear error",
      /has no noSuchMethod\(\)/.test(error.message),
      error.message,
    );
  }

  try {
    await runner.LocalProviderRunner.execute("not-a-provider", "posts", "getPosts", {});
    check("unknown provider throws a clear error", false, "resolved instead");
  } catch (error) {
    check(
      "unknown provider throws a clear error",
      /not in the static registry/.test(error.message),
      error.message,
    );
  }
}

async function liveTests(runner) {
  console.log("\n[6] Live provider traces");
  const battery = ["vega", "castle", "uhd", "mod", "kissKh"];
  let withResults = 0;
  let withStreams = 0;

  for (const id of battery) {
    const started = Date.now();
    let searchCount = 0;
    let streamCount = 0;
    let stage = "search";
    let error = "";
    try {
      const posts = await runner.LocalProviderRunner.execute(
        id,
        "posts",
        "getSearchPosts",
        { searchQuery: "avatar", page: 1, providerValue: id },
      );
      searchCount = Array.isArray(posts) ? posts.length : 0;

      // Real playback flow: search → meta → direct link (or episode) → stream.
      if (searchCount > 0) {
        withResults++;
        stage = "meta";
        const info = await runner.LocalProviderRunner.execute(
          id,
          "meta",
          "getMeta",
          { link: posts[0].link, provider: id },
        );
        const directLinks =
          info?.linkList?.flatMap((entry) => entry.directLinks || []) || [];
        const target =
          directLinks.find((link) => link.type === "movie") || directLinks[0];

        let streamLink = target?.link;
        let streamType = target?.type || "movie";
        const episodesLink = info?.linkList?.[0]?.episodesLink;

        if (!streamLink && episodesLink) {
          stage = "episodes";
          const episodes = await runner.LocalProviderRunner.execute(
            id,
            "episodes",
            "getEpisodes",
            { url: episodesLink, provider: id },
          );
          streamLink = Array.isArray(episodes) ? episodes[0]?.link : null;
          streamType = "series";
        }

        if (streamLink) {
          stage = "stream";
          const streams = await runner.LocalProviderRunner.execute(
            id,
            "stream",
            "getStream",
            { link: streamLink, type: streamType, provider: id },
          );
          streamCount = Array.isArray(streams) ? streams.length : 0;
          if (streamCount > 0) withStreams++;
        } else {
          stage = "no-link";
        }
      }
    } catch (e) {
      error = `${stage}: ${e.message}`;
    }
    const elapsed = Date.now() - started;
    console.log(
      `  ${id.padEnd(10)} search=${searchCount} streams=${streamCount} ${elapsed}ms${error ? ` ERROR ${error}` : ""}`,
    );
    if (error || stage === "no-link") notes.push(`${id}: ${error || "no direct/episode link in meta"}`);
  }

  check("at least 3 of 5 live providers returned search results", withResults >= 3, `${withResults}/5`);
  check("at least 2 of 5 live providers returned streams", withStreams >= 2, `${withStreams}/5`);
}

async function main() {
  console.log(`Mode: ${LIVE ? "LIVE (network)" : "STRUCTURAL (no network)"}`);
  const built = await buildRunner();
  console.log(
    `Bundled LocalProviderRunner + providerContext + registry + 61 providers → ${(built.size / 1024 / 1024).toFixed(2)} MB`,
  );

  const runner = require(built.outfile);
  const registry = require(path.join(ROOT, "src/providers/registry.js"));

  structuralTests(runner, registry);
  await contextTests(runner);
  await cancellationTests(runner);
  if (LIVE) await liveTests(runner);

  fs.rmSync(built.stubDir, { recursive: true, force: true });

  console.log("\n" + "=".repeat(60));
  if (notes.length > 0) {
    console.log("Provider-side notes (not test failures):");
    notes.forEach((n) => console.log(`  - ${n}`));
  }
  if (failures.length === 0) {
    console.log(`RESULT: PASS${LIVE ? " (live)" : " (structural)"}`);
  } else {
    console.log(`RESULT: FAIL — ${failures.length} check(s):`);
    failures.forEach((f) => console.log(`  - ${f}`));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Harness error:", error);
  process.exitCode = 1;
});
