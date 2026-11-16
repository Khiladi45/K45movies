import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

const out = resolve(".pages");
const frontend = resolve("src/pages-preview");
const navigation = resolve(frontend, "navigation.tsx");
await mkdir(out, { recursive: true });
await build({
  entryPoints: [resolve(frontend, "entry.tsx")],
  outfile: resolve(out, "app.js"),
  format: "esm",
  platform: "browser",
  bundle: true,
  minify: true,
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  alias: { "next/link": navigation, "next/navigation": navigation },
});
const source = '@import "../app/globals.css";\n@import "./styles.css";';
const result = await postcss([tailwind({ base: process.cwd(), optimize: true })]).process(source, {
  from: resolve(frontend, "entry.css"), to: resolve(out, "styles.css"),
});
const version = (asset) => createHash("sha256").update(asset).digest("hex").slice(0, 12);
const html = (await readFile(resolve(frontend, "index.html"), "utf8"))
  .replace("./app.js", "./app.js?v=" + version(await readFile(resolve(out, "app.js"))))
  .replace("./styles.css", "./styles.css?v=" + version(result.css));
await Promise.all([
  writeFile(resolve(out, "index.html"), html),
  copyFile(resolve("public/brand.png"), resolve(out, "brand.png")),
  writeFile(resolve(out, ".nojekyll"), ""),
  writeFile(resolve(out, "styles.css"), result.css),
]);
console.log("Static preview built in " + out);
