import "server-only";
import { lookup } from "node:dns";
import { Agent, fetch as upstreamFetch } from "undici";
import ipaddr from "ipaddr.js";
import axios, { AxiosError, AxiosHeaders } from "axios";
import { secureDnsAnswers } from "./provider-dns";
import { providerCookieSession } from "./provider-cookies";

function publicAddress(address: string) {
  return ipaddr.process(address).range() === "unicast";
}

export function publicDnsAnswers(addresses: { address: string; family: number }[]) {
  return addresses.length > 0 && addresses.every(({ address }) => ipaddr.isValid(address) && publicAddress(address));
}

// The lookup callback supplies the resolved addresses directly to the socket.
const dispatcher = new Agent({
  connect: {
    timeout: 30_000,
    lookup(hostname, options, callback) {
      const connect = (addresses: { address: string; family: number }[]) => {
        if (!publicDnsAnswers(addresses)) {
          return callback(new Error("Provider network destination is unavailable."), "", 0);
        }
        const matching = addresses.filter(({ family }) => !options.family || options.family === family);
        if (!matching.length) return callback(new Error("The requested DNS address family is unavailable."), "", 0);
        if (options.all) return callback(null, matching);
        return callback(null, matching[0].address, matching[0].family);
      };
      const system = () => lookup(hostname, { ...options, all: true }, (error, addresses) => {
        if (error) return callback(error, "", 0);
        connect(process.env.K45_DOH === "1" ? addresses.sort((a, b) => a.family - b.family) : addresses);
      });
      if (process.env.K45_DOH !== "1" || hostname === "localhost" || !hostname.includes(".")) return system();
      void secureDnsAnswers(hostname).then((addresses) => addresses ? connect(addresses) : system(),
        (error: Error) => callback(error, "", 0));
    },
  },
});

export function providerDestination(input: string | URL) {
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

export function providerNetwork(signal: AbortSignal, defaultHeaders?: HeadersInit, onIssue?: (issue: NetworkIssue) => void, provider?: string) {
  let session: ReturnType<typeof providerCookieSession> | undefined;
  let requests = 0;
  const networkRequest = async (input: string | URL, options?: RequestInit, maxRedirects = 5): Promise<Response> => {
    let url = providerDestination(input);
    let method = (options?.method || "GET").toUpperCase();
    let body = options?.body;
    const headers = new Headers(defaultHeaders);
    new Headers(options?.headers).forEach((value, key) => headers.set(key, value));
    for (const name of ["host", "connection", "content-length", "proxy-authorization", "transfer-encoding"]) headers.delete(name);
    const deadline = AbortSignal.any([signal, AbortSignal.timeout(30_000), ...(options?.signal ? [options.signal] : [])]);
    const jar = options?.credentials === "omit" ? undefined : await (session ??= providerCookieSession(provider));

    for (let redirect = 0; redirect <= 5; redirect++) {
      if (++requests > 70) throw new Error("Provider request budget exceeded.");
      const outgoing = new Headers(headers);
      const cookies = jar?.header(url.href);
      if (cookies && !outgoing.has("cookie")) outgoing.set("cookie", cookies);
      const res = await upstreamFetch(url, {
        method, body: body as string | undefined, headers: Array.from(outgoing.entries()),
        signal: deadline, redirect: "manual", dispatcher,
      });
      jar?.receive(url.href, res.headers.getSetCookie());
      const location = res.headers.get("location");
      if (location && options?.redirect !== "manual" && [301, 302, 303, 307, 308].includes(res.status)) {
        if (options?.redirect === "error" || redirect === maxRedirects) {
          await res.body?.cancel();
          throw new Error("Upstream redirect limit reached.");
        }
        await res.body?.cancel();
        const next = providerDestination(new URL(location, url));
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
        headers: Object.entries(config.headers.toJSON(true)).map(([key, value]): [string, string] => [key, String(value)]),
        body: config.data,
        signal: signals.length ? AbortSignal.any(signals) : undefined,
        credentials: config.withCredentials === false ? "omit" : "include",
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
  let url = providerDestination(value);
  const connect = new AbortController();
  const timer = setTimeout(() => connect.abort(new DOMException("Media connection timed out.", "TimeoutError")), 30_000);
  try {
    const deadline = AbortSignal.any([signal, connect.signal]);
    for (let index = 0; index <= 5; index++) {
      const response = await upstreamFetch(url, {
        method, headers: Array.from(headers.entries()), signal: deadline, redirect: "manual", dispatcher,
      });
      const location = response.headers.get("location");
      if (!location || ![301, 302, 303, 307, 308].includes(response.status)) return { response, url };
      await response.body?.cancel();
      const next = providerDestination(new URL(location, url));
      if (url.origin !== next.origin) {
        for (const name of ["authorization", "cookie", "origin", "referer"]) headers.delete(name);
      }
      url = next;
    }
    throw new Error("Too many media redirects.");
  } finally { clearTimeout(timer); }
}
