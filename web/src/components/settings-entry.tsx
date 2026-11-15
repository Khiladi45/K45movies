"use client";

import Link from "next/link";
import { Activity, Bookmark, ChevronRight, Palette, Puzzle, SlidersHorizontal } from "lucide-react";
import { AUDIO_LANGUAGE_OPTIONS } from "@/lib/languages";
import { useAppearance } from "@/lib/appearance";
import { useLibrary, type AudioLanguage } from "@/lib/library";
import { LayoutChoice } from "./layout-choice";
import { LocalProfiles } from "./local-profiles";

const destinations = [
  { title: "Appearance", href: "/settings/appearance", icon: Palette },
  { title: "Playback preferences", href: "/settings/preferences", icon: SlidersHorizontal },
  { title: "Provider diagnostics", href: "/settings/providers/diagnostics", icon: Activity },
  { title: "Manage providers", href: "/providers", icon: Puzzle },
  { title: "Watchlist", href: "/watchlist", icon: Bookmark },
];

export function SettingsEntry() {
  const layout = useAppearance((state) => state.layout);
  const language = useLibrary((state) => state.language);
  const setLanguage = useLibrary((state) => state.setLanguage);
  return <div className="grid gap-5">
    <section className="settings-group" aria-label="Catalog layout">
      <LayoutChoice />
      {layout === "movie" && <label className="mt-5 grid w-fit max-w-full gap-2 text-sm font-medium">Preferred audio language
        <select className="field" value={language} onChange={(event) => setLanguage(event.target.value as AudioLanguage)}>
          {AUDIO_LANGUAGE_OPTIONS.map(({ label, value }) => <option value={value} key={value}>{label}</option>)}
        </select>
      </label>}
    </section>
    <div className="settings-grid">
      <div className="settings-group"><LocalProfiles /></div>
      <section className="settings-group">
        <h2 className="mb-4 text-xl font-semibold">Catalog and library</h2>
        <ul className="grid gap-2">
          {destinations.map(({ title, href, icon: Icon }) => <li key={href}>
            <Link className="settings-link" href={href}>
              <Icon size={18} aria-hidden="true" className="text-accent" />
              <span className="min-w-0 flex-1">{title}</span>
              <ChevronRight size={16} aria-hidden="true" className="text-muted" />
            </Link>
          </li>)}
        </ul>
      </section>
    </div>
  </div>;
}
