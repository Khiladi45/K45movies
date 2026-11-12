// Regression test: YouTube layout on TV — Shorts player, Shorts section,
// Search and Watchlist (Phase 3c+3d).
// Run: node tests/tv-youtube-shorts-search.regression.test.cjs
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const w = require(path.join(root, "src", "TV", "youtube", "ytWatch.ts"));

// Pure helpers.
assert.deepStrictEqual(w.chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
assert.deepStrictEqual(w.chunk([], 3), []);
const base = [{ id: "a" }, { id: "b" }];
assert.strictEqual(w.appendNew(base, undefined), base);
assert.strictEqual(w.appendNew(base, [{ id: "a" }]), base, "no new items → same list (no re-render)");
assert.deepStrictEqual(w.appendNew(base, [{ id: "b" }, { id: "c" }]).map((v) => v.id), ["a", "b", "c"]);
assert.strictEqual(w.shortsKey("up", 1), "prev");
assert.strictEqual(w.shortsKey("down", -1), "next");
assert.strictEqual(w.shortsKey("right", 1), "comments");
assert.strictEqual(w.shortsKey("playPause", 1), "toggle");
assert.strictEqual(w.shortsKey("down", 0), "none", "key-down ignored");
assert.strictEqual(w.shortsKey("left", 1), "none", "left is free for leaving");

// Shorts player.
const shorts = read("src/TV/youtube/TvYtShortsScreen.tsx");
assert.ok(shorts.includes("key={active.id}"), "only the active Short mounts a player");
assert.ok(shorts.includes("prefetchStreams(v.link)"), "neighbours prefetched");
assert.ok(shorts.includes("hasTVPreferredFocus") && shorts.includes("focusable"), "focus catcher");
assert.ok(shorts.includes("if (comments) {") && shorts.includes("closeComments()"), "Back closes comments first");
assert.ok(shorts.includes("paused={userPaused || !isFocused}"), "pauses when covered");
assert.ok(!/TextInput/.test(shorts));

// Search uses the keyboard pattern (TextInput only inside TvSearchBox).
const search = read("src/TV/youtube/TvYtSearchScreen.tsx");
assert.ok(search.includes("<TvSearchBox") && !/TextInput/.test(search), "no TextInput nested in focusables");
assert.ok(search.includes("useYtSearch(query)") && search.includes("useYtSuggestions(query)"));
assert.ok(search.includes("addSearch(query, firstImage)"), "recent search with thumbnail like phone");
assert.ok(search.includes("requestFocus(firstResultRef)"), "focus moves to results");

// Watchlist from the YouTube library store.
const wl = read("src/TV/youtube/TvYtWatchlistScreen.tsx");
assert.ok(wl.includes("useYtLibraryStore") && wl.includes("removeSaved(removing.id)"));
assert.ok(wl.includes("useRestoreTvFocus(firstRef)"));

// Shell: no placeholders; routes registered.
const shell = read("src/TV/shell/YouTubeShell.tsx");
assert.ok(!shell.includes("TvComingSoon"), "no placeholders left in the YouTube shell");
for (const c of ["<TvYtSearchScreen />", "<TvYtShortsSection />", "<TvYtWatchlistScreen />"]) assert.ok(shell.includes(c), c);
const app = read("src/TV/TvApp.tsx");
assert.ok(app.includes('name="TvYtShorts" component={TvYtShortsScreen}'));
assert.ok(!app.includes("TvYtPlaceholder"));

console.log("tv-youtube-shorts-search regression: OK");
