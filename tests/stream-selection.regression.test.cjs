// Regression test: start-up stream ranking for the "HD 1080p" preference and
// the preferred-language pick (src/lib/streamRanking.ts).
// Run: node tests/stream-selection.regression.test.cjs   (Node >= 22.18)
const assert = require("assert");
const path = require("path");

const {
  hdRank,
  pickPreferredIndex,
  HD_TARGET_HEIGHT,
  providersInPriorityOrder,
  prioritizeProviderRows,
} = require(
  path.join(__dirname, "..", "src", "lib", "streamRanking.ts"),
);

// 1080p first, then the best below it, then taller (slower) streams, then unknown.
const heights = [2160, 360, null, 1080, 1440, 720];
const ordered = [...heights].sort((a, b) => hdRank(a) - hdRank(b));
assert.deepStrictEqual(ordered, [1080, 720, 360, 1440, 2160, null]);
assert.strictEqual(HD_TARGET_HEIGHT, 1080);

// Preferred language: the HD match wins over an earlier low-res match.
assert.strictEqual(
  pickPreferredIndex(
    [
      { languages: ["ta"], height: 480 },
      { languages: ["hi"], height: 1080 },
      { languages: ["ta", "te"], height: 1080 },
    ],
    "ta",
  ),
  2,
);

// A dead match is never chosen; the next match is.
assert.strictEqual(
  pickPreferredIndex(
    [
      { languages: ["ta"], height: 1080, failed: true },
      { languages: ["ta"], height: 720 },
    ],
    "ta",
  ),
  1,
);

// 4K match only beats nothing; a 1080p match beats it.
assert.strictEqual(
  pickPreferredIndex(
    [
      { languages: ["ta"], height: 2160 },
      { languages: ["ta"], height: 1080 },
    ],
    "ta",
  ),
  1,
);

// No match → -1 (caller keeps the server-check pick).
assert.strictEqual(
  pickPreferredIndex([{ languages: ["en"], height: 1080 }], "ta"),
  -1,
);

// Priority provider (e.g. the user's first choice for Tamil) is searched first.
assert.deepStrictEqual(
  providersInPriorityOrder(["vega", "moviezwap", "hdhub4u"], "moviezwap"),
  ["moviezwap", "vega", "hdhub4u"],
);
assert.deepStrictEqual(providersInPriorityOrder(["vega"], "notInstalled"), ["vega"]);
assert.deepStrictEqual(providersInPriorityOrder(["vega"], null), ["vega"]);

// ...and its rows lead the list, highest quality first; others keep order.
const rows = [
  { id: "a", providerId: "vega", height: 1080 },
  { id: "b", providerId: "moviezwap", height: 720 },
  { id: "c", providerId: "hdhub4u", height: 2160 },
  { id: "d", providerId: "moviezwap", height: 1080 },
  { id: "e", providerId: "moviezwap", height: null },
];
assert.deepStrictEqual(
  prioritizeProviderRows(rows, "moviezwap").map((r) => r.id),
  ["d", "b", "e", "a", "c"],
);
assert.deepStrictEqual(prioritizeProviderRows(rows, null).map((r) => r.id), ["a", "b", "c", "d", "e"]);

console.log("PASS stream-selection regression");
