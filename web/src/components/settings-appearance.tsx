"use client";

import { Check } from "lucide-react";
import { accents, defaultAccent } from "@/lib/accents";
import { useAppearance } from "@/lib/appearance";

export function SettingsAppearance() {
  const accent = useAppearance((state) => state.accent);
  const setAccent = useAppearance((state) => state.setAccent);
  return <div className="max-w-3xl space-y-7">
    <p className="text-sm text-muted">Dark theme</p>
    {accents.map(({ group, colors }) => <fieldset key={group}>
      <legend className="mb-3 text-xl font-semibold">{group}</legend>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        {colors.map(([label, hex]) => <label key={hex}
          className="relative grid cursor-pointer gap-3 rounded-xl border border-line bg-surface p-3 hover:border-accent focus-within:outline-2 focus-within:outline-accent has-checked:border-accent">
          <input type="radio" className="sr-only" name="accent" value={hex} checked={accent === hex} onChange={() => setAccent(hex)} />
          <span className="grid h-10 place-items-center rounded-lg" style={{ backgroundColor: hex }}>
            {accent === hex && <span className="rounded-full bg-black/80 p-1 text-white"><Check size={16} aria-hidden="true" /></span>}
          </span>
          <span className="text-sm font-semibold">{label}</span>
        </label>)}
      </div>
    </fieldset>)}
    <button className="secondary-button" type="button" onClick={() => setAccent(defaultAccent)}>Reset accent</button>
  </div>;
}
