// Regression test: the SHA-1 injected into the provider sandbox as
// context.Aes.sha1 (used by primewire to sign search URLs) must match Node's
// crypto across boundary lengths and unicode. Run: node tests/sha1.regression.test.cjs
const { createHash } = require("crypto");
const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(
  path.join(__dirname, "..", "src", "components", "SandboxWebView.tsx"),
  "utf-8",
);

// Extract the sha1Hex function body from the sandbox HTML template and eval it.
const match = source.match(/function sha1Hex\(input\) \{[\s\S]*?\n  \}/);
if (!match) {
  console.error("FAIL: sha1Hex not found in SandboxWebView.tsx");
  process.exit(1);
}
// eslint-disable-next-line no-eval
const sha1Hex = eval(`(${match[0]})`);

const vectors = [
  "",
  "abc",
  "The quick brown fox jumps over the lazy dog",
  "avatarJyjId97F9PVqUPuMO0",
  "a".repeat(55),
  "a".repeat(56),
  "a".repeat(64),
  "a".repeat(119),
  "a".repeat(120),
  "ümläut emoji 🎬 test",
  "x".repeat(1000),
];

let failures = 0;
for (const v of vectors) {
  const expected = createHash("sha1").update(v, "utf8").digest("hex");
  const actual = sha1Hex(v);
  if (expected !== actual) {
    failures++;
    console.error(
      `FAIL ${JSON.stringify(v.slice(0, 24))}: expected ${expected}, got ${actual}`,
    );
  }
}

// The sandbox context must actually inject Aes for providers that destructure it.
if (!/Aes: \{ sha1:/.test(source)) {
  failures++;
  console.error("FAIL: context.Aes.sha1 injection missing from executeProvider");
}

if (failures === 0) {
  console.log(`PASS: sha1Hex matches crypto across ${vectors.length} vectors; Aes injected`);
  process.exit(0);
}
process.exit(1);
