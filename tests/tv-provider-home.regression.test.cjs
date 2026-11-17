// Regression test: Provider Based layout on TV — Home + Category grid (Phase 2a).
// Run: node tests/tv-provider-home.regression.test.cjs   (Node >= 22.18)
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const { extractPosts, mergePostsPage, postKey, validCatalogs, rowsToLoad } = require(
  path.join(root, "src", "TV", "provider", "posts.ts"),
);

// Payload shapes, same as the phone CategoryScreen.
assert.deepStrictEqual(extractPosts([1]), [1]);
assert.deepStrictEqual(extractPosts({ posts: [2] }), [2]);
assert.deepStrictEqual(extractPosts({ data: [3] }), [3]);
assert.deepStrictEqual(extractPosts(null), []);
assert.strictEqual(postKey({ link: "l", title: "t" }), "l");
assert.strictEqual(postKey({ title: "t" }), "t");

// Paging: duplicates dropped, provider tagged, "added" tells when to stop.
const page1 = mergePostsPage([], [{ link: "a", title: "A" }, { link: "b", title: "B" }, {}], "vega");
assert.deepStrictEqual(page1.items.map((p) => p.link), ["a", "b"]);
assert.strictEqual(page1.items[0].providerId, "vega");
const page2 = mergePostsPage(page1.items, { posts: [{ link: "b" }, { link: "c" }] }, "vega");
assert.deepStrictEqual(page2.items.map((p) => p.link), ["a", "b", "c"]);
assert.strictEqual(page2.added, 1);
const page3 = mergePostsPage(page2.items, [{ link: "c" }], "vega");
assert.strictEqual(page3.added, 0, "a page with nothing new ends paging");

// Catalogs without filter/id are skipped (they can never load).
assert.deepStrictEqual(
  validCatalogs([{ title: "x" }, { title: "y", filter: "/y" }, { title: "z", id: "z" }]).map((c) => c.title),
  ["y", "z"],
);
// Rows load near the focus only: first 3, then 2 past the focused row.
assert.strictEqual(rowsToLoad(0), 3);
assert.strictEqual(rowsToLoad(1), 4);
assert.strictEqual(rowsToLoad(5), 8);

// Home wiring.
const home = read("src/TV/provider/TvProviderHomeScreen.tsx");
assert.ok(home.includes("useCatalog(activeProvider)"), "catalogs of the active provider");
assert.ok(home.includes("enabled={index < rowsToLoad(focusedRow)}"), "lazy rows");
assert.ok(/navigation\.navigate\("TvCategory", \{\s*providerId: activeProvider,\s*filter: catalog\.filter,/.test(home), "See all opens TvCategory");
assert.ok(/resumeProviderItem\(item\)\.then\(\(started\) => \{\s*if \(!started\) openDetail\(\);/.test(home), "Continue Watching resumes, else opens detail");
assert.ok(home.includes("onPress={() => setActiveProvider(item.id)}"), "provider switcher");
assert.ok(home.includes('navigation.navigate("TvProviderDetail"'), "posters open the TV detail route");

const row = read("src/TV/provider/PostRow.tsx");
assert.ok(row.includes('usePosts(providerId, enabled ? filter : "")'), "row fetches only when enabled");
assert.ok(row.includes("removeClippedSubviews={false}"), "row keeps cards mounted for D-pad");
assert.ok(row.includes(".slice(0, TV.rowLimit)"), "row size capped");
assert.ok(row.includes("<SeeAllCard"), "See all card");

const category = read("src/TV/provider/TvCategoryScreen.tsx");
assert.ok(category.includes("providerApi.getPosts(providerId, filter, page)"), "paged getPosts");
assert.ok(category.includes("pageRef.current >= PAGE_LIMIT"), "page cap");
assert.ok(category.includes("onEndReached={loadMore}"), "loads more near the end");
assert.ok(category.includes("hasTVPreferredFocus={index === 0}"), "first poster focused");

// Routes are TV-only names; Home is used by the Provider shell.
const app = read("src/TV/TvApp.tsx");
assert.ok(app.includes('<Stack.Screen name="TvCategory" component={TvCategoryScreen} />'));
assert.ok(/<Stack\.Screen name="TvProviderDetail" component=\{TvProvider\w+\} \/>/.test(app));
assert.ok(read("src/TV/shell/ProviderShell.tsx").includes("return <TvProviderHomeScreen />;"));

console.log("PASS tv-provider-home regression");
