import { create } from "zustand";
import type { ProviderPost } from "./posts";

/**
 * The provider post the remote is on, for the Provider Based TV home hero.
 * Separate from the Movie layout's focusStore (TMDB items), which is unchanged.
 */
export const usePostFocusStore = create<{
  focused: (ProviderPost & { catalogTitle?: string }) | null;
  setFocused: (post: (ProviderPost & { catalogTitle?: string }) | null) => void;
}>((set) => ({
  focused: null,
  setFocused: (post) => set({ focused: post }),
}));
