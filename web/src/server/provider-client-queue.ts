import "server-only";
import { ProviderError } from "./provider-errors";

type Waiter = { start: () => void };
type Queue = { running: number; pending: Waiter[] };
const clients = new Map<string, Queue>();
const maxActive = 3;
const maxPending = 32;

export async function enqueueProvider<T>(client: string, signal: AbortSignal, work: () => Promise<T>) {
  signal.throwIfAborted();
  let queue = clients.get(client);
  if (!queue) {
    if (clients.size >= 4096) throw new ProviderError(503, "Provider queue is busy.", "queue", undefined, "2");
    queue = { running: 0, pending: [] };
    clients.set(client, queue);
  }
  if (queue.running >= maxActive) await waitForSlot(queue, signal);
  else queue.running++;
  try {
    signal.throwIfAborted();
    return await work();
  } finally {
    const next = queue.pending.shift();
    if (next) next.start();
    else if (--queue.running === 0) clients.delete(client);
  }
}

function waitForSlot(queue: Queue, signal: AbortSignal) {
  if (queue.pending.length >= maxPending) throw new ProviderError(429, "Your provider queue has 32 waiting operations.", "queue", undefined, "2");
  return new Promise<void>((resolve, reject) => {
    const finish = () => {
      signal.removeEventListener("abort", cancel);
      clearTimeout(timer);
    };
    const remove = (reason: unknown) => {
      const index = queue.pending.indexOf(waiter);
      if (index !== -1) queue.pending.splice(index, 1);
      finish();
      reject(reason);
    };
    const cancel = () => remove(signal.reason);
    const waiter = { start: () => { finish(); resolve(); } };
    const timer = setTimeout(() => remove(new ProviderError(503, "Your provider operation waited 25 seconds for a slot.", "queue", undefined, "2")), 25_000);
    timer.unref();
    queue.pending.push(waiter);
    signal.addEventListener("abort", cancel, { once: true });
    if (signal.aborted) cancel();
  });
}
