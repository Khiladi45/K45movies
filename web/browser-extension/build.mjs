import { build } from "esbuild";
import { createHash } from "node:crypto";
import { cp, mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const directory = new URL("./", import.meta.url);
const out = new URL("../out-extension/", directory);
const root = "https://raw.githubusercontent.com/Khiladi45/K45movies-api/7fb870dd9d602c9bda3e31b736542be7d28ca76a/";
async function get(path) {
  const response = await fetch(root + path, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error("Provider artifact request failed: " + path + " " + response.status);
  return response.text();
}

const manifestData = JSON.parse(await get("manifest.json"));
const available = manifestData.providers.filter(({ id, bundleUrl }) =>
  /^[a-zA-Z0-9_-]{1,65}$/.test(id) && !["vega", "youtube", "moviesApi"].includes(id) && bundleUrl === "bundled/" + id + ".js");
const results = await Promise.all(available.map(async ({ id, bundleUrl }) => [id, await get(bundleUrl)]));
const modules = new Map(results);

await mkdir(out, { recursive: true });
await build({
  absWorkingDir: fileURLToPath(directory), tsconfig: "../tsconfig.json", entryPoints: ["worker.ts"],
  outfile: fileURLToPath(new URL("worker.js", out)), bundle: true, platform: "browser",
  format: "iife", minify: true, target: "chrome120",
  plugins: [{
    name: "pinned-providers",
    setup(context) {
      context.onResolve({ filter: /^pinned-providers$/ }, () => ({ namespace: "registry", path: "registry" }));
      context.onLoad({ filter: /.*/, namespace: "registry" }, () => ({
        contents: "export default {" + [...modules.keys()].map((id) => JSON.stringify(id) +
          ": () => import(" + JSON.stringify("pinned-provider:" + id) + ").then(m => m.default)").join(",") + "};",
      }));
      context.onResolve({ filter: /^pinned-provider:/ }, ({ path }) => ({ namespace: "provider", path: path.slice(16) }));
      context.onLoad({ filter: /.*/, namespace: "provider" }, ({ path }) => ({
        loader: "js",
        contents: "import {Buffer} from 'buffer'; import {providerFetch as fetch} from './network';" +
          "const exports = {}; const module = {exports}; " +
          "const require = (name) => { if (name === 'crypto') return {}; throw Error('Unsupported module'); };\n" +
          modules.get(path) + "\nexport default module.exports;",
        resolveDir: fileURLToPath(directory),
      }));
    },
  }],
});
await Promise.all(["manifest.json", "permissions.html", "permissions.js", "README.md"].map((file) =>
  cp(new URL(file, directory), new URL(file, out))));
await cp(new URL("../../LICENSE", directory), new URL("LICENSE", out));
const manifest = JSON.parse(await readFile(new URL("manifest.json", out), "utf8"));
const id = createHash("sha256").update(Buffer.from(manifest.key, "base64")).digest("hex").slice(0, 32)
  .replace(/./g, (character) => "abcdefghijklmnop"[Number.parseInt(character, 16)]);
console.log("Built extension " + id + " (" + modules.size + " providers) in " + fileURLToPath(out));
