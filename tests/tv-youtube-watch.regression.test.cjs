// Regression test: YouTube layout on TV — watch page, remote controls and
// panels (Phase 3b+3e). Run: node tests/tv-youtube-watch.regression.test.cjs
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const w = require(path.join(root, "src", "TV", "youtube", "ytWatch.ts"));

// Autoplay: first related non-Short, never the same video (phone rule + guard).
assert.strictEqual(w.nextAutoplay([{ id: "s", isShort: true }, { id: "a" }, { id: "b" }], "x").id, "a");
assert.strictEqual(w.nextAutoplay([{ id: "x" }, { id: "b" }], "x").id, "b");
assert.strictEqual(w.nextAutoplay([{ id: "s", isShort: true }], "x"), undefined);
assert.strictEqual(w.nextAutoplay(undefined, "x"), undefined);

// Clock and progress.
assert.strictEqual(w.formatClock(0), "0:00");
assert.strictEqual(w.formatClock(75), "1:15");
assert.strictEqual(w.formatClock(3725), "1:02:05");
assert.strictEqual(w.formatClock(NaN), "0:00");
assert.strictEqual(w.progressOf(30, 0), 0);
assert.strictEqual(w.progressOf(30, 60), 0.5);
assert.strictEqual(w.progressOf(90, 60), 1);

// Bus: subscribers get updates, unsubscribe stops them.
const bus = w.createBus(1);
const seen = [];
const off = bus.subscribe((v) => seen.push(v));
bus.emit(2);
off();
bus.emit(3);
assert.deepStrictEqual(seen, [2]);
assert.strictEqual(bus.get(), 3);

// Shorts helpers (used by 3c).
assert.strictEqual(w.stepShort(0, -1, 5), 0);
assert.strictEqual(w.stepShort(4, 1, 5), 4);
assert.strictEqual(w.stepShort(2, 1, 5), 3);
assert.strictEqual(w.stepShort(0, 1, 0), 0);
assert.ok(w.isNearActive(3, 4) && w.isNearActive(5, 4) && !w.isNearActive(6, 4));

// Watch page wiring.
const screen = read("src/TV/youtube/TvYtVideoScreen.tsx");
assert.ok(screen.includes('controls="none"'), "TV draws its own controls");
assert.ok(screen.includes("onStateChange={bus.emit}"), "player state goes through the bus");
assert.ok(screen.includes("paused={!isFocused}"), "pauses when another page covers it");
assert.ok(screen.includes("hasTVPreferredFocus"), "first focus on the player frame");
assert.ok(screen.includes("useRestoreTvFocus(boxRef)"), "focus restore");
assert.ok(/if \(panel\)[\s\S]*?closePanel\(\)[\s\S]*?if \(fullscreen\)[\s\S]*?exitFullscreen\(\)/.test(screen), "Back: panel → full screen → page");
assert.ok(screen.includes("autoplay && next"), "autoplay next");
assert.ok(!/TextInput/.test(screen), "no text input on the watch page");
assert.ok(!/download|Share|setMini/i.test(screen.replace(/\/\/.*$/gm, "")), "no downloads/share/mini player on TV");

// Controls: scrub through the shared tested mapper; catcher keeps focus alive.
const controls = read("src/TV/youtube/TvYtControls.tsx");
for (const s of ["remoteAction(", "nextScrubTarget(", "seekTo?.(", "setUserPaused?.(", "setSpeed?.(2)", "useTVEventHandler(", "hasTVPreferredFocus"]) {
  assert.ok(controls.includes(s), `controls use ${s}`);
}
assert.ok(controls.includes("if (!evt || panelRef.current) return;"), "keys ignored while a panel is open");

// Panels reuse the focus-trapped SidePanel.
const panels = read("src/TV/youtube/TvYtPanels.tsx");
assert.ok(panels.includes('from "@/player/PlayerSidePanels"'), "SidePanel reused");
assert.ok(panels.includes("useYtComments(link)") && panels.includes("fetchNextPage"), "comments load more");

// Route registered; Shorts still placeholder until 3c.
const app = read("src/TV/TvApp.tsx");
assert.ok(app.includes('name="TvYtVideo" component={TvYtVideoScreen}'));

console.log("tv-youtube-watch regression: OK");
