import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const configured = [
  ["TMDB", process.env.TMDB_API_KEY],
  ["provider KV", process.env.K45_KV_REST_TOKEN],
  ["reference", process.env.K45_REFERENCE_SECRET],
].filter(([, value]) => value);
assert.ok(configured.some(([name]) => name === "TMDB"), "Load the TMDB environment before running this check.");
const secrets = configured.map(([name, value]) => [name, [Buffer.from(value)]]);
if (!process.env.K45_REFERENCE_SECRET) {
  const key = await readFile(".k45-reference-key");
  assert.equal(key.length, 32);
  secrets.push(["local reference", [key, Buffer.from(key.toString("hex")), Buffer.from(key.toString("base64")), Buffer.from(key.toString("base64url"))]]);
}
function inspect(contents, location) {
  for (const [name, variants] of secrets) {
    assert.ok(!variants.some((value) => contents.includes(value)), name + " material found in " + location);
  }
}

const directory = ".next/static";
const files = await readdir(directory, { recursive: true, withFileTypes: true });
let count = 0;
for (const file of files) {
  if (!file.isFile()) continue;
  const path = join(file.parentPath, file.name);
  inspect(await readFile(path), path);
  count++;
}
assert.ok(count > 0, "Build the production website before scanning.");
const base = process.env.K45_SMOKE_SITE_URL || "http://127.0.0.1:3200";
const routes = ["/", "/search?q=Batman", "/title/tv/66732", "/settings/providers/diagnostics", "/api/proxy/tmdb?op=title&type=tv&id=66732"];
for (const path of routes) {
  const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(20_000) });
  assert.equal(response.status, 200, path);
  inspect(Buffer.from(await response.arrayBuffer()), path);
}
console.log(JSON.stringify({ publicFiles: count, responses: routes, checked: secrets.map(([name]) => name) }, null, 2));
