"use client";

import { Film, Play, Puzzle } from "lucide-react";
import { useAppearance } from "@/lib/appearance";

const layouts = [
  { value: "provider", label: "Provider Based", description: "Browse the active provider catalog.", icon: Puzzle },
  { value: "movie", label: "Movie Based", description: "Discover titles with TMDB and find sources from your providers.", icon: Film },
  { value: "youtube", label: "YouTube", description: "Browse videos and play them in the YouTube player.", icon: Play },
] as const;

export function LayoutChoice() {
  const layout = useAppearance((state) => state.layout);
  const setLayout = useAppearance((state) => state.setLayout);

  return (
    <fieldset className="min-w-0">
      <legend className="mb-4 text-xl font-semibold">Choose Layout</legend>
      <div className="grid gap-3 md:grid-cols-3">
        {layouts.map(({ value, label, description, icon: Icon }) => (
          <label key={value} className="layout-option">
            <input type="radio" name="catalog-layout" value={value} checked={layout === value}
              onChange={() => setLayout(value)} />
            <Icon size={21} aria-hidden="true" />
            <span>
              <span className="block font-semibold">{label}</span>
              <span className="mt-1 block text-sm text-muted">{description}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function BrowseModes() {
  const layout = useAppearance((state) => state.layout);
  const setLayout = useAppearance((state) => state.setLayout);
  return <div className="browse-modes" role="group" aria-label="Browse layout">
    {layouts.map(({ value, label, icon: Icon }) => <button type="button" key={value} aria-pressed={value === layout} onClick={() => setLayout(value)}>
      <Icon size={16} aria-hidden="true" />{label}
    </button>)}
  </div>;
}
