#!/usr/bin/env node
/**
 * Builds every provider from the API repo into a standalone CJS bundle the app
 * can `require()` directly, plus a static registry so Metro never has to resolve
 * a dynamic path.
 *
 *   node scripts/build-providers.js [--src <providersDir>] [--only a,b] [--dev]
 *
 * Output:
 *   src/providers/bundles/<id>.js   one bundle per provider
 *   src/providers/registry.js       generated static require map
 */
const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DEFAULT_SRC = path.join(ROOT, "..", "K45movies-api", "providers");
const OUT_DIR = path.join(ROOT, "src", "providers", "bundles");
const REGISTRY_FILE = path.join(ROOT, "src", "providers", "registry.js");
const REGISTRY_TYPES = path.join(ROOT, "src", "providers", "registry.d.ts");
const CRYPTO_SHIM = path.join(ROOT, "src", "providers", "shims", "nodeCrypto.js");

// Merged into a single bundle per provider, in export-merge order.
const MODULES = ["catalog", "posts", "meta", "stream", "episodes"];
// Directories under providers/ holding shared code rather than a provider.
const EXCLUDE_DIRS = new Set(["extractors"]);

function parseArgs(argv) {
  const opts = { src: process.env.PROVIDERS_SRC || DEFAULT_SRC, only: null, dev: false };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dev") opts.dev = true;
    else if (arg === "--src") opts.src = argv[++i];
    else if (arg.startsWith("--src=")) opts.src = arg.slice(6);
    else if (arg === "--only") opts.only = argv[++i].split(",").map((s) => s.trim());
    else if (arg.startsWith("--only=")) opts.only = arg.slice(7).split(",").map((s) => s.trim());
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return opts;
}

function discoverProviders(srcDir, only) {
  if (!fs.existsSync(srcDir)) {
    throw new Error(
      `Providers directory not found: ${srcDir}\n` +
        `Pass --src <dir> or set PROVIDERS_SRC to point at K45movies-api/providers.`,
    );
  }
  return fs
    .readdirSync(srcDir, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        !entry.name.startsWith(".") &&
        !EXCLUDE_DIRS.has(entry.name),
    )
    .map((entry) => entry.name)
    .filter((name) => !only || only.includes(name))
    .sort();
}

function buildProvider(name, srcDir, minify) {
  const providerPath = path.join(srcDir, name);
  const present = MODULES.filter((mod) =>
    fs.existsSync(path.join(providerPath, `${mod}.ts`)),
  );
  if (present.length === 0) return null;

  // esbuild cannot emit one outfile from several entry points, so synthesize an
  // entry that merges every module's exports onto `exports`.
  const contents = present
    .map((mod) => `Object.assign(exports, require('./${mod}.ts'));`)
    .join("\n");

  const result = esbuild.buildSync({
    stdin: { contents, resolveDir: providerPath, sourcefile: `${name}.entry.js` },
    bundle: true,
    write: false,
    format: "cjs",
    platform: "browser",
    target: "es2015",
    external: [],
    alias: { crypto: CRYPTO_SHIM },
    minify,
    legalComments: "none",
    logLevel: "silent",
  });

  const warnings = (result.warnings || []).map((w) => w.text);
  return { modules: present, code: result.outputFiles[0].text, warnings };
}

function writeRegistry(entries) {
  const list = entries
    .map(
      (e) =>
        `  {\n    id: ${JSON.stringify(e.id)},\n    modules: ${JSON.stringify(
          e.modules,
        )},\n    load: () => require(${JSON.stringify(`./bundles/${e.id}.js`)}),\n  },`,
    )
    .join("\n");

  const source = `// GENERATED FILE — do not edit by hand.
// Regenerate with: npm run build:providers
//
// Metro resolves require() statically, so \`require(\`./bundles/\${id}.js\`)\` is
// impossible. Every provider therefore gets a literal require, wrapped in an
// arrow function so its module factory only runs the first time it is used.

const PROVIDERS = [
${list}
];

const BY_ID = new Map(PROVIDERS.map((provider) => [provider.id, provider]));

function ids() {
  return PROVIDERS.map((provider) => provider.id);
}

function has(id) {
  return BY_ID.has(id);
}

function modulesOf(id) {
  const provider = BY_ID.get(id);
  return provider ? provider.modules.slice() : [];
}

function load(id) {
  const provider = BY_ID.get(id);
  if (!provider) {
    throw new Error('Provider "' + id + '" is not in the static registry');
  }
  return provider.load();
}

module.exports = { ids, has, modulesOf, load };
`;

  fs.writeFileSync(REGISTRY_FILE, source, "utf8");
}

// Shadows registry.js for TypeScript. Without it, `allowJs` would make tsc walk
// every minified bundle reachable from the registry's require() calls.
function writeRegistryTypes() {
  fs.writeFileSync(
    REGISTRY_TYPES,
    `// GENERATED FILE — do not edit by hand.
// Regenerate with: npm run build:providers

export declare function ids(): string[];
export declare function has(id: string): boolean;
export declare function modulesOf(id: string): string[];
export declare function load(id: string): Record<string, any>;
`,
    "utf8",
  );
}

function main() {
  const opts = parseArgs(process.argv);
  const srcDir = path.resolve(opts.src);
  const minify = !opts.dev;

  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const names = discoverProviders(srcDir, opts.only);
  console.log(`Source: ${srcDir}`);
  console.log(`Building ${names.length} providers (minify: ${minify})\n`);

  const entries = [];
  const failures = [];
  const allWarnings = [];
  let totalBytes = 0;

  for (const name of names) {
    try {
      const built = buildProvider(name, srcDir, minify);
      if (!built) {
        console.log(`⏭  skipped (no modules): ${name}`);
        continue;
      }
      const file = path.join(OUT_DIR, `${name}.js`);
      fs.writeFileSync(file, built.code, "utf8");
      totalBytes += Buffer.byteLength(built.code);
      entries.push({ id: name, modules: built.modules, bytes: built.code.length });
      if (built.warnings.length > 0) {
        allWarnings.push(`${name}: ${built.warnings.join("; ")}`);
      }
      console.log(
        `✅ ${name.padEnd(16)} ${(built.code.length / 1024).toFixed(1).padStart(7)} KB  [${built.modules.join(", ")}]`,
      );
    } catch (error) {
      failures.push(`${name}: ${error.message.split("\n")[0]}`);
      console.log(`❌ ${name}: ${error.message.split("\n")[0]}`);
    }
  }

  writeRegistry(entries);
  writeRegistryTypes();

  console.log(
    `\nBundled ${entries.length} providers → src/providers/bundles ` +
      `(${(totalBytes / 1024 / 1024).toFixed(2)} MB)`,
  );
  console.log(`Registry → src/providers/registry.js (+ registry.d.ts)`);

  if (allWarnings.length > 0) {
    console.log(`\n⚠️  ${allWarnings.length} provider(s) produced esbuild warnings:`);
    allWarnings.forEach((w) => console.log(`   ${w}`));
  }
  if (failures.length > 0) {
    console.log(`\n❌ ${failures.length} provider(s) failed to build:`);
    failures.forEach((f) => console.log(`   ${f}`));
    process.exitCode = 1;
  }
}

main();
