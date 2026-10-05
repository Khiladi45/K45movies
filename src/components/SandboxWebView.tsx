import React, { useEffect, useRef } from "react";
import { Platform, View } from "react-native";
import type WebView from "react-native-webview";
import { SandboxManager } from "../services/SandboxManager";

const SANDBOX_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <script src="https://cdn.jsdelivr.net/npm/cheerio@1.0.0-rc.12/dist/browser/cheerio.min.js"></script>
</head>
<body>
<script>
  window.providers = {};

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

  window.executeProvider = async function(requestId, providerId, method, args) {
    try {
      if (!window.providers[providerId]) {
        throw new Error('Provider not loaded: ' + providerId);
      }

      if (typeof window.providers[providerId][method] !== 'function') {
        throw new Error('Method not found: ' + method);
      }

      var context = {
        fetch: window.fetch.bind(window),
        load: cheerio.load,
        cheerio: cheerio,
        commonHeaders: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
        }
      };

      var providerModule = window.providers[providerId];
      var result = await providerModule[method](Object.assign({}, args, {
        providerContext: context,
        providerValue: providerId
      }));

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

  useEffect(() => {
    SandboxManager.setWebviewRef(webviewRef);
    return () => SandboxManager.detachWebviewRef(webviewRef);
  }, []);

  if (Platform.OS === "web") {
    return null;
  }

  // react-native-webview has no web implementation; require it lazily so the
  // web bundle never resolves the native module.
  const { WebView: NativeWebView } = require("react-native-webview");

  return (
    <View style={{ width: 1, height: 1, position: "absolute", opacity: 0 }} pointerEvents="none">
      <NativeWebView
        ref={webviewRef}
        source={{ html: SANDBOX_HTML }}
        style={{ width: 1, height: 1, opacity: 0 }}
        onMessage={SandboxManager.handleMessage}
        onLoadStart={() => SandboxManager.notifyLoadStart()}
        onLoadEnd={() => SandboxManager.notifyLoadEnd()}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        originWhitelist={["*"]}
        allowFileAccess={true}
        mixedContentMode="always"
      />
    </View>
  );
}
