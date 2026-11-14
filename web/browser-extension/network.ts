import axios, { AxiosError, AxiosHeaders } from "axios";

export class HostAccess extends Error {
  constructor(public origin: string) { super("Allow access to " + new URL(origin).hostname + " from the extension icon, then retry."); }
}

export function httpsUrl(value: string, base?: string) {
  const url = new URL(value, base);
  if (url.protocol !== "https:" || url.username || url.password || url.port ||
      !/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(url.hostname) ||
      /^\d+(?:\.\d+){3}$/.test(url.hostname) || /\.(?:local|internal|localhost|test)$/i.test(url.hostname)) {
    throw new Error("Unsupported provider URL.");
  }
  return url;
}

export async function providerFetch(input: string | URL, options?: RequestInit) {
  const url = httpsUrl(String(input));
  // Vega redirects its first unfiltered page to the catalog root.
  if (url.hostname === "vegamovies.lease" && url.pathname === "/page/1/") url.pathname = "/";
  const origin = url.origin + "/*";
  if (!await chrome.permissions.contains({ origins: [origin] })) throw new HostAccess(origin);
  const headers = new Headers(options?.headers);
  for (const name of ["cookie", "origin", "referer", "host", "user-agent", "authorization"]) headers.delete(name);
  return fetch(url, {
    ...options, headers, credentials: "omit", redirect: "error",
    signal: AbortSignal.any([AbortSignal.timeout(15000), ...(options?.signal ? [options.signal] : [])]),
  });
}

export function providerHttp(signal: AbortSignal) {
  return axios.create({ adapter: async (config) => {
    const result = await providerFetch(axios.getUri(config), {
      method: config.method, body: config.data,
      headers: Object.entries(config.headers.toJSON(true)).map(([key, value]) => [key, String(value)]),
      signal,
    });
    const response = {
      data: config.responseType === "arraybuffer" ? await result.arrayBuffer() : await result.text(),
      status: result.status, statusText: result.statusText,
      headers: AxiosHeaders.from(Object.fromEntries(result.headers)), config,
      request: { responseURL: result.url },
    };
    if (config.validateStatus && !config.validateStatus(result.status)) {
      throw new AxiosError("Provider returned HTTP " + result.status, AxiosError.ERR_BAD_RESPONSE, config, response.request, response);
    }
    return response;
  } });
}
