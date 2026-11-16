"use client";

import Link from "next/link";
import { Info, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Artwork, type Card } from "./catalog-ui";

export type HomeFeature = Card & { backdrop?: string; meta?: string[]; synopsis?: string };
const interval = 7000;

function useArtworkAccent(src?: string) {
  const [sample, setSample] = useState<{ src: string; color: string }>();
  useEffect(() => {
    if (!src) return;
    let active = true;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      if (!active) return;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 24; canvas.height = 16;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) return;
        context.drawImage(image, 0, 0, 24, 16);
        const pixels = context.getImageData(0, 0, 24, 16).data;
        const buckets = new Map<string, { weight: number; colors: number[] }>();
        for (let i = 0; i < pixels.length; i += 4) {
          const colors = [pixels[i], pixels[i + 1], pixels[i + 2]];
          const bright = Math.max(...colors);
          const chroma = bright - Math.min(...colors);
          if (bright < 48 || chroma < 24) continue;
          const key = colors.map((value) => value >> 5).join(",");
          const weight = (buckets.get(key)?.weight ?? 0) + chroma;
          buckets.set(key, { weight, colors });
        }
        const winner = [...buckets.values()].sort((a, b) => b.weight - a.weight)[0];
        if (winner) setSample({ src, color: "rgb(" + winner.colors.join(" ") + ")" });
      } catch { /* Some artwork hosts disallow reading pixels. */ }
    };
    image.src = src.replace(/(image\.tmdb\.org\/t\/p\/)w\d+\//, "$1w300/");
    return () => { active = false; image.onload = null; };
  }, [src]);
  return sample?.src === src ? sample?.color : undefined;
}

export function HomeHeroSkeleton() {
  return <section className="catalog-hero home-hero home-shimmer" aria-hidden="true">
    <div className="home-hero-copy"><div className="home-title-placeholder" /><div className="home-meta-placeholder" /><div className="home-buttons-placeholder" /></div>
  </section>;
}

export function HomeHero({ items }: { items: HomeFeature[] }) {
  const slides = items.slice(0, 6);
  const [chosen, select] = useState(0);
  const [previous, setPrevious] = useState(-1);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [paused, setPaused] = useState(false);
  const [active, setActive] = useState(false);
  const [reduced, setReduced] = useState(false);
  const section = useRef<HTMLElement>(null);
  const index = chosen % Math.max(1, slides.length);
  const item = slides[index];
  const hasItem = !!item;
  const tint = useArtworkAccent(item?.backdrop ?? item?.image);

  useEffect(() => {
    const node = section.current;
    if (!node) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    let scrolling = false;
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      setReduced(preference.matches);
      setActive(visible && !document.hidden && !scrolling && !preference.matches);
    };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.intersectionRatio >= 0.35; update(); }, { threshold: 0.35 });
    const scroll = () => {
      if (!scrolling) { scrolling = true; update(); }
      clearTimeout(timer);
      timer = setTimeout(() => { scrolling = false; update(); }, 250);
    };
    observer.observe(node);
    preference.addEventListener("change", update);
    window.addEventListener("scroll", scroll, { passive: true });
    document.addEventListener("visibilitychange", update);
    update();
    return () => {
      clearTimeout(timer);
      observer.disconnect();
      preference.removeEventListener("change", update);
      window.removeEventListener("scroll", scroll);
      document.removeEventListener("visibilitychange", update);
    };
  }, [hasItem]);

  useEffect(() => {
    if (!active || paused || hovered || focused || slides.length < 2) return;
    const timer = setTimeout(() => { setPrevious(index); select((index + 1) % slides.length); }, interval);
    return () => clearTimeout(timer);
  }, [active, focused, hovered, index, paused, slides.length]);

  if (!item) return <HomeHeroSkeleton />;
  return <section ref={section} className="catalog-hero home-hero" aria-label="Featured titles"
    style={tint ? { "--hero-tint": tint } as CSSProperties : undefined}
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
    <div className="home-hero-frames" aria-hidden="true">
      {slides.map(({ href, backdrop, image }, i) => <div key={href} className="home-hero-frame" data-active={i === index}>
        {(i === index || i === previous || i === (index + 1) % slides.length) &&
          <Artwork src={backdrop ?? image} className="home-hero-art" priority={i === index && previous === -1} backdrop />}
      </div>)}
    </div>
    <div className="home-hero-scrim" aria-hidden="true" />
    <div className="home-hero-copy">
      <div key={item.href} className="home-hero-content">
        <h2>{item.title}</h2>
        {!!item.meta?.length && <p className="home-hero-meta">{item.meta.join(" · ")}</p>}
        {item.synopsis && <p className="home-hero-synopsis">{item.synopsis}</p>}
        <div className="home-hero-actions">
          <Link className="primary-button home-play" href={item.href + "#play"}><Play size={18} fill="currentColor" aria-hidden="true" />Play</Link>
          <Link className="secondary-button home-info" href={item.href}><Info size={17} aria-hidden="true" />More Info</Link>
        </div>
      </div>
      {slides.length > 1 && <div className="home-hero-controls" role="group" aria-label="Featured slides">
        {slides.map((slide, i) => <button key={slide.href} type="button" className="home-dot"
          aria-label={"Show featured title " + (i + 1) + ": " + slide.title} aria-current={i === index ? "true" : undefined}
          onClick={() => { setPrevious(index); select(i); }}><span /></button>)}
        {!reduced && <button className="home-rotation" type="button" onClick={() => setPaused(!paused)}
          aria-label={paused ? "Resume featured rotation" : "Pause featured rotation"}>
          {paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
        </button>}
      </div>}
    </div>
  </section>;
}
