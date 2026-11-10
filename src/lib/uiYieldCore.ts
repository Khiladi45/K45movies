// Plain helpers with no react-native import (usable from provider runtime
// code that is bundled and tested outside React Native).

/** Lets pending renders, touches and animation frames run first. */
export const yieldToUI = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Collects state updates and applies them together at most every
 * `intervalMs`, so many providers answering at once cause a few renders
 * instead of one per answer.
 */
export function createBatcher<T>(apply: (items: T[]) => void, intervalMs = 180) {
  let queue: T[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    timer = null;
    const items = queue;
    queue = [];
    if (items.length) apply(items);
  };
  return {
    push(item: T) {
      queue.push(item);
      if (!timer) timer = setTimeout(flush, intervalMs);
    },
    flush() {
      if (timer) clearTimeout(timer);
      flush();
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = null;
      queue = [];
    },
  };
}
