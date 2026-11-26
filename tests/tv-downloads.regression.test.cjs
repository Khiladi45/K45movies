// Regression test: downloads on TV in the Movie Based layout — download a
// movie/episode, then Play uses the offline file.
// Run: node tests/tv-downloads.regression.test.cjs
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const m = require(path.join(root, "src", "TV", "downloads", "tvDownloadMatch.ts"));

const movie = { id: 10, mediaType: "movie" };
const ep = (s, e) => ({ id: 20, mediaType: "tv", season: s, episode: e });
const job = (id, status, tmdb, createdAt = 0, progress = 0) => ({ id, status, tmdb, createdAt, progress });

// Matching.
assert.ok(m.sameTmdb(movie, { id: 10, mediaType: "movie" }));
assert.ok(!m.sameTmdb(movie, { id: 11, mediaType: "movie" }));
assert.ok(!m.sameTmdb({ id: 10, mediaType: "tv", season: 1, episode: 1 }, movie), "movie vs show with same id");
assert.ok(m.sameTmdb(ep(1, 2), ep(1, 2)));
assert.ok(!m.sameTmdb(ep(1, 2), ep(1, 3)), "wrong episode");
assert.ok(!m.sameTmdb(ep(2, 2), ep(1, 2)), "wrong season");
assert.ok(!m.sameTmdb(undefined, movie), "phone jobs (no tmdb) never match");

// Finished beats active beats failed; newest inside a group.
const jobs = [
  job("a", "error", movie, 5),
  job("b", "downloading", movie, 3),
  job("c", "completed", movie, 1),
  job("d", "completed", ep(1, 1), 9),
  job("e", "completed", movie, 2),
];
assert.strictEqual(m.findTmdbJob(jobs, movie).id, "e");
assert.strictEqual(m.findTmdbJob(jobs.slice(0, 2), movie).id, "b");
assert.strictEqual(m.findTmdbJob([job("a", "error", movie)], movie).id, "a");
assert.strictEqual(m.findTmdbJob(jobs, ep(1, 2)), undefined);
assert.deepStrictEqual(
  [...m.downloadedEpisodes([job("x", "completed", ep(1, 1)), job("y", "downloading", ep(1, 2)), job("z", "completed", ep(2, 3))], 20, 1)],
  [1],
);

// Labels.
assert.strictEqual(m.downloadTitle("Show", ep(1, 3), "Pilot"), "Show · S1 E3 Pilot");
assert.strictEqual(m.downloadTitle("Film", movie), "Film");
assert.strictEqual(m.downloadButtonState(undefined).label, "Download");
assert.strictEqual(m.downloadButtonState(job("a", "downloading", movie, 0, 0.424)).label, "Downloading 42%");
assert.strictEqual(m.downloadButtonState(job("a", "completed", movie)).state, "done");
assert.strictEqual(m.downloadButtonState(job("a", "error", movie)).state, "failed");
assert.strictEqual(m.downloadButtonState(job("a", "cancelled", movie)).state, "failed");

// Store / manager: tmdb is optional and additive (phones unchanged).
const store = read("src/store/useDownloadsStore.ts");
assert.ok(store.includes("tmdb?: DownloadTmdbRef;"));
const manager = read("src/services/downloadManager.ts");
assert.ok(manager.includes("tmdb?: DownloadTmdbRef;"));
assert.ok(manager.includes("...(options.tmdb ? { tmdb: options.tmdb } : {}),"));

// TV: app storage (no folder-picker Alert), offline file only if it still exists.
const tv = read("src/TV/downloads/tvDownloads.tsx");
assert.ok(tv.includes('setPreference("downloadLocation", "app")') && tv.includes('setPreference("downloadLocationChosen", true)'));
assert.ok(tv.includes('setPreference("wifiOnlyDownloads", false)'), "Ethernet TVs can download");
assert.ok(/ensureAppStorageOnTv\(\);\s*const result = await startDownload\(/.test(tv), "storage fixed before starting");
assert.ok(tv.includes('job.status === "completed" && downloadFileExists(job)'), "offline only with the file present");
assert.ok(tv.includes("playDownloadedJob(job)"));
assert.ok(tv.includes('title="Download which source?"'));

// Title page: Play tries the offline file first, for movies and episodes.
const detail = read("src/TV/screens/TvDetailScreen.tsx");
assert.strictEqual((detail.match(/if \(dl\.offline && dl\.playOffline\(\)\) return;/g) || []).length, 2);
assert.ok(detail.includes("`Play${OFFLINE_SUFFIX}`"));
assert.ok(detail.includes("useRestoreTvFocus(playRef)"), "focus restore kept");
assert.ok(detail.includes('mediaType: "tv", season: current.season, episode: current.episode'));

// Downloads section.
const screen = read("src/TV/downloads/TvDownloadsScreen.tsx");
assert.ok(!/\bTextInput\b/.test(screen + tv), "no TextInput");
assert.ok(screen.includes("useRestoreTvFocus(firstRef)"));
assert.ok(read("src/TV/components/SideNav.tsx").includes('{ key: "downloads", label: "Downloads", icon: "download" }'));

// Provider Based: link-keyed downloads (same ids as phone downloads).
const lj = (id, status, createdAt = 0) => ({ id, status, createdAt });
assert.strictEqual(m.findLinkJob([lj("x", "error", 9), lj("x", "completed", 1)], ["x"]).status, "completed");
assert.strictEqual(m.findLinkJob([lj("post", "completed")], ["item", "post"]).id, "post", "phone movie download (post link)");
assert.strictEqual(m.findLinkJob([lj("other", "completed")], ["item", undefined]), undefined);
const pdl = read("src/TV/provider/useTvProviderDownloads.tsx");
assert.ok(pdl.includes("normalizeStreams(") && pdl.includes("filter((s) => !s.downloadOnly)"), "phone stream rule");
assert.ok(pdl.includes('title="Choose download quality"') && pdl.includes('"Download which episode?"'));
assert.ok(pdl.includes("series ? [link] : [link, post.link]"), "movie matches phone post-link download");
assert.ok(pdl.includes("job.status === \"completed\" && downloadFileExists(job)"), "offline only with the file present");
assert.ok(/ensureAppStorageOnTv\(\);\s*return startDownload\(options\)/.test(tv), "provider downloads use TV storage rules");
const pdetail = read("src/TV/provider/TvProviderDetailScreen.tsx");
assert.ok(/if \(!item\) return;\s*\/\/[^\n]*\n\s*if \(dl\.playOffline\(item\.link\)\) return;\s*play\(/.test(pdetail), "provider Play tries the offline file first");
assert.ok(pdetail.includes("onLongPress={() => dl.openItemMenu(index)}"));
assert.ok(pdetail.includes("useRestoreTvFocus(playRef)"), "focus restore kept");
assert.ok(read("src/TV/shell/ProviderShell.tsx").includes('{ key: "downloads", label: "Downloads", icon: "download" }'));

// Downloads stay out of the YouTube TV layout.
for (const f of fs.readdirSync(path.join(root, "src/TV/youtube"))) {
  assert.ok(!/startDownload|startTv\w*Download/.test(read(`src/TV/youtube/${f}`)), `src/TV/youtube/${f}`);
}

// Fast downloads: parallel byte ranges with a verified fallback to one connection.
assert.ok(manager.includes("const PARALLEL_PARTS = 6;") && manager.includes("const HLS_CONCURRENCY = 12;"));
assert.ok(manager.includes('Range: "bytes=0-1023"') && manager.includes("probe.size !== 1024"), "ranges verified before splitting");
assert.ok(/if \(!fast\) \{\s*await downloadToFile\(/.test(manager), "falls back to one download");
assert.ok(manager.includes('job.storage !== "custom" &&'), "chosen folders keep the old path");

console.log("tv-downloads regression: OK");
