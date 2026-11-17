// Regression test: Provider Based layout on TV — Watchlist (Phase 2d) and the
// shared TV dialog. Run: node tests/tv-provider-watchlist.regression.test.cjs
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const screen = read("src/TV/provider/TvProviderWatchlistScreen.tsx");
assert.ok(screen.includes("useWatchlistStore((s) => s.movies)"), "reads the phone watchlist store");
assert.ok(screen.includes("(b.addedAt || 0) - (a.addedAt || 0)"), "newest first");
assert.ok(screen.includes("onPress={open}"), "OK opens the title");
assert.ok(screen.includes("onLongPress={setRemoving}"), "long-press OK offers removal");
assert.ok(screen.includes("removeFromWatchlist(removing.link)"), "removal uses the store");
assert.ok(screen.includes("removeClippedSubviews={false}"));

const dialog = read("src/TV/components/TvDialog.tsx");
assert.ok(dialog.includes("<Modal") && dialog.includes("onRequestClose={onClose}"), "Back closes the dialog");
assert.ok(dialog.includes("hasTVPreferredFocus={index === 0}"), "first action focused");

const card = read("src/TV/provider/PostCard.tsx");
assert.ok(card.includes("onLongPress={onLongPress ? () => onLongPress(post) : undefined}"));

// Every Provider Based section is now a real screen.
const shell = read("src/TV/shell/ProviderShell.tsx");
for (const s of ["<TvProviderHomeScreen />", "<TvProviderSearchScreen />", "<TvProviderWatchlistScreen />", "<ProvidersSection />", "<TvSettingsScreen />"]) {
  assert.ok(shell.includes(s), `Provider shell renders ${s}`);
}
assert.ok(!shell.includes("TvComingSoon"), "no placeholders left in the Provider shell");

console.log("PASS tv-provider-watchlist regression");
