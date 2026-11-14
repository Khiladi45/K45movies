"use client";

import { Film, Puzzle } from "lucide-react";
import { useAppearance } from "@/lib/appearance";

const layouts = [
  { value: "provider", label: "Provider Based", description: "Browse the active provider catalog.", icon: Puzzle },
  { value: "movie", label: "Movie Based", description: "Discover titles with TMDB and find sources from your providers.", icon: Film },
] as const;

export function LayoutChoice() {
  const layout = useAppearance((state) => state.layout);
  const setLayout = useAppearance((state) => state.setLayout);

  return (
    <fieldset className="max-w-2xl">
      <legend className="mb-4 text-xl font-semibold">Choose Layout</legend>
      <div className="grid gap-3 sm:grid-cols-2">
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
