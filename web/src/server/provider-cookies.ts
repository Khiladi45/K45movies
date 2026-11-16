import "server-only";
import { CookieJar } from "tough-cookie";
import { providerStore } from "./provider-store";

const sessions = new Map<string, { ready: Promise<ReturnType<typeof cookieSession>>; expires: number }>();
const sessionLifetime = 24 * 60 * 60_000;

function cookieSession(jar: CookieJar, save?: (jar: ReturnType<CookieJar["serializeSync"]>) => Promise<void>) {
  let dirty = false;
  let writing = false;
  async function flush() {
    if (!save || writing) return;
    writing = true;
    try {
      while (dirty) {
        dirty = false;
        const state = jar.serializeSync();
        if (state && JSON.stringify(state).length <= 65_536) await save(state);
      }
    } catch { /* The process-local jar can still serve this provider. */ }
    finally { writing = false; }
  }
  return {
    header: (url: string) => jar.getCookieStringSync(url),
    receive(url: string, cookies: string[]) {
      for (const cookie of cookies) {
        if (cookie.length > 4096) continue;
        if (jar.setCookieSync(cookie, url, { ignoreError: true })) dirty = true;
      }
      if (dirty) {
        const existing = jar.serializeSync()?.cookies ?? [];
        const storage = jar.store;
        for (const cookie of existing.slice(0, Math.max(0, existing.length - 128))) {
          if (typeof cookie.domain === "string" && typeof cookie.path === "string" && typeof cookie.key === "string") {
            storage.removeCookie(cookie.domain, cookie.path, cookie.key, () => undefined);
          }
        }
        void flush();
      }
    },
  };
}

export function providerCookieSession(provider?: string) {
  if (!provider) return Promise.resolve(cookieSession(new CookieJar()));
  const existing = sessions.get(provider);
  if (existing && existing.expires > Date.now()) return existing.ready;
  if (sessions.size >= 128) {
    const oldest = [...sessions.entries()].sort((a, b) => a[1].expires - b[1].expires)[0]?.[0];
    if (oldest !== undefined) sessions.delete(oldest);
  }
  const store = providerStore(provider, "network");
  const ready = store.get("cookies").then((value) => value ? CookieJar.deserializeSync(value) : new CookieJar())
    .catch(() => new CookieJar()).then((jar) => cookieSession(jar, (value) => store.set("cookies", value)));
  sessions.set(provider, { ready, expires: Date.now() + sessionLifetime });
  return ready;
}
