// Regression test: "New in <language> this week" helpers and loader lines.
// Run: node tests/home-rows.regression.test.cjs   (Node >= 22.18)
const assert = require("assert");
const path = require("path");
const fs = require("fs");
const lib = (f) => path.join(__dirname, "..", "src", "lib", f);
const { releaseWindow, bestRatedFirst } = require(lib("releaseWindow.ts"));
const { loaderLine, loaderSteps } = require(lib("loaderMessages.ts"));

// Last 7 days up to today, across a month boundary.
assert.deepStrictEqual(releaseWindow(new Date(2026, 10, 3), 7), { from: "2026-10-27", to: "2026-11-03" });

// Best rated first, then unrated by their (popularity) order, no duplicates.
const rated = [
  { id: 1, rating: 6.5 },
  { id: 2, rating: 8.1 },
  { id: 3, rating: 0 },
];
const popular = [{ id: 4, rating: 0 }, { id: 2, rating: 8.1 }, { id: 5, rating: 0 }];
assert.deepStrictEqual(bestRatedFirst(rated, popular).map((x) => x.id), [2, 1, 3, 4, 5]);

// The row is first and shown above Continue Watching.
const homeRows = fs.readFileSync(path.join(__dirname, "..", "src", "Tmdb", "homeRows.ts"), "utf8");
assert.ok(/rows\.push\(\s*\/\/ First row[\s\S]*New in \$\{langName\} this week/.test(homeRows), "new-this-week row comes first");

// Loader: steps mention the language; lines change over time; slow notice.
assert.strictEqual(loaderSteps("Tamil")[2].label, "Choosing HD · Tamil audio");
assert.notStrictEqual(loaderLine("servers", 0, null), loaderLine("servers", 2600, null));
assert.strictEqual(loaderLine("audio", 0, "Tamil"), "Getting Tamil audio ready…");
assert.strictEqual(loaderLine("buffering", 16000, null), "This server is slow, still trying…");

console.log("PASS home-rows regression");
