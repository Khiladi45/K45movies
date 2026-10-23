import { providerContext } from "../lib/providerContext";
import {
  has as registryHas,
  ids as registryIds,
  load as registryLoad,
} from "../providers/registry";

// Matches SandboxManager so a slow provider behaves the same on both engines.
const EXECUTION_TIMEOUT_MS = 30000;

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

/**
 * Runs provider bundles in the app's own JS thread instead of the hidden
 * WebView. Requests still leave through React Native's native networking stack,
 * which is the part that gets trusted by Cloudflare/Akamai — the WebView was
 * only ever a code-isolation boundary, and statically bundled code does not need
 * one because it ships with the app.
 */
class LocalProviderRunnerClass {
  has(providerId: string): boolean {
    return registryHas(providerId);
  }

  ids(): string[] {
    return registryIds();
  }

  /**
   * Signature-compatible with SandboxManager.execute so callers can switch
   * engines without changing call sites. `module` is only used for diagnostics:
   * a provider's catalog/posts/meta/stream/episodes exports are merged into one
   * bundle, so the method name alone identifies the target.
   */
  async execute(
    providerId: string,
    module: string,
    method: string,
    args?: Record<string, any>,
    signal?: AbortSignal,
  ): Promise<any> {
    if (signal?.aborted) throw new Error("canceled");

    let bundle: Record<string, any>;
    try {
      bundle = registryLoad(providerId);
    } catch (error) {
      throw new Error(
        `Provider "${providerId}" failed to load: ${toError(error).message}`,
      );
    }

    const target = bundle?.[method];
    if (target === undefined) {
      throw new Error(
        `Provider "${providerId}" has no ${method}() (module: ${module})`,
      );
    }
    // catalog and genres are plain arrays on most providers.
    if (typeof target !== "function") return target;

    return new Promise((resolve, reject) => {
      const controller = new AbortController();
      let settled = false;

      const detach = () => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
      };
      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        detach();
        controller.abort();
        reject(error);
      };
      const succeed = (value: any) => {
        if (settled) return;
        settled = true;
        detach();
        resolve(value);
      };
      function onAbort() {
        fail(new Error("canceled"));
      }

      const timer = setTimeout(
        () => fail(new Error("Local execution timeout")),
        EXECUTION_TIMEOUT_MS,
      );

      if (signal) {
        signal.addEventListener("abort", onAbort, { once: true });
      }

      Promise.resolve()
        .then(() =>
          target({
            ...(args ?? {}),
            providerContext,
            providerValue: providerId,
            signal: controller.signal,
          }),
        )
        .then(succeed, (error) => fail(toError(error)));
    });
  }
}

export const LocalProviderRunner = new LocalProviderRunnerClass();
