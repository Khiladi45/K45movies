// Regression test: Android TV honours the chosen layout (Phase 1).
// - TV default stays Movie Based, also for older TV installs that have
//   layout "provider" saved without anyone choosing it.
// - Phones keep exactly the previous default/merge ("provider").
// - The Movie Based TV shell (TvMain) is unchanged; other layouts get shells.
// Run: node tests/tv-layout.regression.test.cjs   (Node >= 22.18)
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const { resolveLayout } = require(path.join(root, "src", "lib", "tvLayout.ts"));

// Phone: identical to the old merge.
assert.strictEqual(resolveLayout(undefined, false), "provider");
assert.strictEqual(resolveLayout({}, false), "provider");
assert.strictEqual(resolveLayout({ layout: "provider" }, false), "provider");
assert.strictEqual(resolveLayout({ layout: "movie" }, false), "movie");
assert.strictEqual(resolveLayout({ layout: "youtube" }, false), "youtube");
assert.strictEqual(resolveLayout({ layout: "bogus" }, false), "provider");
// A TV-only flag must not change phones.
assert.strictEqual(resolveLayout({ layout: "provider", tvLayoutChosen: true }, false), "provider");

// TV: Movie unless chosen on the TV.
assert.strictEqual(resolveLayout(undefined, true), "movie");
assert.strictEqual(resolveLayout({ layout: "provider" }, true), "movie", "accidental save stays Movie");
assert.strictEqual(resolveLayout({ layout: "youtube" }, true), "movie");
assert.strictEqual(resolveLayout({ layout: "provider", tvLayoutChosen: true }, true), "provider");
assert.strictEqual(resolveLayout({ layout: "youtube", tvLayoutChosen: true }, true), "youtube");
assert.strictEqual(resolveLayout({ layout: "movie", tvLayoutChosen: true }, true), "movie");
assert.strictEqual(resolveLayout({ layout: "bogus", tvLayoutChosen: true }, true), "movie");

// Store wiring.
const store = read("src/store/useLayoutStore.ts");
assert.ok(store.includes("layout: IS_TV ? TV_DEFAULT_LAYOUT : PHONE_DEFAULT_LAYOUT,"), "defaults per device");
assert.ok(store.includes("set(IS_TV ? { layout, tvLayoutChosen: true } : { layout }),"), "TV picker marks the choice; phone setLayout unchanged");
assert.ok(store.includes("layout: resolveLayout(saved, IS_TV),"), "merge uses resolveLayout");

// Shell switch: Movie renders the existing TvMain; others get their own shells.
const app = read("src/TV/TvApp.tsx");
assert.ok(/<Stack\.Screen name="TvMain" component=\{TvLayoutRoot\} \/>/.test(app), "TvMain route goes through the layout shell");
assert.ok(app.includes("<TvLayoutShell MovieShell={TvMain} />"), "Movie layout = existing TvMain");
const shell = read("src/TV/shell/TvLayoutShell.tsx");
assert.ok(/layout === "provider"\) return <ProviderShell key="provider" \/>/.test(shell));
assert.ok(/layout === "youtube"\) return <YouTubeShell key="youtube" \/>/.test(shell));
assert.ok(/return <MovieShell key="movie" \/>/.test(shell));

// The Movie shell is untouched: same 4 sections and screens, same SideNav.
for (const line of [
  '{section === "home" ? <TvHomeScreen /> : null}',
  '{section === "search" ? <TvSearchScreen /> : null}',
  '{section === "mylist" ? <TvMyListScreen /> : null}',
  '{section === "settings" ? <TvSettingsScreen /> : null}',
  "<SideNav section={section} onSelect={setSection} activeRef={activeNavRef} />",
]) {
  assert.ok(app.includes(line), `TvMain unchanged: ${line}`);
}
const sideNav = read("src/TV/components/SideNav.tsx");
assert.ok(/const ITEMS: [\s\S]*"home"[\s\S]*"search"[\s\S]*"mylist"[\s\S]*"settings"/.test(sideNav), "Movie SideNav items unchanged");

// Rails per layout.
const provider = read("src/TV/shell/ProviderShell.tsx");
assert.deepStrictEqual(
  [...provider.matchAll(/\{ key: "(\w+)", label:/g)].map((m) => m[1]),
  ["home", "search", "watchlist", "providers", "settings"],
);
const youtube = read("src/TV/shell/YouTubeShell.tsx");
assert.deepStrictEqual(
  [...youtube.matchAll(/\{ key: "(\w+)", label:/g)].map((m) => m[1]),
  ["home", "search", "shorts", "watchlist", "settings"],
);
// New shells: Back to Home, exit dialog on Home, active rail item focused.
const tvShell = read("src/TV/shell/TvShell.tsx");
assert.ok(/if \(section !== home\) \{\s*setSection\(home\);/.test(tvShell));
assert.ok(tvShell.includes('Alert.alert("Exit K45movies?"'));
assert.ok(read("src/TV/shell/TvSideRail.tsx").includes("hasTVPreferredFocus={isActive}"));

// Settings: Layout row first; language rows only for Movie Based.
const settings = read("src/TV/screens/TvSettingsScreen.tsx");
assert.ok(/<Text style=\{styles\.title\}>Settings<\/Text>\s*<ChoiceRow<AppLayout>\s*title="Layout"/.test(settings), "Layout row at the top");
assert.ok(/\{isMovie \? \(\s*<>\s*<ChoiceRow\s*title="Preferred audio language"/.test(settings), "language rows only for Movie");
assert.ok(settings.includes("export function ProvidersBlock()"), "ProvidersBlock reusable");

console.log("PASS tv-layout regression");
