import React, { useRef } from "react";
import { Platform, View } from "react-native";
import type WebView from "react-native-webview";
import { SandboxManager } from "../services/SandboxManager";
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

  // Native HTTP bridge for axios. Browser fetch forbids setting headers like
  // User-Agent, Referer, Origin and Cookie — provider bundles set them (WAF
  // helpers add Referer; scrapers set UA/Cookie) and servers 403/404 when the
  // WebView silently strips them. Requests are forwarded to the React Native
  // side, whose native network stack sends every header verbatim, exactly
  // like real axios in Vega.
  window.__pendingHttp = {};
  window.__httpSeq = 0;

  window.__onHttpResponse = function(payload) {
    var pending = window.__pendingHttp[payload.httpId];
    if (!pending) return;
    delete window.__pendingHttp[payload.httpId];
    if (payload.error) pending.reject(new Error(payload.error));
    else pending.resolve(payload);
  };

  window.createAxiosShim = function() {
    function serializeBody(data) {
      if (data == null) return null;
      if (typeof data === 'string') return { kind: 'text', value: data };
      if (typeof URLSearchParams === 'function' && data instanceof URLSearchParams) {
        return { kind: 'text', value: data.toString(), contentType: 'application/x-www-form-urlencoded' };
      }
      if (typeof FormData === 'function' && data instanceof FormData) {
        var entries = [];
        try {
          var it = data.entries();
          var step;
          while (!(step = it.next()).done) {
            entries.push([String(step.value[0]), String(step.value[1])]);
          }
        } catch (e) {}
        return { kind: 'formData', entries: entries };
      }
      return { kind: 'text', value: JSON.stringify(data), contentType: 'application/json' };
    }

    function nativeRequest(method, url, data, config) {
      return new Promise(function(resolve, reject) {
        var httpId = 'http_' + (++window.__httpSeq) + '_' + Date.now();
        var signal = config.signal;
        var onAbort = function() {
          if (window.__pendingHttp[httpId]) {
            delete window.__pendingHttp[httpId];
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'httpAbort', httpId: httpId }));
            reject(new Error('canceled'));
          }
        };
        if (signal && signal.aborted) { onAbort(); return; }
        if (signal && signal.addEventListener) signal.addEventListener('abort', onAbort, { once: true });
        window.__pendingHttp[httpId] = { resolve: resolve, reject: reject };
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'httpRequest',
          httpId: httpId,
          method: method,
          url: url,
          headers: config.headers || {},
          body: serializeBody(data),
          timeout: Number(config.timeout) || 0
        }));
      });
    }

    async function request(method, url, data, config) {
      config = config || {};
      var payload = await nativeRequest(method, url, data, config);
      var raw = payload.body == null ? '' : String(payload.body);
      var parsed = raw;
      if (config.responseType !== 'text' && config.responseType !== 'arraybuffer') {
        try { parsed = JSON.parse(raw); } catch (e) {}
      }
      var result = {
        data: parsed,
        status: payload.status,
        statusText: payload.statusText,
        headers: payload.headers || {}
      };
      if (payload.status < 200 || payload.status >= 300) {
        var err = new Error('Request failed with status code ' + payload.status);
        err.response = result;
        throw err;
      }
      return result;
    }

    // Many providers call axios itself — axios(url, config), axios(config) —
    // not just the .get/.post helpers, so the shim must be callable directly.
    var axios = function(urlOrConfig, maybeConfig) {
      if (typeof urlOrConfig === 'string') {
        var cfg = Object.assign({}, maybeConfig || {}, { url: urlOrConfig });
        return request(String(cfg.method || 'GET').toUpperCase(), cfg.url, cfg.data, cfg);
      }
      var config = urlOrConfig || {};
      return request(String(config.method || 'GET').toUpperCase(), config.url, config.data, config);
    };
    axios.get = function(url, config) { return request('GET', url, undefined, config); };
    axios.post = function(url, data, config) { return request('POST', url, data, config); };
    axios.head = function(url, config) { return request('HEAD', url, undefined, config); };
    axios.delete = function(url, config) { return request('DELETE', url, undefined, config); };
    axios.put = function(url, data, config) { return request('PUT', url, data, config); };
    axios.patch = function(url, data, config) { return request('PATCH', url, data, config); };
    return axios;
  };

  window.loadProviderCode = function(requestId, providerId, code) {
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

  window.ensureCheerio = function() {
    if (window.cheerio) return Promise.resolve(true);
    return new Promise(function(resolve) {
      var tries = 0;
      var interval = setInterval(function() {
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

  window.executeProvider = async function(requestId, providerId, method, args) {
    try {
      if (!window.providers[providerId]) {
        throw new Error('Provider not loaded: ' + providerId);
      }

      var target = window.providers[providerId][method];
      // Some exports are plain data (e.g. catalog arrays), not functions.
      if (target === undefined) {
        throw new Error('Method not found: ' + method);
      }

      var result;
      if (typeof target === 'function') {
        var cheerioReady = await window.ensureCheerio();
        if (!cheerioReady) {
          throw new Error('cheerio unavailable in sandbox');
        }
        var context = {
          fetch: window.fetch.bind(window),
          load: cheerio.load,
          cheerio: cheerio,
          axios: window.createAxiosShim(),
          commonHeaders: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
          }
        };
        var executionAbort = new AbortController();
        result = await target(Object.assign({}, args, {
          providerContext: context,
          providerValue: providerId,
          // Some providers (e.g. showbox) read signal.aborted unguarded, so
          // every execution must receive a live AbortSignal, never undefined.
          signal: (args && args.signal) || executionAbort.signal
        }));
      } else {
        result = target;
      }

      window.ReactNativeWebView.postMessage(JSON.stringify({ id: requestId, result: result }));
    } catch (e) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ id: requestId, error: e.message }));
    }
  };
</script>
</body>
</html>
`;

export default function SandboxWebView() {
  const webviewRef = useRef<WebView | null>(null);

  if (Platform.OS === "web") {
    return null;
  }

  // react-native-webview has no web implementation; require it lazily so the
  // web bundle never resolves the native module.
  const { WebView: NativeWebView } = require("react-native-webview");

  return (
    <View style={{ width: 1, height: 1, position: "absolute", opacity: 0 }} pointerEvents="none">
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
  );
}
