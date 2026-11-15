import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { Script, createContext } from "node:vm";
import ts from "typescript";
import { GET } from "../../src/app/api/proxy/providers/route";
import { providerNetwork } from "../../src/server/provider-network";

function androidFile(ref, path, dependencies, globals = {}) {
  const source = execFileSync("git", ["show", ref + ":" + path], { encoding: "utf8" });
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  new Script(outputText, { filename: ref + ":" + path }).runInContext(createContext({
    exports, require: (id) => {
      assert.ok(id in dependencies, "Unexpected import " + id);
      return dependencies[id];
    },
    AbortController, setTimeout, clearTimeout, ...globals,
  }));
  return exports;
}

for (const ref of ["main", "origin/main"]) {
  const probes = [];
  const streams = androidFile(ref, "src/lib/streams.ts", {
    "react-native": { Platform: { OS: "android" } },
    "@/services/SandboxManager": { DEFAULT_UA: "fixture" },
  }, {
    fetch: async (url, options) => {
      probes.push([url, options.method, options.headers.Range ?? null]);
      const html = url.endsWith("fake.mp4");
      const manifest = url.endsWith(".m3u8");
      // Complete the first healthy candidate later than the next healthy one.
      if (manifest) await new Promise((done) => setTimeout(done, 25));
      return new Response(manifest ? "#EXTM3U\n#EXT-X-ENDLIST" : null, {
        headers: { "content-type": html ? "text/html" : "video/mp4" },
      });
    },
  });
  const raw = [
    { server: "one", link: "example.test/fake.mp4", quality: "720" },
    { server: "one", link: "https://example.test/later-480p.mp4" },
    { server: "two", link: "//example.test/720p.m3u8" },
    { server: "three", link: "https://example.test/alternate.mp4" },
    { server: "four", link: "https://example.test/fourth.mp4" },
    { server: "Download only", link: "https://example.test/label.mp4" },
    { server: "flagged", link: "https://example.test/flagged.mp4", type: "embed", downloadOnly: true },
  ];
  const selection = await streams.selectPlaybackStreams(raw, { preference: "highest" });
  assert.equal(selection.checkedCount, 4);
  assert.equal(selection.failedCount, 1);
  assert.equal(selection.streams[selection.startIndex].link, "https://example.test/720p.m3u8");
  assert.equal(selection.skippedDownloadOnly, ref === "main" ? 1 : 2);
  const manifestProbe = probes.find(([url]) => url.endsWith(".m3u8"));
  assert.deepEqual(manifestProbe?.slice(1), ["GET", "bytes=0-4095"]);
  const episodes = androidFile(ref, "src/lib/episodes.ts", {});
  assert.equal(episodes.parseEpisodeNumber("S01E03 · 1080p"), 3);
  assert.equal(episodes.findNextEpisode([{ number: 9 }, { number: 3 }, { number: 4 }], 3).number, 4);
  const current = {
    providerId: "fixture", title: "Example", link: "original", isSeries: true,
    episodeNumber: 3, qualityIndex: 0, episodes: [{ link: "original", number: 3 }],
    qualities: [
      { label: "Season 1 2160p HEVC" },
      { label: "Season 1 1080p H264", directLinks: [{ title: "Episode 3", link: "same-episode", number: 3 }] },
      { label: "Season 2 720p H264" },
    ],
  };
  let switched;
  const player = androidFile(ref, "src/lib/playerSwitch.ts", {
    "@/lib/queryClient": {},
    "@/lib/providerApi": { providerApi: { getStream: async () => [{}] } },
    "@/lib/streams": { selectPlaybackStreams: async () => ({
      streams: [{ link: "https://example.test/1080p.mp4" }], startIndex: 0,
    }) },
    "@/lib/episodes": episodes,
    "@/store/usePreferencesStore": { usePreferencesStore: { getState: () => ({ defaultQuality: "auto" }) } },
    "@/store/usePlayerStore": { usePlayerStore: { getState: () => ({
      currentVideoUrl: "playing", playerMeta: current, setVideo: (_url, _streams, _index, meta) => { switched = meta; },
    }) } },
  });
  assert.deepEqual(Array.from(player.playerQualityOptions(current), ({ index }) => index), [0, 1]);
  assert.equal(player.pickFallbackQuality(current), 1);
  assert.equal(await player.switchQuality(1, 112), true);
  assert.equal(switched.link, "same-episode");
  assert.equal(switched.resumeAt, 112);
  console.log(JSON.stringify({
    ref, sha: execFileSync("git", ["rev-parse", ref], { encoding: "utf8" }).trim(),
    probes, checked: selection.checkedCount, failed: selection.failedCount,
    skippedDownloadOnly: selection.skippedDownloadOnly, start: selection.streams[selection.startIndex].link,
    switched: switched.link, resumeAt: switched.resumeAt, fallbackQuality: 1, nextEpisode: 4,
  }));
}

delete process.env.K45_TRUSTED_CLIENT_IP_HEADER;
const statuses = {};
for (let i = 0; i <= 180; i++) {
  const client = i % 2 === 0 ? "192.0.2.1" : "192.0.2.2";
  const { status } = await GET(new Request("http://localhost/api/proxy/providers?op=invalid", {
    headers: { "x-forwarded-for": client },
  }));
  statuses[status] = (statuses[status] ?? 0) + 1;
}
assert.deepEqual(statuses, { 400: 180, 429: 1 });
console.log(JSON.stringify({ sharedRateLimit: statuses, forwardedClients: 2 }));

const { request } = providerNetwork(AbortSignal.timeout(1000));
await assert.rejects(request("https://example.com:8443/"), /destination is unavailable/);
console.log(JSON.stringify({ nonDefaultPort: "rejected before network" }));
