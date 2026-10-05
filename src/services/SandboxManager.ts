import { File, Paths } from "expo-file-system";
import type { RefObject } from "react";
import type WebView from "react-native-webview";

type PendingRequest = {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  timer: ReturnType<typeof setTimeout>;
};

const EXECUTION_TIMEOUT_MS = 30000;

class SandboxManagerClass {
  private webviewRef: RefObject<WebView | null> | null = null;
  private pendingRequests: Map<string, PendingRequest> = new Map();
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
  // wipes window.providers, so the in-memory registry must be dropped.
  notifyLoadStart() {
    this.pageLoaded = false;
    this.loadedProviders.clear();
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
      const { id, result, error } = JSON.parse(event.nativeEvent.data);
      if (!id) return;

      const pending = this.pendingRequests.get(id);
      if (!pending) return;

      clearTimeout(pending.timer);
      this.pendingRequests.delete(id);

      if (error) {
        pending.reject(new Error(typeof error === "string" ? error : JSON.stringify(error)));
      } else {
        pending.resolve(result);
      }
    } catch (e) {
      console.error("Sandbox message parse error:", e);
    }
  };

  async execute(
    providerId: string,
    module: string,
    method: string,
    args: any,
  ): Promise<any> {
    if (this.webviewRef?.current == null) {
      throw new Error("Sandbox WebView not initialized");
    }

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
      this.webviewRef?.current?.injectJavaScript(jsCode);
    });
  }

  private async loadProviderIntoSandbox(providerId: string): Promise<void> {
    if (this.webviewRef?.current == null) {
      throw new Error("Sandbox WebView not initialized");
    }

    const bundleFile = new File(Paths.document, "providers", providerId, "bundle.js");
    if (!bundleFile.exists) {
      throw new Error(
        `Provider bundle not found: ${providerId}. Please reinstall it from the Providers screen.`,
      );
    }

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

      this.webviewRef?.current?.injectJavaScript(`
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
