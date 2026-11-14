const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const cheerio = require("cheerio");
const { providerIds, code } = require("../src/providers/cncHome");

test("the sandbox serves bundled home rows and dispatches search to the installed provider", async () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/components/SandboxWebView.tsx"), "utf8");
  const html = source.match(/const SANDBOX_HTML = (`[\s\S]*?`);/)[1];
  const [, script] = vm.runInNewContext(html, { CHEERIO_SOURCE: "" }).matchAll(/<script>([\s\S]*?)<\/script>/g);
  const messages = [];
  const requests = [];
  const window = {
    cheerio,
    ReactNativeWebView: {
      postMessage(json) {
        const message = JSON.parse(json);
        if (message.type !== "httpRequest") {
          messages.push(message);
          return;
        }
        requests.push(message);
        const url = new URL(message.url);
        const poster = '<img src="https://imgcdn.kim/pv/example.jpg" alt="Prime title">';
        const body = `<div class="tray-container"><h2>Prime row</h2><article data-post="prime-id">${poster}</article></div>`;
        queueMicrotask(() => window.__onHttpResponse({ httpId: message.httpId, status: 200, body }));
        assert.equal(url.pathname, "/mobile/home");
      },
    },
  };
  vm.runInNewContext(script[1], {
    window, cheerio, AbortController, Headers, URL, URLSearchParams, console,
  });
  await window.providerKvStore.set("t_hash_t_pv", { token: "test-token", ts: Date.now() });
  window.loadProviderCode("load-home", "__cncHome", code, true);
  assert.deepEqual(Object.keys(window.providers.__cncHome), providerIds);
  const home = window.providers.__cncHome;
  window.loadProviderCode("load-home-again", "__cncHome", code, true);
  assert.equal(window.providers.__cncHome, home);
  window.loadProviderCode(
    "load-installed", "primeVideo",
    'exports.getSearchPosts = ({ searchQuery, providerValue }) => [{ title: searchQuery, providerValue }];',
  );

  await window.executeProvider("catalog", "primeVideo", "catalog", {}, "__cncHome");
  await window.executeProvider("posts", "primeVideo", "getPosts", { filter: "Prime row", page: 1 }, "__cncHome");
  await window.executeProvider("search", "primeVideo", "getSearchPosts", { searchQuery: "Test search" }, "primeVideo");
  const result = (id) => messages.find((message) => message.id === id)?.result;
  assert.deepEqual(result("catalog"), [{ title: "Prime row", filter: "Prime row" }]);
  assert.equal(result("posts")?.[0]?.link, "prime-id|pv|Prime%20title");
  assert.deepEqual(result("search"), [{ title: "Test search", providerValue: "primeVideo" }]);
  assert.equal(requests.length, 1, "posts reused the validated home rows");
  assert.equal(requests[0].withCredentials, false);
  assert.match(requests[0].headers.cookie, /t_hash_t=test-token; hd=on; ott=pv/);
});
