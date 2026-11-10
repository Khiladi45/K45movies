// Regression test: TV search must hand the remote to the results.
// A text field nested in a focusable box kept focus and its keyboard
// connection after the keyboard closed: arrows could not reach the posters and
// OK on a poster went to the field instead of opening the movie.
// Run: node tests/tv-search.regression.test.cjs
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(
  path.join(__dirname, "..", "src", "TV", "screens", "TvSearchScreen.tsx"),
  "utf8",
);

// The TextInput is not inside the Focusable search box.
const box = src.match(/<Focusable[\s\S]*?<\/Focusable>/);
assert.ok(box, "search box present");
assert.ok(!/<TextInput/.test(box[0]), "TextInput is not nested in the focusable box");

// It exists only while typing and is never a D-pad target.
assert.ok(/\{typing \? \([\s\S]*?<TextInput[\s\S]*?focusable=\{false\}/.test(src), "TextInput only while typing, not focusable");

// Typing ends: keyboard dismissed, field removed, focus moves to the results.
assert.ok(/Keyboard\.dismiss\(\);\s*setTyping\(false\)/.test(src), "keyboard dismissed and field removed");
assert.ok(/Keyboard\.addListener\("keyboardDidHide", finishTyping\)/.test(src), "Back on the keyboard ends typing");
assert.ok(/requestFocus\(firstResultRef\)/.test(src), "focus moves to the first result");

// The grid exposes its first poster for that.
const grid = fs.readFileSync(path.join(__dirname, "..", "src", "TV", "components", "PosterGrid.tsx"), "utf8");
assert.ok(/ref=\{index === 0 \? firstRef : undefined\}/.test(grid), "first poster ref");

console.log("PASS tv-search regression");
