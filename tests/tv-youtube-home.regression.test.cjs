// Regression test: YouTube layout on TV — Home (Phase 3a) and the additive
// YtPlayer remote-control API. Run: node tests/tv-youtube-home.regression.test.cjs
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const { buildTvRows, shelfGap, withoutHidden, SHORTS_PER_ROW } = require(
  path.join(root, "src", "TV", "youtube", "ytRows.ts"),
);

// Same gap formula as the phone YtHomeScreen.
const phoneHome = read("src/YouTube/screens/YtHomeScreen.tsx");
assert.ok(phoneHome.includes("5 + ((n * 2654435761) >>> 0) % 4"), "phone gap formula");
for (let n = 0; n < 50; n++) assert.ok(shelfGap(n) >= 5 && shelfGap(n) <= 8);

const vids = [...Array(20)].map((_, i) => ({ id: `v${i}` }));
const shorts = [...Array(20)].map((_, i) => ({ id: `s${i}` }));
const rows = buildTvRows(vids, shorts, 3);
// Every video appears once, in order; rows hold at most 3.
const flat = rows.filter((r) => r.kind === "videos").flatMap((r) => r.items.map((v) => v.id));
assert.deepStrictEqual(flat, vids.map((v) => v.id));
assert.ok(rows.filter((r) => r.kind === "videos").every((r) => r.items.length >= 1 && r.items.length <= 3));
// A Shorts row comes after the first 5-8 videos, then again 5-8 later.
const firstShelf = rows.findIndex((r) => r.kind === "shorts");
const before = rows.slice(0, firstShelf).reduce((n, r) => n + r.items.length, 0);
assert.strictEqual(before, shelfGap(0));
assert.strictEqual(rows[firstShelf].items.length, SHORTS_PER_ROW);
assert.strictEqual(rows[firstShelf].startIndex, 0);
// No Shorts available → no Shorts rows.
assert.ok(buildTvRows(vids, [], 3).every((r) => r.kind === "videos"));
// Hidden filters like phone Home.
assert.deepStrictEqual(
  withoutHidden([{ id: "a", channelName: "X" }, { id: "b", channelName: "Y" }, { id: "c" }], ["c"], ["X"]).map((v) => v.id),
  ["b"],
);

// YtPlayer: additive, optional API only.
const player = read("src/YouTube/components/YtPlayer.tsx");
for (const m of ["seekTo?:", "setQuality?:", "setCaption?:", "setSpeed?:", "setUserPaused?:"]) {
  assert.ok(player.includes(m), `optional handle ${m}`);
}
assert.ok(player.includes("onStateChange?: (state: YtPlayerState) => void;"));
assert.ok(player.includes("streamInfo = false"), "stream info opt-in, default off");
assert.ok(player.includes('(controls === "full" || streamInfo)'), "phone controls still load stream info as before");
// Phone screens don't use the TV-only props.
for (const f of ["src/YouTube/screens/YtVideoScreen.tsx", "src/YouTube/screens/YtShortsScreen.tsx", "src/YouTube/components/YtMiniPlayer.tsx"]) {
  const src = read(f);
  assert.ok(!src.includes("onStateChange") && !src.includes("streamInfo"), `${f} unchanged by the TV API`);
}

// TV home wiring.
const home = read("src/TV/youtube/TvYtHomeScreen.tsx");
assert.ok(home.includes("useYtMixedFeed(tab.topics ?? [], !!tab.topics)") && home.includes("useYtFeed(tab.filter, !tab.topics)"), "same feeds as phone");
assert.ok(home.includes("withoutHidden(feed.data ?? [], hiddenVideos, hiddenChannels)"), "hidden filters");
assert.ok(home.includes("onLongPress={openActions}"), "long-press OK → actions");
assert.ok(home.includes('navigation.navigate("TvYtVideo", { video })'), "TV-only watch route");
assert.ok(home.includes("removeClippedSubviews={false}"));
const actions = read("src/TV/youtube/useYtActions.tsx");
assert.ok(actions.includes("toggleSaved(target)") && actions.includes("hideVideo(target.id)") && actions.includes("hideChannel(target.channelName)"));
assert.ok(!/download|share/i.test(actions.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, "")), "no download or share on TV");
assert.ok(read("src/TV/shell/YouTubeShell.tsx").includes("return <TvYtHomeScreen />;"));

console.log("PASS tv-youtube-home regression");
