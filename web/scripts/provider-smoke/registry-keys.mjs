import { readdir, readFile, writeFile } from "node:fs/promises";

const [output, registry = "https://raw.githubusercontent.com/Khiladi45/K45movies-api/main/urls.json"] = process.argv.slice(2);
if (!output) throw new Error("Pass an output path.");
const response = await fetch(registry, { signal: AbortSignal.timeout(10000) });
if (!response.ok) throw new Error("URL registry HTTP " + response.status);
const urls = await response.json();
const dir = new URL("../../vendor/android/src/providers/bundles/", import.meta.url);
const files = (await readdir(dir)).filter((file) => file.endsWith(".js")).sort();
const bundles = await Promise.all(files.map(async (file) => {
  const source = await readFile(new URL(file, dir), "utf8");
  const registryUsed = source.includes("/urls.json");
  const iterator = /(?:^|[;,])([\w$]+)=[\w$]+=>[^;]{0,100}function\*\(\)\{var [^;]+;try\{return\([^]{0,250}?Error fetching baseUrl:/g;
  const readers = [...source.matchAll(iterator)].map((match) => match[1]);
  const keys = new Set();
  const constants = new Map([...source.matchAll(/(?:^|[;,])(?:var |let |const )?([\w$]+)=["']([\w-]+)["']/g)].map(([, name, value]) => [name, value]));
  const unresolved = new Set();
  for (const reader of readers) {
    const escaped = reader.replace(/\$/g, "\\$&");
    for (const match of source.matchAll(new RegExp("(?:^|[^\\w$])" + escaped + "\\([\"']([\\w-]+)[\"']\\)", "g"))) keys.add(match[1]);
    for (const [, name] of source.matchAll(new RegExp("\\byield\\s+" + escaped + "\\(([\\w$]+)\\)", "g"))) {
      const key = constants.get(name);
      if (key) keys.add(key);
      else unresolved.add(name);
    }
  }
  const missing = [...keys].filter((key) => !urls[key]?.url);
  return { id: file.slice(0, -3), registryUsed, keys: [...keys].sort(), missing: missing.sort(), unresolved: [...unresolved] };
}));
await writeFile(output, JSON.stringify({ registry, scanned: files.length, bundles }, null, 2) + "\n");
console.log(bundles.filter((entry) => entry.missing.length || entry.registryUsed && !entry.keys.length));
