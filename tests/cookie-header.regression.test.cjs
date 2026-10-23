/**
 * Regression tests for the WAF cookie fixes:
 *   1. cleanCookieHeader (SandboxWebView sandbox HTML) dedupes cookie names,
 *      keeping the LAST (newest) value, preserving original name casing.
 *   2. The Set-Cookie split regex (SandboxManager.jarStoreFromResponse) must
 *      not split inside "Expires=Wed, 21 Oct ..." dates but must split joined
 *      headers, and must treat empty values as deletions.
 *
 *   node tests/cookie-header.regression.test.cjs
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const failures = [];

function check(label, condition, detail) {
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
    failures.push(label);
  }
}

// ---- 1. cleanCookieHeader, extracted from the SANDBOX_HTML template ----
const webViewSource = fs.readFileSync(
  path.join(ROOT, "src/components/SandboxWebView.tsx"),
  "utf8",
);

const fnMatch = webViewSource.match(
  /function cleanCookieHeader\(cookieStr\) \{[\s\S]*?\n  \}/,
);
check(
  "cleanCookieHeader exists in SANDBOX_HTML",
  !!fnMatch,
  "function not found in SandboxWebView.tsx",
);
if (!fnMatch) {
  console.log(`RESULT: FAIL`);
  process.exit(1);
}

// The extracted source is indented for the template literal; it is still valid
// JS at any indentation, so eval it as-is.
const cleanCookieHeader = eval(`(${fnMatch[0].replace(/^function/, "function")})`);

let out = cleanCookieHeader(
  "cf_clearance=expired; sessionToken=abc; cf_clearance=valid",
);
check(
  "duplicate cookie keeps only the newest value",
  out === "cf_clearance=valid; sessionToken=abc",
  out,
);

out = cleanCookieHeader("CF_Clearance=old; cf_clearance=new");
check(
  "dedupe is case-insensitive but preserves original casing",
  out === "CF_Clearance=new",
  out,
);

out = cleanCookieHeader("a=1; b=2; c=3");
check("clean header passes through unchanged", out === "a=1; b=2; c=3", out);

out = cleanCookieHeader("a=1 ;  b=2");
check("whitespace is normalized", out === "a=1; b=2", out);

check("empty string passes through", cleanCookieHeader("") === "");
check("falsy input passes through", cleanCookieHeader(null) === null);

out = cleanCookieHeader("cf_clearance=; token=keep");
check(
  "empty-valued cookie survives dedupe (deletion semantics belong to the jar)",
  out === "cf_clearance=; token=keep",
  out,
);

// ---- 2. Set-Cookie split logic (mirrors SandboxManager.jarStoreFromResponse) ----
const COOKIE_SPLIT_REGEX = /, (?=[a-zA-Z0-9_\-]+=)/g;

function parseSetCookie(raw) {
  // Mirrors the jar loop's name/value extraction for assertion purposes.
  const jar = new Map();
  const pieces = raw.split(COOKIE_SPLIT_REGEX);
  for (const piece of pieces) {
    const eq = piece.indexOf("=");
    if (eq <= 0) continue;
    const name = piece.slice(0, eq).trim();
    const rest = piece.slice(eq + 1);
    const semi = rest.indexOf(";");
    const value = (semi >= 0 ? rest.slice(0, semi) : rest).trim();
    if (!name) continue;
    if (/expires|max-age|path|domain|secure|httponly|samesite/i.test(name)) continue;
    if (value === "" || /^\w+day/i.test(value)) jar.delete(name);
    else jar.set(name, value);
  }
  return jar;
}

let jar = parseSetCookie(
  "sessionToken=abc; Path=/; Expires=Wed, 21 Oct 2025 07:28:00 GMT, cf_clearance=new1; Path=/; Max-Age=31536000",
);
check(
  "joined Set-Cookie headers split into both cookies",
  jar.get("sessionToken") === "abc" && jar.get("cf_clearance") === "new1",
  JSON.stringify([...jar]),
);
check(
  "Expires date comma does not create a bogus cookie",
  ![...jar.keys()].some((k) => /21/i.test(k)),
  [...jar.keys()].join(", "),
);

jar = parseSetCookie(
  "cf_clearance=stale; Expires=Wed, 21 Oct 2025 07:28:00 GMT, cf_clearance=; Path=/",
);
check(
  "expired-then-emptied cookie is deleted, not kept stale",
  !jar.has("cf_clearance"),
  JSON.stringify([...jar]),
);

jar = parseSetCookie("hash=x1, hash=x2");
check("last duplicate Set-Cookie wins", jar.get("hash") === "x2", JSON.stringify([...jar]));

jar = parseSetCookie(
  "token=abc; Expires=Thu, 01 Jan 2026 00:00:00 GMT",
);
check(
  "single header with Expires keeps its value intact",
  jar.get("token") === "abc",
  JSON.stringify([...jar]),
);

// ---- 3. document.cookie fallback wiring ----
check(
  "capturePage payload includes document.cookie",
  /cookies: document\.cookie/.test(webViewSource),
);
check(
  "WafPageCapture type includes cookies",
  /type WafPageCapture = \{[\s\S]*?cookies\?: string;[\s\S]*?\}/.test(webViewSource),
);
check(
  "finish() falls back to capture.cookies",
  /if \(!cookies && capture\?\.cookies\) \{/.test(webViewSource),
);

const managerSource = fs.readFileSync(
  path.join(ROOT, "src/services/SandboxManager.ts"),
  "utf8",
);
check(
  "jarStoreFromResponse uses the comma-aware split regex",
  /const COOKIE_SPLIT_REGEX = \/, \(\?=\[a-zA-Z0-9_\\\-\]\+=\)\/g;/.test(
    managerSource,
  ),
);

console.log("");
if (failures.length === 0) {
  console.log("RESULT: PASS");
} else {
  console.log(`RESULT: FAIL — ${failures.length} check(s):`);
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exitCode = 1;
}
