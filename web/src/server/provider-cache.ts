import "server-only";

type Entry = { promise: Promise<unknown>; controller: AbortController; waiters: number; expires?: number };
const cache = new Map<string, Entry>();
const maxEntries = 512;

export async function providerResult<T>(key: string, ttl: number, signal: AbortSignal, load: (signal: AbortSignal) => Promise<T>) {
  signal.throwIfAborted();
  let entry = cache.get(key);
  if (!entry || (entry.expires !== undefined && entry.expires <= Date.now())) {
    cache.delete(key);
    if (cache.size >= maxEntries) {
      const settled = [...cache].find(([, candidate]) => candidate.expires !== undefined);
      if (settled) cache.delete(settled[0]);
    }
    if (cache.size >= maxEntries) return load(signal);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new DOMException("Provider cache load timed out.", "TimeoutError")), 85_000);
    timer.unref();
    const task = Promise.resolve().then(() => {
      controller.signal.throwIfAborted();
      return load(controller.signal);
    }).finally(() => clearTimeout(timer));
    const pending: Entry = { promise: task, controller, waiters: 0 };
    cache.set(key, pending);
    const remove = () => { if (cache.get(key) === pending) cache.delete(key); };
    void task.then((value) => {
      if (Array.isArray(value) && !value.length) remove();
      else pending.expires = Date.now() + ttl;
    }, remove);
    entry = pending;
  }

  entry.waiters++;
  let abort: (() => void) | undefined;
  try {
    return await Promise.race([
      entry.promise as Promise<T>,
      new Promise<never>((_, reject) => {
        abort = () => reject(signal.reason);
        signal.addEventListener("abort", abort, { once: true });
        if (signal.aborted) abort();
      }),
    ]);
  } finally {
    if (abort) signal.removeEventListener("abort", abort);
    entry.waiters--;
    if (signal.aborted && entry.waiters === 0 && entry.expires === undefined) {
      if (cache.get(key) === entry) cache.delete(key);
      entry.controller.abort();
    }
  }
}
