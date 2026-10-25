// Injected by scripts/build-providers.js (esbuild `inject`) in place of the
// free `console` identifier. Provider code routinely logs raw extraction
// results, which include signed CDN URLs and access tokens; nothing here may
// reach logcat. The real console is read through globalThis so esbuild does
// not rewrite this file's own reference.

const real = globalThis.console || {};

const URL_RE = /\bhttps?:\/\/[^\s"'<>`]+/gi;
const HEADER_RE = /\b(authorization|proxy-authorization|cookie|set-cookie)\s*[:=]\s*[^\n\r]+/gi;
const BEARER_RE = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi;
const SECRET_RE =
  /((?:^|[?&;\s])(?:x-amz-[a-z-]+|sig|signature|expires?|expiry|credential|token|api[-_]?key|key|auth|password|passwd|secret|session(?:id)?|sp|se|sv|st|skoid|sktid)=)[^\s&"'<>]*/gi;
const SECRET_KEY_RE =
  /^(authorization|proxy-authorization|cookie|set-cookie|x-amz-[a-z-]+|sig|signature|expires?|expiry|credential|tokens?|access[_-]?token|refresh[_-]?token|api[_-]?key|key|auth|password|passwd|secret|session(?:id)?|signed[_-]?url|url)$/i;
const MAX_STRING = 2000;
const MAX_DEPTH = 4;
const MAX_ITEMS = 50;

function scrubUrl(url) {
  const match = /^(https?):\/\/(?:[^/?#@\s]*@)?([^/?#\s]+)/i.exec(url);
  return match ? match[1].toLowerCase() + "://" + match[2] + "/…" : "[url]";
}

function sanitizeString(value) {
  let out = value
    .replace(URL_RE, scrubUrl)
    .replace(HEADER_RE, "$1: [redacted]")
    .replace(BEARER_RE, "$1 [redacted]")
    .replace(SECRET_RE, "$1[redacted]");
  if (out.length > MAX_STRING) {
    out = out.slice(0, MAX_STRING) + `… (${value.length} chars)`;
  }
  return out;
}

function sanitizeValue(value, depth, seen) {
  if (value == null) return value;
  const type = typeof value;
  if (type === "string") return sanitizeString(value);
  if (type === "number" || type === "boolean" || type === "bigint") return value;
  if (type === "function") return "[function]";
  if (type === "symbol") return String(value);
  if (depth >= MAX_DEPTH) return Array.isArray(value) ? "[Array]" : "[Object]";
  if (seen.has(value)) return "[circular]";
  seen.add(value);

  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeString(String(value.message || "")),
      stack: sanitizeString(String(value.stack || "")),
    };
  }
  if (Array.isArray(value)) {
    const out = value.slice(0, MAX_ITEMS).map((item) => sanitizeValue(item, depth + 1, seen));
    if (value.length > MAX_ITEMS) out.push(`… (${value.length - MAX_ITEMS} more)`);
    return out;
  }
  const out = {};
  const keys = Object.keys(value).slice(0, MAX_ITEMS);
  for (const key of keys) {
    out[key] = SECRET_KEY_RE.test(key) ? "[redacted]" : sanitizeValue(value[key], depth + 1, seen);
  }
  return out;
}

function sanitize(args) {
  const seen = typeof WeakSet === "function" ? new WeakSet() : null;
  return Array.prototype.map.call(args, (arg) =>
    seen ? sanitizeValue(arg, 0, seen) : sanitizeString(String(arg)),
  );
}

const safeConsole = Object.create(real);
for (const method of ["log", "info", "warn", "error", "debug"]) {
  const target = typeof real[method] === "function" ? real[method] : real.log;
  safeConsole[method] = function (...args) {
    try {
      if (typeof target === "function") target.apply(real, sanitize(args));
    } catch {
      // Logging must never be able to break a provider.
    }
  };
}

module.exports = { console: safeConsole };
