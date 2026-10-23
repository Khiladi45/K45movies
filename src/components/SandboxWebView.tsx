import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type WebView from "react-native-webview";
import CookieManager from "@preeternal/react-native-cookie-manager";
import { SandboxManager, DEFAULT_UA } from "../services/SandboxManager";
import { setWafHandler } from "../services/wafSolver";
import { useThemeStore } from "../store/useThemeStore";
// cheerio@1.0.0 browser build, bundled into the app so the sandbox needs no
// CDN — the CDN script tags 404'd and were the cause of recurring load failures.
import { CHEERIO_SOURCE } from "../services/cheerioSource";

const SANDBOX_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <script>${CHEERIO_SOURCE}</script>
</head>
<body>
<script>
  window.providers = {};
  window.__pendingHttp = {};
  window.__pendingWebViews = {};
  window.__executionAborts = {};
  window.__httpSeq = 0;

  // ---------- helpers ----------
  function decodeBase64(base64) {
    try {
      var binary = atob(base64 || '');
      var bytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return bytes;
    } catch (e) {
      return new Uint8Array(0);
    }
  }

  function encodeBase64(bytes) {
    try {
      var binary = '';
      for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      return btoa(binary);
    } catch (e) {
      return '';
    }
  }

  function headerObject(init) {
    var out = {};
    try {
      var h = new Headers(init || {});
      h.forEach(function (value, key) { out[key] = value; });
    } catch (e) {
      if (init && typeof init === 'object') {
        Object.keys(init).forEach(function (key) { out[key] = String(init[key]); });
      }
    }
    return out;
  }

  function buildUrl(url, params, baseURL) {
    var out = String(url == null ? '' : url);
    if (baseURL && !/^https?:/i.test(out)) {
      out = String(baseURL).replace(/\\/+$/, '') + '/' + out.replace(/^\\/+/, '');
    }
    if (params) {
      var qs = '';
      if (typeof URLSearchParams === 'function' && params instanceof URLSearchParams) {
        qs = params.toString();
      } else if (typeof params === 'object') {
        var parts = [];
        Object.keys(params).forEach(function (key) {
          var value = params[key];
          if (value == null) return;
          if (Array.isArray(value)) {
            value.forEach(function (entry) {
              parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(entry)));
            });
          } else {
            parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(value)));
          }
        });
        qs = parts.join('&');
      }
      if (qs) out += (out.indexOf('?') >= 0 ? '&' : '?') + qs;
    }
    return out;
  }

  function serializeBody(data) {
    if (data == null) return null;
    if (typeof data === 'string') return { kind: 'text', value: data };
    if (typeof URLSearchParams === 'function' && data instanceof URLSearchParams) {
      return { kind: 'text', value: data.toString(), contentType: 'application/x-www-form-urlencoded' };
    }
    if (typeof FormData === 'function' && data instanceof FormData) {
      var entries = [];
      try {
        data.forEach(function (value, key) { entries.push([String(key), String(value)]); });
      } catch (e) {}
      return { kind: 'formData', entries: entries };
    }
    return { kind: 'text', value: JSON.stringify(data), contentType: 'application/json' };
  }

  function parsePayload(payload, responseType) {
    var isBinary = responseType === 'arraybuffer' || responseType === 'blob' || responseType === 'stream';
    var raw;
    if (payload.encoding === 'base64') {
      var bytes = decodeBase64(payload.body);
      if (isBinary) return bytes.buffer;
      try { raw = new TextDecoder().decode(bytes); } catch (e) { raw = ''; }
    } else {
      raw = payload.body == null ? '' : String(payload.body);
    }
    if (responseType === 'text') return raw;
    if (isBinary) return decodeBase64(raw).buffer;
    try { return JSON.parse(raw); } catch (e) { return raw; }
  }

  // ---------- Buffer (providers use it for base64 payloads) ----------
  function decorateBuffer(bytes) {
    bytes.toString = function (encoding, start, end) {
      encoding = (encoding || 'utf8').toLowerCase();
      var view = bytes.subarray(start || 0, end == null ? bytes.length : end);
      if (encoding === 'base64' || encoding === 'base64url') {
        var encoded = encodeBase64(view);
        return encoding === 'base64url'
          ? encoded.replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '')
          : encoded;
      }
      if (encoding === 'hex') {
        var hex = '';
        for (var i = 0; i < view.length; i++) hex += ('0' + view[i].toString(16)).slice(-2);
        return hex;
      }
      try { return new TextDecoder().decode(view); } catch (e) { return ''; }
    };
    bytes.equals = function (other) {
      if (!other || other.length !== bytes.length) return false;
      for (var i = 0; i < bytes.length; i++) if (bytes[i] !== other[i]) return false;
      return true;
    };
    bytes.write = function (value, offset) {
      var encoded = new TextEncoder().encode(String(value));
      var start = offset || 0;
      for (var i = 0; i < encoded.length && start + i < bytes.length; i++) {
        bytes[start + i] = encoded[i];
      }
      return Math.min(encoded.length, bytes.length - start);
    };
    bytes.copy = function (target, targetStart, sourceStart, sourceEnd) {
      var from = sourceStart || 0;
      var to = sourceEnd == null ? bytes.length : sourceEnd;
      target.set(bytes.subarray(from, to), targetStart || 0);
      return to - from;
    };
    return bytes;
  }

  function bufferFrom(input, encoding) {
    encoding = (encoding || 'utf8').toLowerCase();
    var bytes;
    if (typeof input === 'string') {
      if (encoding === 'base64' || encoding === 'base64url') {
        var b64 = input.replace(/-/g, '+').replace(/_/g, '/');
        while (b64.length % 4) b64 += '=';
        bytes = decodeBase64(b64);
      } else if (encoding === 'hex') {
        bytes = new Uint8Array(Math.floor(input.length / 2));
        for (var i = 0; i < bytes.length; i++) {
          bytes[i] = parseInt(input.substr(i * 2, 2), 16) || 0;
        }
      } else {
        bytes = new TextEncoder().encode(input);
      }
    } else if (input instanceof ArrayBuffer) {
      bytes = new Uint8Array(input);
    } else if (ArrayBuffer.isView(input)) {
      bytes = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    } else if (Array.isArray(input)) {
      bytes = new Uint8Array(input);
    } else {
      bytes = new Uint8Array(0);
    }
    return decorateBuffer(bytes);
  }

  var BufferCtor = function (input, encoding) { return bufferFrom(input, encoding); };
  BufferCtor.from = bufferFrom;
  BufferCtor.alloc = function (size) { return decorateBuffer(new Uint8Array(size)); };
  BufferCtor.isBuffer = function (value) { return value instanceof Uint8Array; };
  BufferCtor.concat = function (list) {
    var total = 0;
    list.forEach(function (entry) { total += entry.length; });
    var out = new Uint8Array(total);
    var offset = 0;
    list.forEach(function (entry) { out.set(entry, offset); offset += entry.length; });
    return decorateBuffer(out);
  };
  BufferCtor.byteLength = function (value) {
    return typeof value === 'string' ? new TextEncoder().encode(value).length : value.length;
  };
  window.Buffer = BufferCtor;
  window.global = window;
  window.process = window.process || { env: {}, browser: true, version: '', nextTick: function (fn) { Promise.resolve().then(fn); } };

  // ---------- fetch / axios bridge ----------
  window.__onHttpResponse = function (payload) {
    var pending = window.__pendingHttp[payload.httpId];
    if (!pending) return;
    delete window.__pendingHttp[payload.httpId];
    if (payload.error) pending.reject(new Error(payload.error));
    else pending.resolve(payload);
  };

  window.__onWebViewResult = function (payload) {
    var pending = window.__pendingWebViews[payload.id];
    if (!pending) return;
    delete window.__pendingWebViews[payload.id];
    if (payload.error) pending.reject(new Error(payload.error));
    else pending.resolve(payload.result);
  };

  // Providers append fresh WAF cookies onto whatever Cookie header they
  // already built, so "cf_clearance=expired; x=1; cf_clearance=valid" reaches
  // Cloudflare and gets rejected. Keep only the LAST occurrence of each name.
  function cleanCookieHeader(cookieStr) {
    if (!cookieStr) return cookieStr;
    var map = {};
    var parts = cookieStr.split(';');
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i].trim();
      if (!part) continue;
      var eq = part.indexOf('=');
      if (eq > 0) {
        // Keep only the LAST occurrence (the newest valid cookie)
        var name = part.slice(0, eq).trim().toLowerCase();
        map[name] = part.slice(eq + 1).trim();
      }
    }
    var finalParts = [];
    for (var name in map) {
      var origName = name;
      for (var j = 0; j < parts.length; j++) {
        var p = parts[j].trim();
        if (p.toLowerCase().startsWith(name + '=')) {
          origName = p.slice(0, p.indexOf('='));
          break;
        }
      }
      finalParts.push(origName + '=' + map[name]);
    }
    return finalParts.join('; ');
  }

  function nativeRequest(method, url, data, config) {
    return new Promise(function (resolve, reject) {
      var httpId = 'http_' + (++window.__httpSeq) + '_' + Date.now();
      var signal = config.signal;
      var onAbort = function () {
        if (window.__pendingHttp[httpId]) {
          delete window.__pendingHttp[httpId];
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'httpAbort', httpId: httpId }));
          reject(new Error('canceled'));
        }
      };
      if (signal && signal.aborted) { onAbort(); return; }
      if (signal && signal.addEventListener) signal.addEventListener('abort', onAbort, { once: true });
      window.__pendingHttp[httpId] = { resolve: resolve, reject: reject };
      if (config && config.headers) {
        var cookieKey = Object.keys(config.headers).find(function(k) { return k.toLowerCase() === 'cookie'; });
        if (cookieKey) config.headers[cookieKey] = cleanCookieHeader(config.headers[cookieKey]);
      }
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'httpRequest',
        httpId: httpId,
        method: method,
        url: url,
        headers: headerObject(config.headers),
        body: serializeBody(data),
        timeout: Number(config.timeout) || 0,
        responseType: config.responseType || 'text',
        redirect: config.redirect || 'follow'
      }));
    });
  }

  function makeHeaders(raw) {
    return {
      get: function (name) {
        var target = String(name).toLowerCase();
        var found = null;
        Object.keys(raw || {}).forEach(function (key) {
          if (key.toLowerCase() === target) found = raw[key];
        });
        return found;
      },
      has: function (name) { return this.get(name) != null; },
      forEach: function (callback) {
        Object.keys(raw || {}).forEach(function (key) { callback(raw[key], key); });
      },
      entries: function () {
        return Object.keys(raw || {}).map(function (key) { return [key, raw[key]]; })[Symbol.iterator]();
      }
    };
  }

  function bridgeFetch(input, init) {
    init = init || {};
    var url = typeof input === 'string' ? input : (input && input.url) || String(input);
    var method = String(init.method || (input && input.method) || 'GET').toUpperCase();
    var headers = headerObject(init.headers || (input && input.headers) || {});
    var signal = init.signal || (input && input.signal);
    var responseType = init.responseType || 'text';
    return new Promise(function (resolve, reject) {
      var httpId = 'fetch_' + (++window.__httpSeq) + '_' + Date.now();
      var onAbort = function () {
        if (window.__pendingHttp[httpId]) {
          delete window.__pendingHttp[httpId];
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'httpAbort', httpId: httpId }));
          var abortError;
          try { abortError = new DOMException('The operation was aborted.', 'AbortError'); }
          catch (e) { abortError = new Error('The operation was aborted.'); }
          reject(abortError);
        }
      };
      if (signal && signal.aborted) { onAbort(); return; }
      if (signal && signal.addEventListener) signal.addEventListener('abort', onAbort, { once: true });
      var detach = function () {
        if (signal && signal.removeEventListener) signal.removeEventListener('abort', onAbort);
      };
      window.__pendingHttp[httpId] = {
        resolve: function (payload) {
          detach();
          var bodyBytes = payload.encoding === 'base64' ? decodeBase64(payload.body) : null;
          var bodyText = bodyBytes ? null : (payload.body == null ? '' : String(payload.body));
          var response = {
            ok: payload.status >= 200 && payload.status < 300,
            status: payload.status,
            statusText: payload.statusText || '',
            url: payload.url || url,
            redirected: !!payload.redirected,
            type: 'basic',
            bodyUsed: false,
            headers: makeHeaders(payload.headers),
            text: function () {
              return Promise.resolve(bodyBytes ? new TextDecoder().decode(bodyBytes) : bodyText);
            },
            json: function () {
              return Promise.resolve(bodyBytes
                ? JSON.parse(new TextDecoder().decode(bodyBytes))
                : JSON.parse(bodyText || 'null'));
            },
            arrayBuffer: function () {
              return Promise.resolve((bodyBytes || new TextEncoder().encode(bodyText || '')).buffer);
            },
            clone: function () { return response; }
          };
          resolve(response);
        },
        reject: function (reason) {
          detach();
          reject(reason);
        }
      };
      var body = init.body != null ? init.body : (input && input.body);
      var serializedBody = null;
      if (body != null) {
        if (typeof body === 'string') serializedBody = { kind: 'text', value: body };
        else if (typeof URLSearchParams === 'function' && body instanceof URLSearchParams) {
          serializedBody = { kind: 'text', value: body.toString(), contentType: 'application/x-www-form-urlencoded' };
        } else if (typeof FormData === 'function' && body instanceof FormData) {
          var entries = [];
          try { body.forEach(function (value, key) { entries.push([String(key), String(value)]); }); } catch (e) {}
          serializedBody = { kind: 'formData', entries: entries };
        } else {
          serializedBody = { kind: 'text', value: String(body) };
        }
      }
      // The headers object is a fresh copy from headerObject() — cleaning it
      // here covers both init.headers and input.headers without mutating the
      // caller's objects.
      if (headers) {
        var fetchCookieKey = Object.keys(headers).find(function(k) { return k.toLowerCase() === 'cookie'; });
        if (fetchCookieKey) headers[fetchCookieKey] = cleanCookieHeader(headers[fetchCookieKey]);
      }
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'httpRequest',
        httpId: httpId,
        method: method,
        url: url,
        headers: headers,
        body: serializedBody,
        timeout: Number(init.timeout) || 0,
        responseType: responseType,
        redirect: init.redirect || 'follow'
      }));
    });
  }

  window.fetch = bridgeFetch;
  window.Headers = window.Headers || function () {};
  window.Request = window.Request || function () {};
  window.Response = window.Response || function () {};

  function createAxios(defaults) {
    defaults = defaults || {};

    async function request(method, url, data, config) {
      config = Object.assign({}, defaults, config || {});
      var finalUrl = buildUrl(url, config.params, config.baseURL || defaults.baseURL);
      var payload = await nativeRequest(method, finalUrl, data, config);
      var isBinary = config.responseType === 'arraybuffer' || config.responseType === 'blob';
      var parsed = parsePayload(payload, config.responseType);
      var result = {
        data: parsed,
        status: payload.status,
        statusText: payload.statusText,
        headers: payload.headers || {},
        config: config,
        request: null
      };
      var validate = config.validateStatus || function (status) { return status >= 200 && status < 300; };
      if (!validate(payload.status)) {
        var error = new Error('Request failed with status code ' + payload.status);
        error.config = config;
        error.response = result;
        error.isAxiosError = true;
        error.code = payload.status === 401 || payload.status === 403
          ? 'ERR_FORBIDDEN'
          : payload.status === 408 || payload.status === 504
            ? 'ECONNABORTED'
            : 'ERR_BAD_RESPONSE';
        if (isBinary) error.response.data = result.data;
        throw error;
      }
      return result;
    }

    var axios = function (urlOrConfig, maybeConfig) {
      var config;
      if (typeof urlOrConfig === 'string') {
        config = Object.assign({}, maybeConfig || {}, { url: urlOrConfig });
      } else {
        config = Object.assign({}, urlOrConfig || {});
      }
      return request(String(config.method || 'GET').toUpperCase(), config.url, config.data, config);
    };
    axios.get = function (url, config) { return request('GET', url, undefined, config); };
    axios.delete = function (url, config) { return request('DELETE', url, undefined, config); };
    axios.head = function (url, config) { return request('HEAD', url, undefined, config); };
    axios.options = function (url, config) { return request('OPTIONS', url, undefined, config); };
    axios.post = function (url, data, config) { return request('POST', url, data, config); };
    axios.put = function (url, data, config) { return request('PUT', url, data, config); };
    axios.patch = function (url, data, config) { return request('PATCH', url, data, config); };
    axios.request = function (config) {
      return request(String((config && config.method) || 'GET').toUpperCase(), config && config.url, config && config.data, config);
    };
    axios.create = function (overrides) {
      return createAxios(Object.assign({}, defaults, overrides || {}));
    };
    axios.defaults = Object.assign({ headers: { common: {} } }, defaults);
    axios.interceptors = {
      request: { use: function () { return 0; }, eject: function () {} },
      response: { use: function () { return 0; }, eject: function () {} }
    };
    axios.isAxiosError = function (value) { return !!(value && value.isAxiosError); };
    axios.all = function (list) { return Promise.all(list); };
    axios.spread = function (fn) {
      return function (args) { return fn.apply(null, args); };
    };
    return axios;
  }

  window.createAxiosShim = function () { return createAxios({}); };

  // Provider-scoped key/value store backed by the sandbox WebView origin.
  var memoryStore = {};
  window.providerKvStore = {
    get: function (key) {
      try {
        var raw = localStorage.getItem('k45:' + key);
        if (raw != null) return Promise.resolve(JSON.parse(raw));
      } catch (e) {}
      return Promise.resolve(Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : undefined);
    },
    set: function (key, value) {
      memoryStore[key] = value;
      try { localStorage.setItem('k45:' + key, JSON.stringify(value)); } catch (e) {}
      return Promise.resolve();
    },
    delete: function (key) {
      delete memoryStore[key];
      try { localStorage.removeItem('k45:' + key); } catch (e) {}
      return Promise.resolve();
    }
  };

  window.openWebView = function (url, options) {
    return new Promise(function (resolve, reject) {
      var id = 'wv_' + (++window.__httpSeq) + '_' + Date.now();
      window.__pendingWebViews[id] = { resolve: resolve, reject: reject };
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'openWebView',
        id: id,
        url: String(url),
        options: options || {}
      }));
    });
  };

  window.loadProviderCode = function (requestId, providerId, code) {
    try {
      var module = { exports: {} };
      var exports = module.exports;
      var wrappedCode = code + '\\n;return module.exports;';
      var factory = new Function('module', 'exports', wrappedCode);
      var result = factory(module, exports);
      window.providers[providerId] = result || module.exports;
      window.ReactNativeWebView.postMessage(JSON.stringify({ id: requestId, result: true }));
    } catch (e) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ id: requestId, error: e.message }));
    }
  };

  window.ensureCheerio = function () {
    if (window.cheerio) return Promise.resolve(true);
    return new Promise(function (resolve) {
      var tries = 0;
      var interval = setInterval(function () {
        tries++;
        if (window.cheerio) {
          clearInterval(interval);
          resolve(true);
        } else if (tries > 100) {
          clearInterval(interval);
          resolve(false);
        }
      }, 100);
    });
  };

  // SHA-1 (FIPS 180-1) — exposed as context.Aes.sha1 for providers that sign
  // requests with it (primewire search). Vega injects Aes: null there, which
  // makes that provider's search throw; a real implementation fixes it.
  function sha1Hex(input) {
    function rotl(n, s) { return (n << s) | (n >>> (32 - s)); }
    var str = String(input);
    var bytes;
    if (typeof TextEncoder === 'function') {
      bytes = Array.prototype.slice.call(new TextEncoder().encode(str));
    } else {
      var escaped = unescape(encodeURIComponent(str));
      bytes = [];
      for (var i = 0; i < escaped.length; i++) bytes.push(escaped.charCodeAt(i) & 0xff);
    }
    var bitLen = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    for (var j = 7; j >= 0; j--) bytes.push(Math.floor(bitLen / Math.pow(2, j * 8)) & 0xff);
    var h0 = 0x67452301, h1 = 0xEFCDAB89, h2 = 0x98BADCFE, h3 = 0x10325476, h4 = 0xC3D2E1F0;
    var w = new Array(80);
    for (var block = 0; block < bytes.length; block += 64) {
      for (var t = 0; t < 16; t++) {
        w[t] = (bytes[block + t * 4] << 24) | (bytes[block + t * 4 + 1] << 16) |
               (bytes[block + t * 4 + 2] << 8) | bytes[block + t * 4 + 3];
      }
      for (var t = 16; t < 80; t++) {
        w[t] = rotl(w[t - 3] ^ w[t - 8] ^ w[t - 14] ^ w[t - 16], 1);
      }
      var a = h0, b = h1, c = h2, d = h3, e = h4;
      for (var t = 0; t < 80; t++) {
        var f, k;
        if (t < 20) { f = (b & c) | (~b & d); k = 0x5A827999; }
        else if (t < 40) { f = b ^ c ^ d; k = 0x6ED9EBA1; }
        else if (t < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8F1BBCDC; }
        else { f = b ^ c ^ d; k = 0xCA62C1D6; }
        var tmp = (rotl(a, 5) + f + e + k + w[t]) | 0;
        e = d; d = c; c = rotl(b, 30); b = a; a = tmp;
      }
      h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0; h4 = (h4 + e) | 0;
    }
    function hex(n) { var s = (n >>> 0).toString(16); return '00000000'.slice(s.length) + s; }
    return hex(h0) + hex(h1) + hex(h2) + hex(h3) + hex(h4);
  }
  window.sha1Hex = sha1Hex;

  window.executeProvider = async function (requestId, providerId, method, args) {
    try {
      if (!window.providers[providerId]) {
        throw new Error('Provider not loaded: ' + providerId);
      }

      var target = window.providers[providerId][method];
      if (target === undefined) {
        throw new Error('Method not found: ' + method);
      }

      var result;
      if (typeof target === 'function') {
        var cheerioReady = await window.ensureCheerio();
        if (!cheerioReady) {
          throw new Error('cheerio unavailable in sandbox');
        }
        var executionAbort = new AbortController();
        window.__executionAborts[requestId] = executionAbort;
        var context = {
          fetch: bridgeFetch,
          load: cheerio.load,
          cheerio: cheerio,
          axios: window.createAxiosShim(),
          kvStore: window.providerKvStore,
          openWebView: window.openWebView,
          Aes: { sha1: function (value) { return Promise.resolve(sha1Hex(value)); } },
          commonHeaders: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
          }
        };
        result = await target(Object.assign({}, args, {
          providerContext: context,
          providerValue: providerId,
          signal: (args && args.signal) || executionAbort.signal
        }));
        delete window.__executionAborts[requestId];
      } else {
        result = target;
      }

      window.ReactNativeWebView.postMessage(JSON.stringify({ id: requestId, result: result }));
    } catch (e) {
      delete window.__executionAborts[requestId];
      window.ReactNativeWebView.postMessage(JSON.stringify({ id: requestId, error: e && e.message ? e.message : String(e) }));
    }
  };
</script>
</body>
</html>
`;

type WafPageCapture = {
  userAgent?: string;
  url?: string;
  html?: string;
  cookies?: string;
};

type WafSession = {
  id: string;
  url: string;
  title?: string;
  description?: string;
  headers?: Record<string, string>;
  waitForCookie?: string;
  resolve: (value: Record<string, any>) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout> | null;
  settled: boolean;
  busy: boolean;
};

let wafSeq = 0;

export default function SandboxWebView() {
  const webviewRef = useRef<WebView | null>(null);
  const wafRef = useRef<WebView | null>(null);
  const [session, setSession] = useState<WafSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const sessionRef = useRef<WafSession | null>(null);
  const pageUrlRef = useRef("");
  const captureWaiters = useRef<
    Record<string, (value: WafPageCapture | null) => void>
  >({});
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollDelay = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { primaryColor } = useThemeStore();

  const clearPolling = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
    if (pollDelay.current) {
      clearTimeout(pollDelay.current);
      pollDelay.current = null;
    }
  }, []);

  const settle = useCallback(
    (target: WafSession, result?: Record<string, any>, error?: Error) => {
      if (target.settled) return;
      target.settled = true;
      if (target.timer) {
        clearTimeout(target.timer);
        target.timer = null;
      }
      clearPolling();
      Object.keys(captureWaiters.current).forEach((key) => {
        captureWaiters.current[key](null);
        delete captureWaiters.current[key];
      });
      if (sessionRef.current === target) {
        sessionRef.current = null;
        setSession(null);
        setBusy(false);
        setStatus("");
      }
      if (error) target.reject(error);
      else target.resolve(result || {});
    },
    [clearPolling],
  );

  const capturePage = useCallback((target: WafSession) => {
    return new Promise<WafPageCapture | null>((resolve) => {
      const webview = wafRef.current;
      if (!webview) {
        resolve(null);
        return;
      }
      const captureId = `waf_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      let done = false;
      const finish = (value: WafPageCapture | null) => {
        if (done) return;
        done = true;
        delete captureWaiters.current[captureId];
        resolve(value);
      };
      captureWaiters.current[captureId] = finish;
      try {
        webview.injectJavaScript(
          `(function(){ window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'wafCapture', id: ${JSON.stringify(
            captureId,
          )}, userAgent: navigator.userAgent, url: location.href, html: document.documentElement.outerHTML, cookies: document.cookie })); })(); true;`,
        );
      } catch {
        finish(null);
        return;
      }
      setTimeout(() => finish(null), 2500);
    });
  }, []);

  const finish = useCallback(
    async (target: WafSession) => {
      if (target.settled || target.busy) return;
      target.busy = true;
      setBusy(true);
      setStatus("Collecting verification cookies…");
      const pageUrl = pageUrlRef.current || target.url;
      let cookieMap: Record<string, string> = {};
      let cookies = "";
      try {
        const jar = await CookieManager.get(pageUrl, Platform.OS === "ios");
        cookieMap = Object.fromEntries(
          Object.entries(jar).map(([name, cookie]) => [name, cookie.value]),
        );
      } catch {
        // Some pages are unreadable from the native cookie store; the hash
        // cookie may still be available through getCookieHeader below.
      }
      try {
        cookies = await CookieManager.getCookieHeader(
          pageUrl,
          Platform.OS === "ios",
        );
      } catch {
        // Fall back to the map collected above.
      }
      if (!cookies) {
        cookies = Object.entries(cookieMap)
          .map(([name, value]) => `${name}=${value}`)
          .join("; ");
      }
      const capture = await capturePage(target);
      // If native CookieManager failed or is empty, use JS extracted document.cookie
      if (!cookies && capture?.cookies) {
        cookies = capture.cookies;
        capture.cookies.split(";").forEach((p: string) => {
          const eq = p.indexOf("=");
          if (eq > 0) cookieMap[p.slice(0, eq).trim()] = p.slice(eq + 1).trim();
        });
      }
      settle(target, {
        cookies,
        cookie: cookies,
        cookieMap,
        userAgent: capture?.userAgent || DEFAULT_UA,
        url: capture?.url || pageUrl,
        data: capture?.html || "",
      });
    },
    [capturePage, settle],
  );

  useEffect(() => {
    if (Platform.OS === "web") return;
    const handler = (url: string, options: Record<string, any>) => {
      return new Promise<Record<string, any>>((resolve, reject) => {
        if (sessionRef.current) {
          reject(new Error("Another verification is already open"));
          return;
        }
        const timeoutMs = Math.min(
          Math.max(Number(options?.timeoutMs) || 120000, 15000),
          300000,
        );
        const next: WafSession = {
          id: `waf_${++wafSeq}`,
          url,
          title:
            typeof options?.title === "string"
              ? options.title
              : "Verification required",
          description:
            typeof options?.description === "string"
              ? options.description
              : "Complete the browser check, then tap Done.",
          headers:
            options?.headers && typeof options.headers === "object"
              ? options.headers
              : undefined,
          waitForCookie:
            typeof options?.waitForCookie === "string"
              ? options.waitForCookie
              : undefined,
          resolve,
          reject,
          timer: null,
          settled: false,
          busy: false,
        };
        next.timer = setTimeout(
          () => settle(next, undefined, new Error("Verification timed out")),
          timeoutMs,
        );
        pageUrlRef.current = url;
        sessionRef.current = next;
        setSession(next);
        setBusy(false);
        setStatus(
          next.waitForCookie
            ? `Waiting for ${next.waitForCookie}…`
            : "Complete the check, then tap Done.",
        );
      });
    };
    SandboxManager.setOpenWebViewHandler(handler);
    setWafHandler(handler);
    return () => {
      SandboxManager.setOpenWebViewHandler(null);
      setWafHandler(null);
      const active = sessionRef.current;
      if (active) settle(active, undefined, new Error("Verification closed"));
    };
  }, [settle]);

  useEffect(() => {
    return () => {
      clearPolling();
      Object.keys(captureWaiters.current).forEach((key) => {
        captureWaiters.current[key](null);
        delete captureWaiters.current[key];
      });
    };
  }, [clearPolling]);

  const startPolling = useCallback(
    (target: WafSession) => {
      if (!target.waitForCookie) return;
      clearPolling();
      pollDelay.current = setTimeout(() => {
        pollDelay.current = null;
        if (target.settled) return;
        const check = async () => {
          if (target.settled || target.busy) return;
          try {
            const jar = await CookieManager.get(
              pageUrlRef.current || target.url,
              Platform.OS === "ios",
            );
            if (jar[target.waitForCookie!]) {
              clearPolling();
              void finish(target);
            }
          } catch {
            // Keep polling until the dialog closes or times out.
          }
        };
        void check();
        pollTimer.current = setInterval(() => {
          void check();
        }, 1500);
      }, 1200);
    },
    [clearPolling, finish],
  );

  const onWafLoadEnd = useCallback(() => {
    const target = sessionRef.current;
    if (!target || target.settled) return;
    startPolling(target);
  }, [startPolling]);

  const onWafNavigation = useCallback((nav: { url?: string }) => {
    if (nav?.url) pageUrlRef.current = nav.url;
  }, []);

  const onWafMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      try {
        const payload = JSON.parse(event.nativeEvent.data);
        if (payload?.type !== "wafCapture") return;
        const waiter = captureWaiters.current[payload.id];
        if (!waiter) return;
        delete captureWaiters.current[payload.id];
        waiter({
          userAgent: payload.userAgent,
          url: payload.url,
          html: payload.html,
          cookies: payload.cookies,
        });
      } catch {
        // Non-JSON messages from the verification page are ignored.
      }
    },
    [],
  );

  if (Platform.OS === "web") {
    return null;
  }

  // react-native-webview has no web implementation; require it lazily so the
  // web bundle never resolves the native module.
  const { WebView: NativeWebView } = require("react-native-webview");

  const cancel = () => {
    const target = sessionRef.current;
    if (target) settle(target, undefined, new Error("Verification cancelled"));
  };

  const confirm = () => {
    const target = sessionRef.current;
    if (target) void finish(target);
  };

  return (
    <>
      <View
        style={{ width: 1, height: 1, position: "absolute", opacity: 0 }}
        pointerEvents="none"
      >
        <NativeWebView
          ref={(instance: WebView | null) => {
            webviewRef.current = instance;
            if (instance) {
              SandboxManager.setWebviewRef(webviewRef);
            } else {
              SandboxManager.detachWebviewRef(webviewRef);
            }
          }}
          source={{ html: SANDBOX_HTML, baseUrl: "file:///" }}
          style={{ width: 1, height: 1, opacity: 0 }}
          onMessage={SandboxManager.handleMessage}
          onLoadStart={() => SandboxManager.notifyLoadStart()}
          onLoadEnd={() => SandboxManager.notifyLoadEnd()}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          originWhitelist={["*"]}
          allowFileAccess={true}
          allowFileAccessFromFileURLs={true}
          allowUniversalAccessFromFileURLs={true}
          mixedContentMode="always"
        />
      </View>

      <Modal
        visible={!!session}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={cancel}
      >
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.headerRow}>
              <View style={styles.headerText}>
                <Text style={styles.title}>
                  {session?.title || "Verification required"}
                </Text>
                <Text style={styles.description}>{session?.description}</Text>
              </View>
              <Pressable onPress={cancel} style={styles.closeButton} hitSlop={12}>
                <Text style={styles.closeText}>✕</Text>
              </Pressable>
            </View>

            {!!status && (
              <Text style={[styles.status, { color: primaryColor }]}>
                {status}
              </Text>
            )}

            <View style={styles.webviewWrap}>
              {session ? (
                <NativeWebView
                  ref={(instance: WebView | null) => {
                    wafRef.current = instance;
                  }}
                  source={{ uri: session.url, headers: session.headers }}
                  style={styles.webview}
                  onMessage={onWafMessage}
                  onNavigationStateChange={onWafNavigation}
                  onLoadEnd={onWafLoadEnd}
                  javaScriptEnabled={true}
                  domStorageEnabled={true}
                  sharedCookiesEnabled={true}
                  thirdPartyCookiesEnabled={true}
                  setSupportMultipleWindows={false}
                  originWhitelist={["*"]}
                />
              ) : null}
              {busy && (
                <View style={styles.busyOverlay}>
                  <ActivityIndicator color={primaryColor} />
                  <Text style={styles.busyText}>Verifying…</Text>
                </View>
              )}
            </View>

            <View style={styles.footer}>
              <Pressable
                onPress={cancel}
                style={styles.cancelButton}
                disabled={busy}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={confirm}
                disabled={busy}
                style={[
                  styles.doneButton,
                  { backgroundColor: primaryColor },
                  busy && styles.buttonDisabled,
                ]}
              >
                <Text style={styles.doneText}>Done</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "flex-end",
  },
  sheet: {
    height: "88%",
    backgroundColor: "#0B0B10",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  headerText: { flex: 1 },
  title: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" },
  description: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 12.5,
    marginTop: 4,
    lineHeight: 18,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  closeText: { color: "rgba(255,255,255,0.75)", fontSize: 15 },
  status: { fontSize: 12, fontWeight: "600", marginTop: 10 },
  webviewWrap: {
    flex: 1,
    marginTop: 12,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  webview: { flex: 1, backgroundColor: "#FFFFFF" },
  busyOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(8,8,12,0.78)",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  busyText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
  footer: { flexDirection: "row", gap: 10, marginTop: 14 },
  cancelButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  cancelText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    fontWeight: "600",
  },
  doneButton: {
    flex: 1.4,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  doneText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  buttonDisabled: { opacity: 0.5 },
});
