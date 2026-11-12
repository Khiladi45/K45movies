// Regression test: Provider Based layout on TV — Detail + playback (Phase 2c).
// The TV detail builds the same PlayerMeta as the phone DetailScreen so the
// player's quality / episode / next-episode panels behave the same.
// Run: node tests/tv-provider-detail.regression.test.cjs
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Module = require("module");
const esbuild = require("esbuild");
const root = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

// Bundle the pure module (resolves the "@/" alias via tsconfig paths).
const out = esbuild.buildSync({
  entryPoints: [path.join(root, "src/TV/provider/providerMeta.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  write: false,
  tsconfig: path.join(root, "tsconfig.json"),
  logLevel: "silent",
});
const mod = new Module("providerMeta");
mod._compile(out.outputFiles[0].text, "providerMeta.js");
const { linkListOf, buildProviderPlayerMeta, isSeriesInfo, entryLabel } = mod.exports;

const post = { link: "https://p/movie", title: "Post Title", image: "img", type: "movie" };

// No link list: one "Default" entry playing the post itself (phone fallback).
assert.deepStrictEqual(linkListOf({ title: "Real", type: "movie" }, post), [
  { title: "Default", directLinks: [{ link: "https://p/movie", title: "Real", type: "movie" }] },
]);
assert.strictEqual(entryLabel({ quality: "1080p" }, 0), "1080p");
assert.strictEqual(entryLabel({}, 2), "Option 3");
assert.strictEqual(isSeriesInfo({ type: "series" }, post), true);
assert.strictEqual(isSeriesInfo(null, { type: "series" }), true);

// Movie: linkIndex set, no episode label.
const movieInfo = {
  title: "Movie",
  type: "movie",
  poster: "poster",
  linkList: [
    { title: "720p", directLinks: [{ link: "l720", title: "Movie 720p", type: "movie" }] },
    { title: "1080p", directLinks: [{ link: "l1080", title: "Movie 1080p", type: "movie" }] },
  ],
};
const movieMeta = buildProviderPlayerMeta({
  info: movieInfo,
  post,
  providerId: "vega",
  link: "l1080",
  type: "movie",
  ctx: { qualityIndex: 1, itemIndex: 0, items: movieInfo.linkList[1].directLinks },
});
assert.strictEqual(movieMeta.providerId, "vega");
assert.strictEqual(movieMeta.image, "poster");
assert.strictEqual(movieMeta.isSeries, false);
assert.strictEqual(movieMeta.qualityIndex, 1);
assert.deepStrictEqual(movieMeta.qualities.map((q) => q.label), ["720p", "1080p"]);
assert.strictEqual(movieMeta.linkIndex, 0);
assert.strictEqual(movieMeta.episode, undefined);
assert.strictEqual(movieMeta.episodeNumber, null);

// Series: episode number + label, qualities keep episodesLink.
const seriesInfo = {
  title: "Show",
  type: "series",
  linkList: [{ title: "Season 1", episodesLink: "s1" }, { title: "Season 2", episodesLink: "s2" }],
};
const eps = [
  { link: "e1", title: "Episode 1" },
  { link: "e2", title: "Episode 2" },
];
const seriesMeta = buildProviderPlayerMeta({
  info: seriesInfo,
  post: { ...post, type: "series" },
  providerId: "drive",
  link: "e2",
  type: "series",
  ctx: { qualityIndex: 0, itemIndex: 1, items: eps },
});
assert.strictEqual(seriesMeta.isSeries, true);
assert.strictEqual(seriesMeta.episodeNumber, 2);
assert.strictEqual(seriesMeta.episode, "Episode 2");
assert.strictEqual(seriesMeta.linkIndex, undefined);
assert.strictEqual(seriesMeta.qualities[1].episodesLink, "s2");
assert.deepStrictEqual(seriesMeta.episodes.map((e) => e.link), ["e1", "e2"]);

// Same PlayerMeta fields as the phone builder.
const phone = read("src/Home/screens/DetailScreen.tsx");
for (const field of ["qualities:", "qualityIndex:", "episodes: items", "episodeNumber:", "linkIndex:", "episode:"]) {
  assert.ok(phone.includes(field), `phone builds ${field}`);
}

// Playback hook: pending player → provider stream → server check → real stream.
const hook = read("src/TV/provider/useTvProviderPlayback.ts");
assert.ok(/setVideo\(PENDING, \[\], 0, meta\);\s*navigate\("Player"\);/.test(hook), "pending player then Player route");
assert.ok(hook.includes("providerApi.getStream(providerId, link, type, signal)"), "provider stream");
assert.ok(hook.includes("selectPlaybackStreams(streams, {"), "server check like the phone");
assert.ok(hook.includes("state.setVideo(chosen.link, selection.streams, selection.startIndex, meta)"), "real stream");
assert.ok(hook.includes("current.current?.abort()"), "latest press wins");

// Screen wiring.
const screen = read("src/TV/provider/TvProviderDetailScreen.tsx");
assert.ok(screen.includes("useMeta(providerId, post.link)"));
assert.ok(screen.includes("ref={playRef}") && screen.includes("useRestoreTvFocus(playRef)"), "Play has first focus and is restored");
assert.ok(screen.includes("toggleWatchlist({"), "watchlist toggle");
assert.ok(read("src/TV/TvApp.tsx").includes('<Stack.Screen name="TvProviderDetail" component={TvProviderDetailScreen} />'));
assert.ok(!fs.existsSync(path.join(root, "src/TV/provider/TvProviderDetailPlaceholder.tsx")), "placeholder removed");
// The tv-provider-home test only requires the route; keep the phone screen untouched.
assert.ok(phone.includes("export default function DetailScreen") || phone.includes("DetailScreen"));

console.log("PASS tv-provider-detail regression");
