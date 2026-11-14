"use client";

import { usePlayerPreferences, type CaptionStyle } from "@/lib/player-preferences";
import type { CSSProperties } from "react";

export function textStyle(style: CaptionStyle): CSSProperties {
  return {
    color: style.color, backgroundColor: style.background + Math.round(style.opacity * 2.55).toString(16).padStart(2, "0"),
    fontSize: style.size, fontWeight: style.weight, fontFamily: style.font,
    textShadow: style.shadow ? ("0 1px " + style.shadow + "px #000, 0 0 " + style.shadow + "px #000") : undefined,
  };
}

export function CaptionSettings() {
  const style = usePlayerPreferences((state) => state.captions);
  const patch = usePlayerPreferences((state) => state.patch);
  const reset = usePlayerPreferences((state) => state.reset);
  function range(label: string, key: "size" | "opacity" | "bottom" | "delay", min: number, max: number, step = 1) {
    return <label className="grid gap-1 text-sm">{label} <output>{style[key]}</output>
      <input type="range" aria-label={label} className="accent-accent" min={min} max={max} step={step} value={style[key]}
        onChange={(event) => patch({ [key]: Number(event.target.value) })} />
    </label>;
  }
  return <div className="grid gap-3">
    <div className="rounded-lg bg-black p-3" style={{ textAlign: style.align }}>
      <span style={textStyle(style)}>Subtitle preview</span>
    </div>
    {range("Text size (px)", "size", 12, 42)}
    {range("Background opacity (%)", "opacity", 0, 100)}
    {range("Bottom offset (px)", "bottom", 0, 120)}
    {range("Delay (seconds)", "delay", -10, 10, 0.1)}
    <div className="flex flex-wrap gap-4 text-sm">
      <label className="grid gap-1">Text color <input type="color" value={style.color} onChange={(event) => patch({ color: event.target.value })} /></label>
      <label className="grid gap-1">Background <input type="color" value={style.background} onChange={(event) => patch({ background: event.target.value })} /></label>
    </div>
    <label className="grid gap-1 text-sm">Font
      <select className="field" value={style.font} onChange={(event) => patch({ font: event.target.value as CaptionStyle["font"] })}>
        <option value="sans-serif">System</option><option value="serif">Serif</option><option value="monospace">Monospace</option>
      </select>
    </label>
    <label className="grid gap-1 text-sm">Weight
      <select className="field" value={style.weight} onChange={(event) => patch({ weight: Number(event.target.value) })}>
        <option value={400}>Regular</option><option value={600}>Semibold</option><option value={700}>Bold</option>
      </select>
    </label>
    <label className="grid gap-1 text-sm">Alignment
      <select className="field" value={style.align} onChange={(event) => patch({ align: event.target.value as CaptionStyle["align"] })}>
        <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
      </select>
    </label>
    <label className="grid gap-1 text-sm">Outline and shadow
      <select className="field" value={style.shadow} onChange={(event) => patch({ shadow: Number(event.target.value) as CaptionStyle["shadow"] })}>
        <option value={0}>Off</option><option value={2}>Soft</option><option value={4}>Strong</option>
      </select>
    </label>
    <button className="secondary-button justify-self-start" type="button" onClick={reset}>Reset subtitle style</button>
  </div>;
}
