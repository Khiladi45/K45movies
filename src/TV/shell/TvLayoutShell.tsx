import React, { type ComponentType } from "react";
import { useLayoutStore } from "@/store/useLayoutStore";
import ProviderShell from "./ProviderShell";
import YouTubeShell from "./YouTubeShell";

/**
 * Picks the TV shell for the chosen layout. Movie Based renders the existing
 * TvMain exactly as before (passed in from TvApp, not modified); the other
 * layouts get their own shells. Keyed on the layout, so switching always
 * starts fresh on Home with focus on the active rail item.
 */
export default function TvLayoutShell({ MovieShell }: { MovieShell: ComponentType }) {
  const layout = useLayoutStore((s) => s.layout);
  if (layout === "provider") return <ProviderShell key="provider" />;
  if (layout === "youtube") return <YouTubeShell key="youtube" />;
  return <MovieShell key="movie" />;
}
