const waiting: (() => void)[] = [];
const limit = 4;
let active = 0;

export function queueProviderRequest<T>(signal: AbortSignal, run: () => Promise<T>) {
  return new Promise<T>((resolve, reject) => {
    signal.throwIfAborted();
    const start = () => {
      active++;
      signal.removeEventListener("abort", cancel);
      void Promise.resolve().then(() => {
        signal.throwIfAborted();
        return run();
      }).then(resolve, reject).finally(() => {
        active--;
        waiting.shift()?.();
      });
    };
    function cancel() {
      const index = waiting.indexOf(start);
      if (index >= 0) waiting.splice(index, 1);
      reject(signal.reason);
    }
    if (active < limit) start();
    else {
      waiting.push(start);
      signal.addEventListener("abort", cancel, { once: true });
    }
  });
}
