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

export function providerNetwork(signal: AbortSignal) {
  const jar = new CookieJar();
  let requests = 0;
  const request = async (input: string | URL, options?: RequestInit): Promise<Response> => {
    let url = destination(input);
    let method = (options?.method || "GET").toUpperCase();
    let body = options?.body;
    const headers = new Headers(options?.headers);
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
      if (location && [301, 302, 303, 307, 308].includes(res.status)) {
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

  const http = axios.create({
    adapter: async (config) => {
      const res = await request(axios.getUri(config), {
        method: config.method,
        headers: Object.entries(config.headers.toJSON(true)).map(([key, value]) => [key, String(value)]),
        body: config.data,
      });
      const response = {
        data: config.responseType === "arraybuffer" ? await res.arrayBuffer() : await res.text(),
        status: res.status, statusText: res.statusText,
        headers: AxiosHeaders.from(Object.fromEntries(res.headers)), config,
        request: { responseURL: res.url },
      };
      if (config.validateStatus && !config.validateStatus(res.status)) {
        throw new AxiosError("Upstream request failed.", AxiosError.ERR_BAD_RESPONSE, config, response.request, response);
      }
      return response;
    },
  });

  return { request, http };
}
