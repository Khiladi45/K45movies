// Regression test: plugins/with-android-tv.js keeps the single APK usable on
// both phones and Android TV. Evaluates the Expo config plugins (no native
// build needed) and checks the generated Android manifest and gradle props.
// Run: node tests/tv-manifest.regression.test.cjs
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.join(__dirname, "..");
const out = execFileSync("npx", ["expo", "config", "--type", "introspect", "--json"], {
  cwd: root,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "ignore"],
  maxBuffer: 64 * 1024 * 1024,
});
const config = JSON.parse(out);
const android = config._internal.modResults.android;
const manifest = android.manifest.manifest;

const features = Object.fromEntries(
  (manifest["uses-feature"] || []).map((f) => [f.$["android:name"], f.$["android:required"]]),
);
assert.strictEqual(features["android.hardware.touchscreen"], "false", "touchscreen optional");
assert.strictEqual(features["android.hardware.faketouch"], "false", "faketouch optional");
assert.strictEqual(features["android.software.leanback"], "false", "leanback optional (phones too)");

const app = manifest.application[0];
assert.strictEqual(app.$["android:banner"], "@drawable/tv_banner", "TV banner set");

const launchers = app.activity
  .flatMap((a) => a["intent-filter"] || [])
  .map((f) => (f.category || []).map((c) => c.$["android:name"]))
  .find((cats) => cats.includes("android.intent.category.LAUNCHER"));
assert.ok(launchers, "phone launcher entry kept");
assert.ok(
  launchers.includes("android.intent.category.LEANBACK_LAUNCHER"),
  "TV home-screen (leanback) entry added",
);

const abis = (android.gradleProperties || []).find((p) => p.key === "reactNativeArchitectures");
assert.strictEqual(abis && abis.value, "armeabi-v7a,arm64-v8a", "32- and 64-bit ARM");

assert.ok(fs.existsSync(path.join(root, "assets", "tv-banner.png")), "banner image exists");

console.log("PASS tv-manifest regression");
