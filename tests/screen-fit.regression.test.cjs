// Regression test: the player's Auto screen fit (src/lib/screenFit.ts).
// Run: node tests/screen-fit.regression.test.cjs   (Node >= 22.18)
const assert = require("assert");
const path = require("path");
const { autoFit, scaleYFor, HEIGHT_120 } = require(path.join(__dirname, "..", "src", "lib", "screenFit.ts"));

const TV = 16 / 9;
assert.strictEqual(autoFit(16 / 9, TV), "stretch", "16:9 on 16:9 fills");
assert.strictEqual(autoFit(1.85, TV), "stretch", "1.85:1 (4% off) fills without bars");
assert.strictEqual(autoFit(4 / 3, TV), "fit", "4:3 keeps shape with side bars");
assert.strictEqual(autoFit(2.39, TV), "fit", "cinemascope keeps shape with black bars");
assert.strictEqual(autoFit(2.0, TV), "fit", "2:1 (12.5% off) is not distorted");
assert.strictEqual(autoFit(null, TV), "fit", "unknown size fits");
assert.strictEqual(autoFit(9 / 16, TV), "fit", "vertical video fits");
// "Height 120%": 20% taller, width unchanged; every other mode untouched.
assert.strictEqual(scaleYFor(HEIGHT_120), 1.2);
assert.strictEqual(scaleYFor("height120"), 1.2);
assert.strictEqual(scaleYFor("contain"), 1);
assert.strictEqual(scaleYFor("auto"), 1);
assert.strictEqual(scaleYFor(undefined), 1);
// Auto is the default screen fit on phones and TV.
const overlay = require("fs").readFileSync(
  path.join(__dirname, "..", "src", "player", "PlayerOverlay.tsx"),
  "utf8",
);
assert.ok(overlay.includes("const [aspectIdx, setAspectIdx] = useState(0);"), "Auto default everywhere");
assert.ok(/const ASPECTS[\s\S]*?\{ key: AUTO_ASPECT,/.test(overlay), "Auto is the first aspect");
console.log("PASS screen-fit regression");
