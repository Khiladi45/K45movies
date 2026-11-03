import { create } from "zustand";
import type { SourceOption } from "@/lib/titleBridge";
import type { PlayTarget } from "@/lib/tmdbPlayback";
import { usePlayerStore } from "@/store/usePlayerStore";

// In-memory "stream queue" for the Movie Based layout: every provider row that
// was known when playback started, in the order the list showed them. The
// player walks it when a stream fails and lists it in the Sources panel.
// Not persisted: it only lives as long as the player session.

type QueueState = {
  options: SourceOption[];
  providerNames: Record<string, string>;
  target: PlayTarget | null;
  currentId: string | null;
  failed: string[];
  // Providers that had not answered yet when playback started.
  unchecked: number;
  setQueue: (input: {
    options: SourceOption[];
    providerNames: Record<string, string>;
    target: PlayTarget;
    currentId: string;
    unchecked?: number;
  }) => void;
  setCurrent: (id: string) => void;
  markFailed: (id: string) => void;
  clear: () => void;
};

export const useSourceQueueStore = create<QueueState>()((set) => ({
  options: [],
  providerNames: {},
  target: null,
  currentId: null,
  failed: [],
  unchecked: 0,
  setQueue: ({ options, providerNames, target, currentId, unchecked = 0 }) =>
    set({ options, providerNames, target, currentId, failed: [], unchecked }),
  setCurrent: (id) => set({ currentId: id }),
  markFailed: (id) =>
    set((state) =>
      state.failed.includes(id) ? state : { failed: [...state.failed, id] },
    ),
  clear: () =>
    set({
      options: [],
      providerNames: {},
      target: null,
      currentId: null,
      failed: [],
      unchecked: 0,
    }),
}));

/** Next row that has not failed and is not the one playing. */
export function nextQueueOption(): SourceOption | undefined {
  const { options, currentId, failed } = useSourceQueueStore.getState();
  const start = Math.max(0, options.findIndex((o) => o.id === currentId));
  const ordered = [...options.slice(start + 1), ...options.slice(0, start)];
  return ordered.find((o) => o.id !== currentId && !failed.includes(o.id));
}

// The queue only lives while a player session exists.
usePlayerStore.subscribe((state, previous) => {
  if (previous.currentVideoUrl && !state.currentVideoUrl) {
    useSourceQueueStore.getState().clear();
  }
});
