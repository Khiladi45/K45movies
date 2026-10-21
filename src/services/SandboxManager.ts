import { File, Paths } from "expo-file-system";
import { Platform } from "react-native";
import type { RefObject } from "react";
import type WebView from "react-native-webview";
import { ProviderManager } from "./ProviderManager";

type PendingRequest = {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  timer: ReturnType<typeof setTimeout>;
  cleanup?: () => void;
};

export type OpenWebViewHandler = (
  url: string,
  options: Record<string, any>,
) => Promise<Record<string, any>>;

const EXECUTION_TIMEOUT_MS = 30000;

// Fallback for providers that send no User-Agent — native fetch would
// otherwise advertise "okhttp/..." which anti-bot layers block on sight.
export const DEFAULT_UA =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

const BASE64_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

const bytesToBase64 = (bytes: Uint8Array): string => {
  const chunks: string[] = [];
  let chunk = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const has1 = i + 1 < bytes.length;
    const has2 = i + 2 < bytes.length;
    const b1 = has1 ? bytes[i + 1] : 0;
    const b2 = has2 ? bytes[i + 2] : 0;
    chunk +=
      BASE64_CHARS[b0 >> 2] +
      BASE64_CHARS[((b0 & 3) << 4) | (b1 >> 4)] +
      (has1 ? BASE64_CHARS[((b1 & 15) << 2) | (b2 >> 6)] : "=") +
      (has2 ? BASE64_CHARS[b2 & 63] : "=");
    if (chunk.length >= 8192) {
      chunks.push(chunk);
      chunk = "";
    }
  }
  if (chunk) chunks.push(chunk);
  return chunks.join("");
};

const BINARY_CONTENT_TYPE =
  /^(?:image|audio|video|font)\/|application\/(?:octet-stream|zip|pdf|wasm|x-font|x-msdownload|vnd\.android\.package-archive)/i;

class SandboxManagerClass {
  private webviewRef: RefObject<WebView | null> | null = null;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private pendingHttpRequests: Map<string, { abort: () => void }> = new Map();
  private loadedProviders: Set<string> = new Set();
  private pageLoaded = false;
  private loadWaiters: Array<() => void> = [];
  private openWebViewHandler: OpenWebViewHandler | null = null;

  setWebviewRef(ref: RefObject<WebView | null>) {
    this.webviewRef = ref;
  }

  detachWebviewRef(ref: RefObject<WebView | null>) {
    if (this.webviewRef === ref) {
      this.webviewRef = null;
    }
  }

  setOpenWebViewHandler(handler: OpenWebViewHandler | null) {
    this.openWebViewHandler = handler;
  }

  // Called by the sandbox WebView when a page load starts/finishes. A reload
  // wipes window.providers and window.__pendingHttp, so the in-memory
  // registry and in-flight requests must be dropped too.
  notifyLoadStart() {
    this.pageLoaded = false;
    this.loadedProviders.clear();
    this.pendingHttpRequests.forEach((p) => p.abort());
    this.pendingHttpRequests.clear();
    this.pendingRequests.forEach((pending) => {
      clearTimeout(pending.timer);
      pending.cleanup?.();
      pending.reject(new Error("Sandbox reloaded"));
    });
    this.pendingRequests.clear();
  }

  notifyLoadEnd() {
    this.pageLoaded = true;
    this.loadWaiters.forEach((flush) => flush());
    this.loadWaiters = [];
  }

  private waitForPageLoad(): Promise<void> {
    if (this.pageLoaded) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.loadWaiters = this.loadWaiters.filter((w) => w !== flush);
        reject(new Error("Sandbox WebView failed to load"));
      }, EXECUTION_TIMEOUT_MS);
      const flush = () => {
        clearTimeout(timer);
        resolve();
      };
      this.loadWaiters.push(flush);
    });
  }

  handleMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const parsed = JSON.parse(event.nativeEvent.data);

      if (parsed.type === "httpRequest") {
        void this.handleHttpRequest(parsed);
        return;
      }
      if (parsed.type === "httpAbort") {
        const pending = this.pendingHttpRequests.get(parsed.httpId);
        if (pending) {
          pending.abort();
          this.pendingHttpRequests.delete(parsed.httpId);
        }
        return;
      }
      if (parsed.type === "openWebView") {
        void this.handleOpenWebViewRequest(parsed);
        return;
      }

      const { id, result, error } = parsed;
      if (!id) return;

      const pendingRequest = this.pendingRequests.get(id);
      if (!pendingRequest) return;

      clearTimeout(pendingRequest.timer);
      pendingRequest.cleanup?.();
      this.pendingRequests.delete(id);

      if (error) {
        pendingRequest.reject(
          new Error(typeof error === "string" ? error : JSON.stringify(error)),
        );
      } else {
        pendingRequest.resolve(result);
      }
    } catch (e) {
      console.error("Sandbox message parse error:", e);
    }
  };

  private hasHeader(headers: Record<string, string>, name: string): boolean {
    const target = name.toLowerCase();
    return Object.keys(headers).some((k) => k.toLowerCase() === target);
  }

  private inject(js: string) {
    try {
      this.webviewRef?.current?.injectJavaScript(js);
    } catch {
      // The WebView may have been torn down between scheduling and injection.
    }
  }

  private replyHttp(payload: Record<string, unknown>) {
    // Double stringify keeps U+2028/2029 and quotes from breaking the
    // injected JS string; JSON.parse on the sandbox side restores the object.
    this.inject(
      `(function(){ window.__onHttpResponse(JSON.parse(${JSON.stringify(
        JSON.stringify(payload),
      )})); })(); true;`,
    );
  }

  private replyWebView(payload: Record<string, unknown>) {
    this.inject(
      `(function(){ window.__onWebViewResult(JSON.parse(${JSON.stringify(
        JSON.stringify(payload),
      )})); })(); true;`,
    );
  }

  private abortExecution(requestId: string) {
    this.inject(
      `(function(){ try { var c = window.__executionAborts[${JSON.stringify(
        requestId,
      )}]; if (c) c.abort(); } catch (e) {} delete window.__executionAborts[${JSON.stringify(
        requestId,
      )}]; })(); true;`,
    );
  }

  // The WebView's browser fetch silently strips forbidden headers
  // (User-Agent, Referer, Origin, Cookie) that provider bundles set — servers
  // then 403/404 them. Perform the request with the native RN network stack,
  // which sends every header verbatim like real axios in Vega.
  private async handleHttpRequest(req: any) {
    const httpId = String(req.httpId || "");
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const timeoutMs = Number(req.timeout) || 0;

    this.pendingHttpRequests.set(httpId, { abort: () => controller.abort() });

    try {
      const rawUrl = String(req.url || "");
      if (!/^https?:\/\//i.test(rawUrl)) {
        throw new Error("Blocked non-HTTP request in sandbox");
      }

      const headers: Record<string, string> = {};
      const reqHeaders = req.headers || {};
      for (const key of Object.keys(reqHeaders)) {
        headers[key] = String(reqHeaders[key]);
      }
      if (!this.hasHeader(headers, "user-agent")) {
        headers["User-Agent"] = DEFAULT_UA;
      }

      let body: string | FormData | undefined;
      const reqBody = req.body;
      if (reqBody && typeof reqBody === "object") {
        if (reqBody.kind === "formData" && Array.isArray(reqBody.entries)) {
          const fd = new FormData();
          for (const entry of reqBody.entries) {
            fd.append(String(entry[0]), String(entry[1]));
          }
          body = fd;
        } else if (typeof reqBody.value === "string") {
          body = reqBody.value;
          if (reqBody.contentType && !this.hasHeader(headers, "content-type")) {
            headers["Content-Type"] = String(reqBody.contentType);
          }
        }
      }

      if (timeoutMs > 0) {
        timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      }

      const response = await fetch(rawUrl, {
        method: String(req.method || "GET").toUpperCase(),
        headers,
        body,
        signal: controller.signal,
      });

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      const finalUrl = response.url || rawUrl;
      const redirected = !!response.redirected || finalUrl !== rawUrl;

      // React Native's fetch follows redirects even when callers ask for
      // "manual". Providers such as cinefreak and eonMovies inspect the 3xx
      // status and Location header, so synthesize one from the final URL.
      if (req.redirect === "manual" && redirected) {
        this.replyHttp({
          httpId,
          status: 302,
          statusText: "Found",
          headers: { ...responseHeaders, location: finalUrl },
          body: "",
          url: finalUrl,
          redirected: true,
        });
        return;
      }

      const wantsBinary =
        /arraybuffer|blob|stream/i.test(String(req.responseType || "")) ||
        BINARY_CONTENT_TYPE.test(responseHeaders["content-type"] || "");

      let responseBody: string;
      let encoding: "base64" | undefined;
      if (wantsBinary) {
        const buffer = await response.arrayBuffer();
        responseBody = bytesToBase64(new Uint8Array(buffer));
        encoding = "base64";
      } else {
        responseBody = await response.text();
      }

      this.replyHttp({
        httpId,
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: responseBody,
        ...(encoding ? { encoding } : {}),
        url: finalUrl,
        redirected,
      });
    } catch (e: any) {
      this.replyHttp({
        httpId,
        error: e?.message || String(e),
      });
    } finally {
      if (timeoutId != null) clearTimeout(timeoutId);
      this.pendingHttpRequests.delete(httpId);
    }
  }

  private async handleOpenWebViewRequest(req: any) {
    const id = String(req.id || "");
    try {
      const url = String(req.url || "");
      if (!/^https?:\/\//i.test(url)) {
        throw new Error("Blocked non-HTTP verification URL");
      }
      if (!this.openWebViewHandler) {
        throw new Error(
          "Interactive verification is unavailable while the app UI is not ready",
        );
      }
      const result = await this.openWebViewHandler(url, req.options || {});
      this.replyWebView({ id, result });
    } catch (e: any) {
      this.replyWebView({ id, error: e?.message || String(e) });
    }
  }

  // Wait for the hidden WebView to mount. Queries can fire before the
  // sandbox commits, so poll briefly instead of failing on first call.
  private async ensureWebview(): Promise<RefObject<WebView | null>> {
    if (Platform.OS === "web") {
      throw new Error(
        "Providers only run in the Android/iOS app — the sandbox WebView is unavailable in the browser.",
      );
    }
    const start = Date.now();
    while (this.webviewRef?.current == null) {
      if (Date.now() - start > EXECUTION_TIMEOUT_MS) {
        throw new Error("Sandbox WebView not initialized");
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
    }
    return this.webviewRef;
  }

  async execute(
    providerId: string,
    module: string,
    method: string,
    args: any,
    signal?: AbortSignal,
  ): Promise<any> {
    const webviewRef = await this.ensureWebview();

    if (!this.loadedProviders.has(providerId)) {
      await this.loadProviderIntoSandbox(providerId);
    }

    await this.waitForPageLoad();
    if (signal?.aborted) throw new Error("canceled");

    return new Promise((resolve, reject) => {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
      let settled = false;

      const cleanup = () => {
        settled = true;
        if (signal) signal.removeEventListener("abort", onAbort);
      };

      const onAbort = () => {
        if (settled) return;
        clearTimeout(timer);
        cleanup();
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          this.abortExecution(id);
          reject(new Error("canceled"));
        }
      };

      const timer = setTimeout(() => {
        if (!this.pendingRequests.has(id)) return;
        this.pendingRequests.delete(id);
        cleanup();
        this.abortExecution(id);
        reject(new Error("Sandbox execution timeout"));
      }, EXECUTION_TIMEOUT_MS);
      this.pendingRequests.set(id, { resolve, reject, timer, cleanup });

      if (signal) {
        if (signal.aborted) {
          onAbort();
          return;
        }
        signal.addEventListener("abort", onAbort, { once: true });
      }

      const jsCode = `
        (function() {
          window.executeProvider(
            ${JSON.stringify(id)},
            ${JSON.stringify(providerId)},
            ${JSON.stringify(method)},
            ${JSON.stringify(args ?? null)}
          );
        })();
        true;
      `;
      webviewRef.current?.injectJavaScript(jsCode);
    });
  }

  private async loadProviderIntoSandbox(providerId: string): Promise<void> {
    const webviewRef = await this.ensureWebview();

    // Self-heal: the persisted store can claim a provider is installed
    // without a bundle on disk. Re-download instead of making the user
    // reinstall from the Providers screen.
    try {
      await ProviderManager.ensureProviderBundle(providerId);
    } catch (e: any) {
      throw new Error(
        `Provider "${providerId}" could not be prepared: ${e?.message || e}`,
      );
    }

    const bundleFile = new File(Paths.document, "providers", providerId, "bundle.js");
    const jsCode = await bundleFile.text();
    await this.waitForPageLoad();

    return new Promise<void>((resolve, reject) => {
      const id = `load_${providerId}_${Date.now()}`;
      const timer = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Timed out loading provider into sandbox: ${providerId}`));
        }
      }, EXECUTION_TIMEOUT_MS);
      this.pendingRequests.set(id, {
        resolve: () => {
          this.loadedProviders.add(providerId);
          resolve();
        },
        reject,
        timer,
      });

      webviewRef.current?.injectJavaScript(`
        (function() {
          window.loadProviderCode(
            ${JSON.stringify(id)},
            ${JSON.stringify(providerId)},
            ${JSON.stringify(jsCode)}
          );
        })();
        true;
      `);
    });
  }

  unloadProvider(providerId: string) {
    this.loadedProviders.delete(providerId);
    this.inject(`
      (function() {
        if (window.providers && window.providers[${JSON.stringify(providerId)}]) {
          delete window.providers[${JSON.stringify(providerId)}];
        }
      })();
      true;
    `);
  }

  isProviderLoaded(providerId: string): boolean {
    return this.loadedProviders.has(providerId);
  }
}

export const SandboxManager = new SandboxManagerClass();
