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
  /\{IS_TV &&\s*expanded &&\s*!panel &&[\s\S]*?!\(showControls && !locked && !startupLoading && hasRendered\) \? \(([\s\S]*?)\) : null\}/,
);
assert.ok(catcher, "TV remote catcher block present");
assert.ok(/<Pressable[\s\S]*focusable[\s\S]*hasTVPreferredFocus/.test(catcher[1]), "catcher is focusable and takes focus");
assert.ok(/onPress=\{\(\) => togglePlay\(\)\}/.test(catcher[1]), "OK on the catcher plays/pauses");

// 2. Its condition is the exact complement of when the TV control bar shows.
assert.ok(
  overlay.includes("{IS_TV && showControls && !panel && !locked && !startupLoading && hasRendered ? ("),
  "TV control bar condition unchanged (catcher must mirror it)",
);

// 3. Remote keys go through remoteAction (UP events + long presses) and a
//    paused TV keeps its controls.
assert.ok(/const action = remoteAction\(type, evt\?\.eventKeyAction, scrubZone\);/.test(overlay), "keys mapped by remoteAction");
assert.ok(/case "holdStart":[\s\S]*setInterval/.test(overlay), "holding Left/Right scrubs continuously");
assert.ok(/case "boostStart":\s*setHoldBoost\(true\)/.test(overlay), "holding OK = 2x");
assert.ok(/rate=\{holdBoost \? 2 : rate\}/.test(overlay), "2x applied to the video");
assert.ok(/if \(IS_TV && pausedRef\.current\) return;/.test(overlay), "paused TV keeps its controls");

// 4. TV screens restore focus when shown again.
assert.ok(read("src/TV/TvApp.tsx").includes("useRestoreTvFocus(activeNavRef)"), "TV home restores focus");
assert.ok(read("src/TV/screens/TvDetailScreen.tsx").includes("useRestoreTvFocus(playRef)"), "title page restores focus");

// 5. Center Play/Pause has first focus and keeps Left/Right/Up (so they seek).
const controls = read("src/TV/TvPlayerControls.tsx");
assert.ok(/function CenterButton[\s\S]*hasTVPreferredFocus[\s\S]*nextFocusLeft=\{self\}[\s\S]*nextFocusRight=\{self\}[\s\S]*nextFocusUp=\{self\}/.test(controls), "center button takes focus and traps arrows");
assert.ok(/onLongPress=\{\(\) => \{\}\}/.test(controls), "long OK does not also toggle play");
assert.ok(/const scrubZone = !panelOpen && \(hidden \|\| tvZoneRef\.current === "center"\);/.test(overlay), "arrows seek in the center zone");

// 6. Player menus (Screen fit, Audio, ...) keep remote focus inside them and
//    open on the current option; focus used to fall onto controls behind.
assert.ok(
  /<TVFocusGuideView\s+autoFocus=\{IS_TV\}\s+trapFocusUp=\{IS_TV\}\s+trapFocusDown=\{IS_TV\}\s+trapFocusLeft=\{IS_TV\}\s+trapFocusRight=\{IS_TV\}\s+style=\{styles\.panel\}/.test(overlay),
  "option menu traps focus on TV",
);
assert.ok(/preferred=\{IS_TV && index === focusIndex\}/.test(overlay), "menu opens on the current option");
assert.ok(/hasTVPreferredFocus=\{preferred\}/.test(overlay), "PanelRow honours preferred");
const side = read("src/player/PlayerSidePanels.tsx");
assert.ok(/<TVFocusGuideView\s+autoFocus=\{IS_TV\}[\s\S]*trapFocusRight=\{IS_TV\}/.test(side), "side panels trap focus on TV");

console.log("PASS tv-player-focus regression");
