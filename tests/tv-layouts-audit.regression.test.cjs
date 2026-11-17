// Regression test: Phase 4 audit for the Provider Based and YouTube TV
// layouts — first focus / focus restore on every new screen, Back fallbacks,
// the keyboard rule, and out-of-scope features kept off TV.
// Run: node tests/tv-layouts-audit.regression.test.cjs
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

// Every new routed screen / rail section has a first focus or a focus restore.
const screens = [
  "src/TV/provider/TvProviderHomeScreen.tsx",
  "src/TV/provider/TvCategoryScreen.tsx",
  "src/TV/provider/TvProviderSearchScreen.tsx",
  "src/TV/provider/TvProviderDetailScreen.tsx",
  "src/TV/provider/TvProviderWatchlistScreen.tsx",
  "src/TV/youtube/TvYtHomeScreen.tsx",
  "src/TV/youtube/TvYtVideoScreen.tsx",
  "src/TV/youtube/TvYtShortsScreen.tsx",
  "src/TV/youtube/TvYtShortsSection.tsx",
  "src/TV/youtube/TvYtSearchScreen.tsx",
  "src/TV/youtube/TvYtWatchlistScreen.tsx",
];
for (const file of screens) {
  const src = read(file);
  assert.ok(
    /hasTVPreferredFocus|useRestoreTvFocus|TvSearchBox|requestFocus\(/.test(src),
    `${file}: needs a deterministic first focus or focus restore`,
  );
  // TextInput only inside TvSearchBox (never nested in a focusable).
  assert.ok(!/\bTextInput\b/.test(src), `${file}: no TextInput`);
  // Out of scope on TV.
  const code = src.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(!/Share\.share|setMini|PictureInPicture|ScreenOrientation|startDownload/.test(code), `${file}: TV scope`);
}

// Player: when there is no screen to go back to, TV goes to TvMain (there is
// no "Home" route on TV); phones still go to "Home".
const overlay = read("src/player/PlayerOverlay.tsx");
assert.ok(!/navigate\("Home"\)/.test(overlay), "no bare Home fallback left");
assert.strictEqual((overlay.match(/navigate\(IS_TV \? "TvMain" : "Home"\)/g) || []).length, 3);
assert.ok(read("src/TV/TvApp.tsx").includes('name="TvMain"'), "TvMain route exists");

// Shells: one per layout, no placeholders, Back → home → exit dialog.
const tvShell = read("src/TV/shell/TvShell.tsx");
assert.ok(tvShell.includes("hardwareBackPress") && tvShell.includes("Exit K45movies?"));
for (const f of ["src/TV/shell/ProviderShell.tsx", "src/TV/shell/YouTubeShell.tsx"]) {
  assert.ok(!read(f).includes("TvComingSoon"), `${f}: no placeholders`);
}
assert.ok(!fs.existsSync(path.join(root, "src/TV/shell/TvComingSoon.tsx")));
assert.ok(!fs.existsSync(path.join(root, "src/TV/youtube/TvYtPlaceholder.tsx")));

console.log("tv-layouts-audit regression: OK");
