// Regression test: on Android TV the player must always hold remote focus.
// Android only delivers remote keys (OK, arrows, Play/Pause) to the app while
// one of its views is focused; when the auto-hiding controls unmounted, nothing
// was focusable and only Back worked. Source-level check of the safeguards.
// Run: node tests/tv-player-focus.regression.test.cjs
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const read = (rel) => fs.readFileSync(path.join(__dirname, "..", rel), "utf8");
const overlay = read("src/player/PlayerOverlay.tsx");

// 1. An invisible focusable catcher exists for when the TV controls are hidden.
const catcher = overlay.match(
  /\{IS_TV &&\s*expanded &&\s*!panel &&[\s\S]*?!\(showControls && !locked && !startupLoading\) \? \(([\s\S]*?)\) : null\}/,
);
assert.ok(catcher, "TV remote catcher block present");
assert.ok(/<Pressable[\s\S]*focusable[\s\S]*hasTVPreferredFocus/.test(catcher[1]), "catcher is focusable and takes focus");
assert.ok(/onPress=\{\(\) => wake\(\)\}/.test(catcher[1]), "OK on the catcher shows the controls");

// 2. Its condition is the exact complement of when the TV control bar shows.
assert.ok(
  overlay.includes("{IS_TV && showControls && !panel && !locked && !startupLoading ? ("),
  "TV control bar condition unchanged (catcher must mirror it)",
);

// 3. Remote keys are handled while hidden (seek) and a paused TV keeps controls.
assert.ok(/case "left":\s*if \(scrub\) return seek\(-10\);/.test(overlay), "left seeks when hidden or on the timeline");
assert.ok(/case "right":\s*if \(scrub\) return seek\(10\);/.test(overlay), "right seeks when hidden or on the timeline");
assert.ok(/if \(IS_TV && pausedRef\.current\) return;/.test(overlay), "paused TV keeps its controls");

// 4. TV screens restore focus when shown again.
assert.ok(read("src/TV/TvApp.tsx").includes("useRestoreTvFocus(activeNavRef)"), "TV home restores focus");
assert.ok(read("src/TV/screens/TvDetailScreen.tsx").includes("useRestoreTvFocus(playRef)"), "title page restores focus");

// 5. The TV timeline is a focusable slider that traps Left/Right and tells the
//    overlay to seek while it has focus.
const controls = read("src/TV/TvPlayerControls.tsx");
assert.ok(/function SeekBar[\s\S]*hasTVPreferredFocus[\s\S]*nextFocusLeft=\{self\}[\s\S]*nextFocusRight=\{self\}/.test(controls), "seek bar takes focus and traps left/right");
assert.ok(/const scrub = hidden \|\| \(tvSeekBarFocusedRef\.current && !tvPanelRef\.current\);/.test(overlay), "overlay seeks while the timeline is focused");
assert.ok(/tvLastSeekAtRef\.current < 200/.test(overlay), "held keys are rate-limited");

console.log("PASS tv-player-focus regression");
