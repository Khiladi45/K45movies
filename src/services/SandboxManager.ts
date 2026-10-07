import { File, Paths } from "expo-file-system";
import { Platform } from "react-native";
import type { RefObject } from "react";
import type WebView from "react-native-webview";
import { ProviderManager } from "./ProviderManager";

type PendingRequest = {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  timer: ReturnType<typeof setTimeout>;
};

const EXECUTION_TIMEOUT_MS = 30000;

// Fallback for providers that send no User-Agent — native fetch would
// otherwise advertise "okhttp/..." which anti-bot layers block on sight.
export const DEFAULT_UA =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

class SandboxManagerClass {
  private webviewRef: RefObject<WebView | null> | null = null;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private pendingHttpRequests: Map<string, { abort: () => void }> = new Map();
  private loadedProviders: Set<string> = new Set();
  private pageLoaded = false;
  private loadWaiters: Array<() => void> = [];

  setWebviewRef(ref: RefObject<WebView | null>) {
    this.webviewRef = ref;
  }

  detachWebviewRef(ref: RefObject<WebView | null>) {
    if (this.webviewRef === ref) {
      this.webviewRef = null;
    }
  }

  // Called by the sandbox WebView when a page load starts/finishes. A reload
  // wipes window.providers and window.__pendingHttp, so the in-memory
  // registry and in-flight native HTTP requests must be dropped too.
  notifyLoadStart() {
    this.pageLoaded = false;
    this.loadedProviders.clear();
    this.pendingHttpRequests.forEach((p) => p.abort());
    this.pendingHttpRequests.clear();
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
        this.handleHttpRequest(parsed);
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

      const { id, result, error } = parsed;
      if (!id) return;

      const pendingRequest = this.pendingRequests.get(id);
      if (!pendingRequest) return;

      clearTimeout(pendingRequest.timer);
      this.pendingRequests.delete(id);

      if (error) {
        console.warn(`[Sandbox] ${id} failed:`, error);
        pendingRequest.reject(new Error(typeof error === "string" ? error : JSON.stringify(error)));
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

  private replyHttp(payload: Record<string, unknown>) {
    // Double stringify keeps U+2028/2029 and quotes from breaking the
    // injected JS string; JSON.parse on the sandbox side restores the object.
    this.webviewRef?.current?.injectJavaScript(
      `(function(){ window.__onHttpResponse(JSON.parse(${JSON.stringify(JSON.stringify(payload))})); })(); true;`,
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

      const response = await fetch(req.url, {
        method: String(req.method || "GET").toUpperCase(),
        headers,
        body,
        signal: controller.signal,
      });
      const text = await response.text();

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      this.replyHttp({
        httpId,
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: text,
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
  ): Promise<any> {
    const webviewRef = await this.ensureWebview();

    if (!this.loadedProviders.has(providerId)) {
      await this.loadProviderIntoSandbox(providerId);
    }

    await this.waitForPageLoad();

    return new Promise((resolve, reject) => {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
      const timer = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error("Sandbox execution timeout"));
        }
      }, EXECUTION_TIMEOUT_MS);
      this.pendingRequests.set(id, { resolve, reject, timer });

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
    this.webviewRef?.current?.injectJavaScript(`
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
