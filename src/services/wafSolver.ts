export type WafOptions = {
  title?: string;
  description?: string;
  headers?: Record<string, string>;
  waitForCookie?: string;
  force?: boolean;
  timeoutMs?: number;
  injectedJavaScript?: string;
};

export type WafResult = {
  data: string;
  cookies: string;
  cookie: string;
  cookieMap: Record<string, string>;
  userAgent: string;
  url: string;
};

type WafHandler = (
  url: string,
  options: Record<string, any>,
) => Promise<Record<string, any>>;

// The interactive Cloudflare/Akamai solver is a mounted React component
// (SandboxWebView). Providers running outside that WebView still need it, so
// the component publishes its handler here and both engines call through.
let handler: WafHandler | null = null;

export function setWafHandler(next: WafHandler | null) {
  handler = next;
}

export function hasWafHandler(): boolean {
  return handler !== null;
}

export function solveWaf(
  url: string,
  options: WafOptions = {},
): Promise<WafResult> {
  if (!/^https?:\/\//i.test(url)) {
    return Promise.reject(new Error("Blocked non-HTTP verification URL"));
  }
  if (!handler) {
    return Promise.reject(
      new Error(
        "Interactive verification is unavailable while the app UI is not ready",
      ),
    );
  }
  return handler(url, options) as Promise<WafResult>;
}
