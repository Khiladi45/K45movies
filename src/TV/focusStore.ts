import { create } from "zustand";
import type { TmdbItem } from "@/lib/tmdbApi";

/**
 * The title the remote is currently on, for the hero area at the top of the
 * TV home screen. Kept outside the rows so moving focus re-renders only the
 * hero, not every poster.
 */
export const useTvFocusStore = create<{
  focused: TmdbItem | null;
  setFocused: (item: TmdbItem | null) => void;
}>((set) => ({
  focused: null,
  setFocused: (item) => set({ focused: item }),
}));
