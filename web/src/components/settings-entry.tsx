"use client";

import Link from "next/link";
import { AUDIO_LANGUAGE_OPTIONS } from "@/lib/languages";
import { useAppearance } from "@/lib/appearance";
import { useLibrary, type AudioLanguage } from "@/lib/library";
import { LayoutChoice } from "./layout-choice";
import { LocalProfiles } from "./local-profiles";

export function SettingsEntry() {
  const layout = useAppearance((state) => state.layout);
  const language = useLibrary((state) => state.language);
  const setLanguage = useLibrary((state) => state.setLanguage);
  return <div className="space-y-8">
    <LayoutChoice />
    {layout === "movie" && <label className="grid w-fit gap-2 text-sm font-medium">Preferred audio language
      <select className="field" value={language} onChange={(event) => setLanguage(event.target.value as AudioLanguage)}>
        {AUDIO_LANGUAGE_OPTIONS.map(({ label, value }) => <option value={value} key={value}>{label}</option>)}
      </select>
    </label>}
    <LocalProfiles />
    <section className="max-w-2xl">
      <h2 className="mb-3 text-xl font-semibold">Catalog and library</h2>
      <div className="flex flex-wrap gap-2">
        <Link className="secondary-button" href="/providers">Manage providers</Link>
        <Link className="secondary-button" href="/watchlist">Watchlist</Link>
      </div>
    </section>
  </div>;
}
