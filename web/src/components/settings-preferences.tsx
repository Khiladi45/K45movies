"use client";

import { useState } from "react";
import { usePlayerPreferences, type PlaybackPreferences } from "@/lib/player-preferences";
import { AUDIO_LANGUAGE_OPTIONS } from "@/lib/languages";
import { CaptionSettings } from "./player-caption-settings";

function Toggle({ label, checked, change, description }: {
  label: string; checked: boolean; change: (checked: boolean) => void; description?: string;
}) {
  return <label className="list-row justify-between">
    <span><span className="block font-medium">{label}</span>
      {description && <span className="block text-sm text-muted">{description}</span>}</span>
    <input className="size-5 shrink-0 accent-accent" type="checkbox" checked={checked} onChange={(event) => change(event.target.checked)} />
  </label>;
}

export function SettingsPreferences() {
  const prefs = usePlayerPreferences();
  const [status, setStatus] = useState("");
  return <div className="max-w-2xl space-y-7">
    <section aria-labelledby="playback-settings" className="grid gap-3">
      <h2 id="playback-settings" className="text-xl font-semibold">Playback</h2>
      <Toggle label="Resume playback" checked={prefs.resume} change={(value) => prefs.set("resume", value)} />
      <Toggle label="Background playback" description="Continue playing when you switch browser tabs."
        checked={prefs.background} change={(value) => prefs.set("background", value)} />
      <Toggle label="Autoplay next episode" checked={prefs.autoplay} change={(value) => prefs.set("autoplay", value)} />
      <Toggle label="Show remaining time" checked={prefs.showRemaining} change={(value) => prefs.set("showRemaining", value)} />
      <label className="list-row flex-wrap justify-between">
        <span className="font-medium">Default quality</span>
        <select className="field" value={prefs.defaultQuality} onChange={(event) => prefs.set("defaultQuality", event.target.value as PlaybackPreferences["defaultQuality"])}>
          <option value="auto">Auto</option><option value="highest">Highest</option><option value="lowest">Lowest</option>
        </select>
      </label>
      <label className="list-row flex-wrap justify-between">
        <span className="font-medium">Hide controls after</span>
        <select className="field" value={prefs.controlsTimeout} onChange={(event) => prefs.set("controlsTimeout", Number(event.target.value) as PlaybackPreferences["controlsTimeout"])}>
          <option value={3}>3 seconds</option><option value={5}>5 seconds</option><option value={10}>10 seconds</option>
        </select>
      </label>
    </section>
    <section aria-labelledby="subtitle-settings" className="grid gap-3">
      <h2 id="subtitle-settings" className="text-xl font-semibold">Subtitles</h2>
      <Toggle label="Default subtitles" description="Select a matching track when playback starts."
        checked={prefs.autoSubtitles} change={(value) => prefs.set("autoSubtitles", value)} />
      <label className="list-row flex-wrap justify-between">
        <span className="font-medium">Preferred subtitle language</span>
        <select className="field" value={prefs.subtitleLanguage} onChange={(event) => prefs.set("subtitleLanguage", event.target.value)}>
          <option value="auto">Auto</option>
          {AUDIO_LANGUAGE_OPTIONS.filter(({ value }) => value !== "none").map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <div className="rounded-xl border border-line bg-surface p-4"><CaptionSettings /></div>
    </section>
    <div className="flex flex-wrap items-center gap-3">
      <button className="secondary-button" type="button" onClick={() => { prefs.resetAll(); setStatus("Playback preferences reset."); }}>Reset all preferences</button>
      <span className="text-sm text-muted" role="status">{status}</span>
    </div>
  </div>;
}
