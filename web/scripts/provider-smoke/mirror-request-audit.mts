import { createHash } from "node:crypto";
import { subscribe, unsubscribe } from "node:diagnostics_channel";
import { writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import axios from "axios";
import { providerRequest, runProvider } from "../../src/server/providers";
import { decodeReference } from "../../src/server/references";

const [output] = process.argv.slice(2);
if (!output) throw new Error("Pass an output JSON path.");
const require = createRequire(import.meta.url);
const ids = ["disneyMirror", "netflixMirror", "primeMirror"];
const relevant = ["accept", "accept-encoding", "accept-language", "cache-control", "connection", "content-type",
  "cookie", "expires", "host", "origin", "pragma", "referer", "sec-fetch-mode", "user-agent", "usertoken", "x-requested-with"];

function summarize(url, method, headers) {
  const address = new URL(url);
  const playerId = address.searchParams.get("id");
  if (address.pathname !== "/newtv/player.php" || !/^[\w-]{1,30}$/.test(playerId ?? "")) return;
  const selected = Object.fromEntries(relevant.filter((name) => headers.has(name)).map((name) => [name, headers.get(name)]));
  for (const name of ["cookie", "usertoken"]) {
    if (selected[name]) selected[name] = "sha256:" + createHash("sha256").update(selected[name]).digest("hex");
  }
  return { url: address.href, method: method.toUpperCase(), headers: selected };
}

const results = [];
for (const id of ids) {
  const call = (input) => runProvider(providerRequest.parse({ id, ...input }), AbortSignal.timeout(30_000));
  const posts = await call({ op: "search", q: "Batman" });
  if (!Array.isArray(posts) || !posts[0]?.ref) throw new Error(id + " has no matching post.");
  const detail = await call({ op: "title", ref: posts[0].ref });
  if (!("groups" in detail)) throw new Error(id + " has no title detail.");
  const ref = detail.groups.flatMap((group) => group.directLinks)[0]?.ref;
  if (!ref) throw new Error(id + " has no direct link for the audit.");
  let website;
  function outgoing(message) {
    const { request } = message;
    const headers = new Headers();
    for (let index = 0; index < request.headers.length; index += 2) headers.append(request.headers[index], request.headers[index + 1]);
    website = summarize(new URL(request.path, request.origin), request.method, headers) ?? website;
  }
  subscribe("undici:request:create", outgoing);
  let outcome;
  try { outcome = { streams: (await call({ op: "sources", ref })).length }; }
  catch (error) { outcome = { stage: error.stage, upstreamStatus: error.upstreamStatus, message: error.message }; }
  finally { unsubscribe("undici:request:create", outgoing); }
  if (!website) throw new Error(id + " did not produce a website request capture.");
  const bundle = require("../../vendor/android/src/providers/bundles/" + id + ".js");
  let android;
  const request = axios.create({ adapter: async (config) => {
    const url = axios.getUri(config);
    android = summarize(url, config.method ?? "get", new Headers(config.headers.toJSON(true))) ?? android;
    const data = new URL(url).pathname === "/checknewtv.php"
      ? { token_hash: Buffer.from(new URL(website.url).origin).toString("base64") }
      : { status: "otp" };
    return { data, status: 200, statusText: "OK", headers: {}, config };
  } });
  await bundle.getStream({ link: decodeReference(id, "source", ref), type: "movie", providerContext: { axios: request } });
  if (!android) throw new Error(id + " did not produce an Android bundle request capture.");
  results.push({ id, androidAxios: android, websiteUndici: website, outcome });
}
await writeFile(output, JSON.stringify({ android: "a77aa81. Axios request before native transport.", website: "Undici outbound request.", results }, null, 2) + "\n");
