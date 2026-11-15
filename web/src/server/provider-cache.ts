import "server-only";

type Entry = { promise: Promise<unknown>; expires?: number };
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

    // A disconnected caller can stop waiting without killing another caller's
    // request. The shared work remains bounded by the provider's normal limits.
    const task = load(AbortSignal.timeout(40_000));
    const pending: Entry = { promise: task };
    cache.set(key, pending);
    const remove = () => { if (cache.get(key) === pending) cache.delete(key); };
    void task.then((value) => {
      if (Array.isArray(value) && !value.length) remove();
      else pending.expires = Date.now() + ttl;
    }, remove);
    entry = pending;
  }

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
  }
}
