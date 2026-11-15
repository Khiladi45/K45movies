import "server-only";
import { lookup } from "node:dns";
import { Agent, fetch as upstreamFetch } from "undici";
import ipaddr from "ipaddr.js";
import { CookieJar } from "tough-cookie";
import axios, { AxiosError, AxiosHeaders } from "axios";

function publicAddress(address: string) {
  return ipaddr.process(address).range() === "unicast";
}

// The lookup callback supplies the resolved addresses directly to the socket.
const dispatcher = new Agent({
  connect: {
    lookup(hostname, options, callback) {
      lookup(hostname, { ...options, all: true }, (error, addresses) => {
        if (error) return callback(error, "", 0);
        if (!addresses.length || addresses.some(({ address }) => !publicAddress(address))) {
          return callback(new Error("Provider network destination is unavailable."), "", 0);
        }
        if (options.all) return callback(null, addresses);
        return callback(null, addresses[0].address, addresses[0].family);
      });
    },
  },
});

function destination(input: string | URL) {
  const url = new URL(input);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.port ||
      !host.includes(".") && !host.includes(":") ||
      (ipaddr.isValid(host) && !publicAddress(host))) {
    throw new Error("Provider network destination is unavailable.");
  }
  return url;
}

const maxBody = 8 * 1024 * 1024;

type NetworkIssue = { message: string; status?: number; timeout?: boolean };

export function providerNetwork(signal: AbortSignal, defaultHeaders?: HeadersInit, onIssue?: (issue: NetworkIssue) => void) {
  const jar = new CookieJar();
  let requests = 0;
  const networkRequest = async (input: string | URL, options?: RequestInit, maxRedirects = 5): Promise<Response> => {
    let url = destination(input);
    let method = (options?.method || "GET").toUpperCase();
    let body = options?.body;
    const headers = new Headers(defaultHeaders);
    new Headers(options?.headers).forEach((value, key) => headers.set(key, value));
    for (const name of ["host", "connection", "content-length", "proxy-authorization", "transfer-encoding"]) headers.delete(name);
    const deadline = AbortSignal.any([signal, AbortSignal.timeout(12_000), ...(options?.signal ? [options.signal] : [])]);

    for (let redirect = 0; redirect <= 5; redirect++) {
      if (++requests > 70) throw new Error("Provider request budget exceeded.");
      const outgoing = new Headers(headers);
      const cookies = await jar.getCookieString(url.href);
      if (cookies && !outgoing.has("cookie")) outgoing.set("cookie", cookies);
      const res = await upstreamFetch(url, {
        method, body: body as string | undefined, headers: Array.from(outgoing.entries()),
        signal: deadline, redirect: "manual", dispatcher,
      });
      for (const cookie of res.headers.getSetCookie()) await jar.setCookie(cookie, url.href, { ignoreError: true });
      const location = res.headers.get("location");
      if (location && options?.redirect !== "manual" && [301, 302, 303, 307, 308].includes(res.status)) {
        if (options?.redirect === "error" || redirect === maxRedirects) {
          await res.body?.cancel();
          throw new Error("Upstream redirect limit reached.");
        }
        await res.body?.cancel();
        const next = destination(new URL(location, url));
        if (next.origin !== url.origin) {
          for (const name of ["authorization", "cookie", "origin", "referer"]) headers.delete(name);
        }
        if (res.status === 303 || ([301, 302].includes(res.status) && method === "POST")) {
          method = "GET";
          body = undefined;
          headers.delete("content-type");
        }
        url = next;
        continue;
      }

      if (res.status >= 400) onIssue?.({ status: res.status, message: "Upstream returned HTTP " + res.status + "." });
      const parts: Uint8Array[] = [];
      let size = 0;
      const reader = res.body?.getReader();
      if (reader) {
        try {
          for (;;) {
            const chunk = await reader.read();
            if (chunk.done) break;
            size += chunk.value.byteLength;
            if (size > maxBody) {
              await reader.cancel();
              throw new Error("Provider response exceeded its size limit.");
            }
            parts.push(chunk.value);
          }
        } finally {
          reader.releaseLock();
        }
      }
      const response = new Response(parts.length ? Buffer.concat(parts) : null, {
        headers: Array.from(res.headers.entries()), status: res.status, statusText: res.statusText,
      });
      Object.defineProperty(response, "url", { value: url.href });
      return response;
    }
    throw new Error("Too many upstream redirects.");
  };

  const request: typeof networkRequest = async (...args) => {
    try { return await networkRequest(...args); }
    catch (error) {
      const value = error as Error & { cause?: { code?: string }; code?: string };
      const code = value.cause?.code ?? value.code;
      const timeout = value.name === "TimeoutError" || code === "UND_ERR_CONNECT_TIMEOUT";
      const message = timeout ? "Upstream request timed out." :
        value.name === "AbortError" ? "Upstream request was canceled." :
        typeof code === "string" ? "Upstream request failed (" + code + ")." : value.message;
      onIssue?.({ message, timeout });
      throw error;
    }
  };

  const http = axios.create({
    adapter: async (config) => {
      const signals = [config.signal instanceof AbortSignal ? config.signal : undefined,
        config.timeout && config.timeout > 0 ? AbortSignal.timeout(config.timeout) : undefined]
        .filter((entry): entry is AbortSignal => !!entry);
      const res = await request(axios.getUri(config), {
        method: config.method,
        headers: Object.entries(config.headers.toJSON(true)).map(([key, value]) => [key, String(value)]),
        body: config.data,
        signal: signals.length ? AbortSignal.any(signals) : undefined,
        redirect: config.maxRedirects === 0 ? "manual" : undefined,
      }, Math.min(config.maxRedirects ?? 5, 5));
      const response = {
        data: config.responseType === "arraybuffer" ? await res.arrayBuffer() : await res.text(),
        status: res.status, statusText: res.statusText,
        headers: AxiosHeaders.from({ ...Object.fromEntries(res.headers), "set-cookie": res.headers.getSetCookie() }), config,
        request: { responseURL: res.url, res: { responseUrl: res.url }, _redirectable: { _currentUrl: res.url } },
      };
      if (config.validateStatus && !config.validateStatus(res.status)) {
        throw new AxiosError("Upstream request failed.", AxiosError.ERR_BAD_RESPONSE, config, response.request, response);
      }
      return response;
    },
  });

  return { request, http };
}

export async function streamUpstream(value: string, method: string, headers: Headers, signal: AbortSignal) {
  let url = destination(value);
  const connect = new AbortController();
  const timer = setTimeout(() => connect.abort(), 15_000);
  try {
    const deadline = AbortSignal.any([signal, connect.signal]);
    for (let index = 0; index <= 5; index++) {
      const response = await upstreamFetch(url, {
        method, headers: Array.from(headers.entries()), signal: deadline, redirect: "manual", dispatcher,
      });
      const location = response.headers.get("location");
      if (!location || ![301, 302, 303, 307, 308].includes(response.status)) return { response, url };
      await response.body?.cancel();
      const next = destination(new URL(location, url));
      if (url.origin !== next.origin) {
        for (const name of ["authorization", "cookie", "origin", "referer"]) headers.delete(name);
      }
      url = next;
    }
    throw new Error("Too many media redirects.");
  } finally { clearTimeout(timer); }
}
