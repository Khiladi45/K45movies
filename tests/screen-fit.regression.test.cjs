// Regression test: the player's Auto screen fit (src/lib/screenFit.ts).
// Run: node tests/screen-fit.regression.test.cjs   (Node >= 22.18)
const assert = require("assert");
const path = require("path");
const { autoFit, scaleYFor, HEIGHT_120, FILL_NO_BARS, fitTransform, BAKED_BARS_ZOOM } = require(path.join(__dirname, "..", "src", "lib", "screenFit.ts"));

const TV = 16 / 9;
assert.strictEqual(autoFit(16 / 9, TV), "stretch", "16:9 on 16:9 fills");
assert.strictEqual(autoFit(1.85, TV), "stretch", "1.85:1 (4% off) fills without bars");
assert.strictEqual(autoFit(4 / 3, TV), "fit", "4:3 keeps shape with side bars");
assert.strictEqual(autoFit(2.39, TV), "fit", "cinemascope keeps shape with black bars");
assert.strictEqual(autoFit(2.0, TV), "fit", "2:1 (12.5% off) is not distorted");
assert.strictEqual(autoFit(null, TV), "fit", "unknown size fits");
assert.strictEqual(autoFit(9 / 16, TV), "fit", "vertical video fits");
// "No black bars" modes.
const near = (a, b) => Math.abs(a - b) < 1e-9;
// Fill: a real wide film is zoomed to cover (shape kept), no extra scale.
assert.deepStrictEqual(fitTransform(FILL_NO_BARS, 2.39, TV), { resize: "cover", scaleX: 1, scaleY: 1 });
assert.deepStrictEqual(fitTransform(FILL_NO_BARS, 4 / 3, TV), { resize: "cover", scaleX: 1, scaleY: 1 });
// Fill: a 16:9 file (bars baked into the picture) is zoomed x1.34 to hide them.
assert.deepStrictEqual(fitTransform(FILL_NO_BARS, 16 / 9, TV), { resize: "contain", scaleX: BAKED_BARS_ZOOM, scaleY: BAKED_BARS_ZOOM });
assert.ok(near(BAKED_BARS_ZOOM, 1.34) && (16 / 9) / 2.39 * BAKED_BARS_ZOOM >= 0.99, "x1.34 covers 2.39:1 bars in a 16:9 file");
// Height fill: width kept, height stretched exactly to the screen (max x1.6).
const h = fitTransform(HEIGHT_120, 2.0, TV);
assert.ok(h.resize === "contain" && h.scaleX === 1 && near(h.scaleY, 2.0 / TV), "2:1 film fills the height");
assert.strictEqual(fitTransform(HEIGHT_120, 3.0, TV).scaleY, 1.6, "capped");
assert.strictEqual(fitTransform(HEIGHT_120, 16 / 9, TV).scaleY, BAKED_BARS_ZOOM, "baked-in bars");
assert.strictEqual(fitTransform(HEIGHT_120, null, TV).scaleY, BAKED_BARS_ZOOM, "unknown size");
// Every other mode is untouched.
for (const key of ["contain", "cover", "stretch", "auto", undefined]) assert.strictEqual(fitTransform(key, 2.39, TV), null);
assert.strictEqual(scaleYFor("contain"), 1);

// Auto is the default screen fit on phones and TV.
const overlay = require("fs").readFileSync(
  path.join(__dirname, "..", "src", "player", "PlayerOverlay.tsx"),
  "utf8",
);
assert.ok(overlay.includes("return index >= 0 ? index : 0;"), "Auto default until the user picks a size");
assert.ok(overlay.includes('setPreference("playerFitKey"'), "chosen size is remembered");
assert.ok(overlay.includes("{ scaleX: expanded ? fillScale.scaleX : 1 }") && overlay.includes("{ scaleY: expanded ? fillScale.scaleY : 1 }"));
assert.ok(overlay.includes('label: "Fill screen (no black bars)"') && overlay.includes('label: "Height fill (no black bars)"'));
assert.ok(/const ASPECTS[\s\S]*?\{ key: AUTO_ASPECT,/.test(overlay), "Auto is the first aspect");
console.log("PASS screen-fit regression");
