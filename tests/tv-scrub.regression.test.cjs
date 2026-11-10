// Regression test: TV remote seeking and key mapping (src/lib/tvScrub.ts).
// react-native-tvos on Android only sends key-UP events (eventKeyAction 1) for
// normal presses, and a held key as one "long*" event with action 0 then 1.
// The old handler ignored UP events, so Left/Right never seeked on a TV.
// Run: node tests/tv-scrub.regression.test.cjs   (Node >= 22.18)
const assert = require("assert");
const path = require("path");
const { nextScrubTarget, clampSeek, remoteAction, SCRUB_ACCELERATE_AFTER_MS } = require(
  path.join(__dirname, "..", "src", "lib", "tvScrub.ts"),
);

// Steps of 10s from the current time, accumulating while pending.
assert.strictEqual(nextScrubTarget(null, 100, 1, 0, 3600), 110);
assert.strictEqual(nextScrubTarget(110, 100, 1, 0, 3600), 120);
assert.strictEqual(nextScrubTarget(null, 100, -1, 0, 3600), 90);
// Holding speeds up to 30s steps.
assert.strictEqual(nextScrubTarget(null, 100, 1, SCRUB_ACCELERATE_AFTER_MS, 3600), 130);
// Clamped to the video; unknown duration (0) does not send it to 0:00.
assert.strictEqual(nextScrubTarget(null, 5, -1, 0, 3600), 0);
assert.strictEqual(nextScrubTarget(null, 3595, 1, 0, 3600), 3600);
assert.strictEqual(nextScrubTarget(null, 100, 1, 0, 0), 110);
assert.strictEqual(clampSeek(500, 0), 500);
assert.strictEqual(clampSeek(500, 300), 300);
assert.strictEqual(clampSeek(-5, 300), 0);

// Key mapping: UP events (1) act; DOWN (0) of a short press is ignored.
assert.deepStrictEqual(remoteAction("right", 1, true), { kind: "step", direction: 1 });
assert.deepStrictEqual(remoteAction("left", 1, true), { kind: "step", direction: -1 });
assert.deepStrictEqual(remoteAction("left", -1, true), { kind: "step", direction: -1 });
assert.deepStrictEqual(remoteAction("left", 0, true), { kind: "none" });
// Focus on the button row: arrows move focus, they don't seek.
assert.deepStrictEqual(remoteAction("right", 1, false), { kind: "wake" });
// Holding Left/Right scrubs until release; release always ends the hold.
assert.deepStrictEqual(remoteAction("longRight", 0, true), { kind: "holdStart", direction: 1 });
assert.deepStrictEqual(remoteAction("longLeft", 0, true), { kind: "holdStart", direction: -1 });
assert.deepStrictEqual(remoteAction("longLeft", 1, false), { kind: "holdEnd" });
// Holding OK = 2x until release.
assert.deepStrictEqual(remoteAction("longSelect", 0, true), { kind: "boostStart" });
assert.deepStrictEqual(remoteAction("longSelect", 1, false), { kind: "boostEnd" });
// Media keys.
assert.deepStrictEqual(remoteAction("playPause", 1, false), { kind: "togglePlay" });
assert.deepStrictEqual(remoteAction("play", 1, false), { kind: "play" });
assert.deepStrictEqual(remoteAction("pause", 1, false), { kind: "pause" });
assert.deepStrictEqual(remoteAction("fastForward", 1, false), { kind: "step", direction: 1 });
assert.deepStrictEqual(remoteAction("rewind", 1, false), { kind: "step", direction: -1 });
// OK itself is handled by the focused button (play/pause), not here.
assert.deepStrictEqual(remoteAction("select", 1, true), { kind: "none" });

console.log("PASS tv-scrub regression");
