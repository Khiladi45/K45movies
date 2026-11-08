// Regression test: the player's Auto screen fit (src/lib/screenFit.ts).
// Run: node tests/screen-fit.regression.test.cjs   (Node >= 22.18)
const assert = require("assert");
const path = require("path");
const { autoFit } = require(path.join(__dirname, "..", "src", "lib", "screenFit.ts"));

const TV = 16 / 9;
assert.strictEqual(autoFit(16 / 9, TV), "stretch", "16:9 on 16:9 fills");
assert.strictEqual(autoFit(1.85, TV), "stretch", "1.85:1 (4% off) fills without bars");
assert.strictEqual(autoFit(4 / 3, TV), "fit", "4:3 keeps shape with side bars");
assert.strictEqual(autoFit(2.39, TV), "fit", "cinemascope keeps shape with black bars");
assert.strictEqual(autoFit(2.0, TV), "fit", "2:1 (12.5% off) is not distorted");
assert.strictEqual(autoFit(null, TV), "fit", "unknown size fits");
assert.strictEqual(autoFit(9 / 16, TV), "fit", "vertical video fits");
console.log("PASS screen-fit regression");
