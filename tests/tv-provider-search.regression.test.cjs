// Regression test: Provider Based layout on TV — Search (Phase 2b).
// Run: node tests/tv-provider-search.regression.test.cjs   (Node >= 22.18)
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const { groupByProvider, PROVIDER_TRENDING } = require(path.join(root, "src", "TV", "provider", "posts.ts"));

// One row per provider, installed order, duplicates and empty items dropped.
const groups = groupByProvider(
  [
    { title: "A", link: "a", providerId: "drive" },
    { title: "B", link: "b", providerId: "vega" },
    { title: "A2", link: "a", providerId: "drive" },
    { title: "C", link: "c", providerId: "drive" },
    {},
    { title: "D", link: "d", providerId: "other" },
  ],
  ["vega", "drive"],
);
assert.deepStrictEqual(groups.map((g) => g.providerId), ["vega", "drive", "other"]);
assert.deepStrictEqual(groups[1].posts.map((p) => p.link), ["a", "c"]);
assert.deepStrictEqual(groupByProvider(null, ["vega"]), []);
assert.strictEqual(groupByProvider([...Array(30)].map((_, i) => ({ link: `l${i}`, providerId: "v" })), ["v"], 20)[0].posts.length, 20);
// Same trending terms as the phone search screen.
const phone = read("src/components/search.tsx");
for (const term of PROVIDER_TRENDING) assert.ok(phone.includes(`"${term}"`), `phone trending has ${term}`);

// Search box: the proven TV keyboard pattern (never a TextInput nested in a focusable).
const box = read("src/TV/components/TvSearchBox.tsx");
const focusable = box.match(/<Focusable[\s\S]*?<\/Focusable>/);
assert.ok(focusable && !/<TextInput/.test(focusable[0]), "TextInput not nested in the focusable");
assert.ok(/\{typing \? \([\s\S]*?<TextInput[\s\S]*?focusable=\{false\}/.test(box), "TextInput only while typing");
assert.ok(/Keyboard\.dismiss\(\);\s*setTyping\(false\)/.test(box), "keyboard dismissed and field removed");
assert.ok(box.includes('Keyboard.addListener("keyboardDidHide", finishTyping)'), "Back on the keyboard ends typing");

// Screen: submit-only search over installed providers, history, focus hand-off.
const screen = read("src/TV/provider/TvProviderSearchScreen.tsx");
assert.ok(screen.includes("useSearch(query, installed)"), "searches installed providers");
assert.ok(/if \(value\.length > 2\) \{\s*setQuery\(value\);\s*addSearch\(value\);/.test(screen), "submit runs search + history");
assert.ok(screen.includes("requestFocus(firstResultRef)"), "focus moves to the first result");
assert.ok(screen.includes('title="Recent searches"') && screen.includes('title="Trending"'), "chips when empty");
assert.ok(screen.includes("removeClippedSubviews={false}"), "result rows reachable by D-pad");
assert.ok(!/<TextInput/.test(screen), "screen itself has no TextInput");
assert.ok(read("src/TV/shell/ProviderShell.tsx").includes("return <TvProviderSearchScreen />;"));

// The Movie layout's search screen is untouched by this phase.
assert.ok(read("src/TV/screens/TvSearchScreen.tsx").includes("export default function TvSearchScreen()"));

console.log("PASS tv-provider-search regression");
