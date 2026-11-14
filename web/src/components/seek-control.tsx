"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";

export function formatTime(time: number) {
  const t = Math.floor(Number.isFinite(time) ? Math.max(0, time) : 0);
  const h = Math.floor(t / 3600);
  return (h ? h + ":" : "") + String(Math.floor(t / 60) % 60).padStart(h ? 2 : 1, "0") + ":" + String(t % 60).padStart(2, "0");
}

export function SeekControl({ position, duration, buffered, seek, source, locked }: {
  position: number; duration: number; buffered: number; seek: (time: number) => void; source?: string; locked: boolean;
}) {
  const [preview, setPreview] = useState<{ time: number; ratio: number }>();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [image, showImage] = useState(false);
  const time = preview?.time;

  useEffect(() => {
    if (!source || time === undefined) return;
    let thumbnail: HTMLVideoElement | undefined;
    const timer = window.setTimeout(() => {
      thumbnail = document.createElement("video");
      thumbnail.preload = "metadata";
      thumbnail.muted = true;
      thumbnail.onloadedmetadata = () => { if (thumbnail) thumbnail.currentTime = Math.min(time, thumbnail.duration - 0.05); };
      thumbnail.onseeked = () => {
        if (!thumbnail || !canvas.current) return;
        const context = canvas.current.getContext("2d");
        if (!context || !thumbnail.videoWidth) return;
        context.drawImage(thumbnail, 0, 0, 128, 72);
        showImage(true);
      };
      thumbnail.src = source;
    }, 450);
    return () => {
      clearTimeout(timer);
      if (!thumbnail) return;
      thumbnail.onloadedmetadata = thumbnail.onseeked = null;
      thumbnail.removeAttribute("src");
      thumbnail.load();
    };
  }, [source, time]);

  function hover(event: PointerEvent<HTMLInputElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    showImage(false);
    setPreview({ ratio, time: duration * ratio });
  }

  return <div className="relative flex-1">
    {!locked && preview && <div className="seek-preview" style={{ left: "clamp(4rem, " + preview.ratio * 100 + "%, calc(100% - 4rem))" }}>
      <canvas ref={canvas} width={128} height={72} hidden={!image} />
      <span>{formatTime(preview.time)}</span>
    </div>}
    <progress className="player-buffer" aria-hidden="true" value={Math.min(buffered, duration)} max={duration || 1} />
    <input className="relative w-full accent-accent" type="range" min={0} max={duration || 1} step={0.1} value={Math.min(position, duration)}
      aria-label="Seek" aria-valuetext={formatTime(position)} disabled={!duration || locked}
      onChange={(event) => seek(Number(event.target.value))} onPointerMove={hover}
      onPointerLeave={() => { setPreview(undefined); showImage(false); }} />
  </div>;
}
