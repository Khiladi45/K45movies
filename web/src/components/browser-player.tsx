"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { AudioLines, Captions, ChevronDown, Crop, Expand, ListVideo, Lock, Maximize, Minimize2, Pause, Play, Server, Settings2, SlidersHorizontal, SkipForward, Unlock, Volume2, VolumeX, X } from "lucide-react";
import { usePlayback, type PlaybackItem } from "@/lib/playback";
import { CatalogError } from "@/lib/catalog-api";
import type { SourceAttempt } from "@/lib/catalog-types";
import { usePlayerPreferences } from "@/lib/player-preferences";
import { useLibrary } from "@/lib/library";
import { attachMedia, emptyTracks, type MediaTracks } from "@/lib/media-engine";
import { episodeNumberOf, findNextEpisode } from "@/lib/episodes";
import { fallbackQualities, playbackSources, playerQualityOptions, switchQuality } from "@/lib/player-switch";
import { normalizeLangCode } from "@/lib/languages";
import { parseCues } from "@/lib/video-cues";
import { CaptionSettings, textStyle } from "./player-caption-settings";
import { formatTime, SeekControl } from "./seek-control";
import { SourceAttempts } from "./source-attempts";

type Session = NonNullable<ReturnType<typeof usePlayback.getState>["session"]>;
type Cue = ReturnType<typeof parseCues>[number];
type Panel = "episodes" | "settings" | "quality" | "servers" | "audio" | "framing" | null;
const savedTimestamp = Date.now;
const paintClock = performance.now.bind(performance);
const panelNames = { episodes: "Episodes", settings: "Playback settings", quality: "Quality", servers: "Servers", audio: "Audio tracks", framing: "Framing and zoom" };
const framingOptions = [
  { value: "fit", label: "Fit screen" }, { value: "fill", label: "Fill screen" },
  { value: "crop", label: "Crop to 16:9" }, { value: "actual", label: "Actual size (100%)" },
  { value: "stretch", label: "Stretch" },
] as const;
const zoomMin = 50;
const zoomMax = 400;

export function BrowserPlayer({ session }: { session: Session }) {
  const { target, sources } = session;
  const minimized = usePlayback((state) => state.minimized);
  const captionStyle = usePlayerPreferences((state) => state.captions);
  const preferences = usePlayerPreferences();
  const { autoplay, defaultQuality, controlsTimeout, showRemaining, background, autoSubtitles, subtitleLanguage } = preferences;
  const videoRef = useRef<HTMLVideoElement>(null);
  const frame = useRef<HTMLElement>(null);
  const captionsRef = useRef<HTMLSpanElement>(null);
  const preferredApplied = useRef(false);
  const qualityChosen = useRef(false);
  const captionChosen = useRef(false);
  const engine = useRef<ReturnType<typeof attachMedia>>(undefined);
  const positionRef = useRef(session.position);
  const savedAt = useRef(0);
  const lastPaint = useRef(0);
  const lastCue = useRef("");
  const changingMedia = useRef(false);
  const tried = useRef(new Set<number>());
  const failedQualities = useRef(new Set<number>());
  const launchFocus = useRef<HTMLElement | null>(null);
  const resumePlay = useRef(true);
  const retrying = useRef<AbortController>(null);
  const stalled = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [i, setIndex] = useState(session.index);
  const [revision, setRevision] = useState(0);
  const [play, setPlay] = useState(false);
  const [waiting, setWaiting] = useState(true);
  const [position, setPosition] = useState(session.position);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [tracks, setTracks] = useState<MediaTracks>(emptyTracks);
  const [quality, setQuality] = useState(-1);
  const [audio, setAudio] = useState(-1);
  const [captions, setCaptions] = useState("off");
  const [cueList, setCueList] = useState<Cue[]>([]);
  const [theater, setTheater] = useState(false);
  const pinch = useRef<{ distance: number; scale: number }>(null);
  const [zoom, setZoom] = useState(100);
  const [framing, setFraming] = useState<typeof framingOptions[number]["value"]>("fit");
  const [locked, setLocked] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [error, setError] = useState("");
  const [attempts, setAttempts] = useState<SourceAttempt[]>([]);
  const [note, setNote] = useState("");
  const [switching, setSwitching] = useState(false);
  const [awake, setAwake] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const source = sources[i] ?? sources[0];
  const next = target.item.series ? findNextEpisode(target.episodes, target.episodeNumber ?? episodeNumberOf(target.item), target.item.ref) : undefined;
  const qualities = playerQualityOptions(target);
  const externalTrack = captions.startsWith("file:") ? source.subtitles[Number(captions.slice(5))] : undefined;
  const controls = awake || !play || panel || locked || minimized;
  const video = () => videoRef.current;

  useEffect(() => {
    launchFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    frame.current?.focus();
    return () => { launchFocus.current?.focus(); };
  }, []);
  useEffect(() => () => {
    retrying.current?.abort();
    clearTimeout(hideTimer.current);
    clearTimeout(stalled.current);
  }, []);

  useEffect(() => {
    if (!externalTrack) return;
    const abort = new AbortController();
    void fetch(externalTrack.url, { signal: abort.signal }).then(async (response) => {
      if (!response.ok) throw new Error("Could not load subtitles.");
      const text = await response.text();
      if (!abort.signal.aborted) setCueList(parseCues(text));
    }).catch(() => { if (!abort.signal.aborted) setNote("Could not load subtitles."); });
    return () => abort.abort();
  }, [externalTrack]);

  useEffect(() => {
    if (background) return;
    function pauseHidden() {
      if (document.hidden) videoRef.current?.pause();
    }
    document.addEventListener("visibilitychange", pauseHidden);
    return () => document.removeEventListener("visibilitychange", pauseHidden);
  }, [background]);

  useEffect(() => {
    if (defaultQuality === "auto" || qualityChosen.current || !tracks.levels.length) return;
    const index = tracks.levels.reduce((best, candidate, i) => {
      const height = Number.parseInt(candidate.label);
      const current = Number.parseInt(tracks.levels[best].label);
      return (defaultQuality === "highest" ? height > current : height < current) ? i : best;
    }, 0);
    engine.current?.quality(index);
    const update = setTimeout(() => setQuality(index), 0);
    return () => clearTimeout(update);
  }, [defaultQuality, tracks.levels]);

  useEffect(() => {
    if (!autoSubtitles || captionChosen.current) return;
    const options = [
      ...source.subtitles.map((track, i) => ({ ...track, value: "file:" + i })),
      ...tracks.captions.map((track, i) => ({ ...track, value: "hls:" + i })),
    ];
    const preferred = options.find((track) => normalizeLangCode(track.language || track.label) === subtitleLanguage);
    const selected = preferred ?? options[0];
    if (!selected) return;
    const update = setTimeout(() => {
      if (captionChosen.current) return;
      setCaptions(selected.value);
      if (selected.value.startsWith("hls:")) engine.current?.captions(Number(selected.value.slice(4)));
    }, 0);
    return () => clearTimeout(update);
  }, [autoSubtitles, source.subtitles, subtitleLanguage, tracks.captions]);

  function wake() {
    setAwake(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setAwake(false), controlsTimeout * 1000);
  }

  function save() {
    const element = video();
    if (changingMedia.current || !element || !Number.isFinite(element.duration)) return;
    useLibrary.getState().saveProgress({
      ...target.title, position: element.currentTime, duration: element.duration,
      updatedAt: savedTimestamp(), playback: target, source: { server: source.server, quality: source.quality },
    });
  }

  useEffect(() => {
    const element = videoRef.current;
    const persist = () => {
      if (!changingMedia.current && element && Number.isFinite(element.duration)) {
        useLibrary.getState().saveProgress({
          ...target.title, position: element.currentTime, duration: element.duration,
          updatedAt: Date.now(), playback: target, source: { server: source.server, quality: source.quality },
        });
      }
    };
    window.addEventListener("pagehide", persist);
    return () => { window.removeEventListener("pagehide", persist); };
  }, [target, source]);

  function tick(force = false) {
    const element = video();
    if (!element) return;
    if (changingMedia.current) return;
    positionRef.current = element.currentTime;
    const now = paintClock();
    if (force || now - lastPaint.current >= 225) {
      lastPaint.current = now;
      setPosition(element.currentTime);
      const ranges = element.buffered;
      let bufferedEnd = element.currentTime;
      for (let index = 0; index < ranges.length; index++) {
        if (ranges.start(index) <= element.currentTime && element.currentTime <= ranges.end(index)) {
          bufferedEnd = ranges.end(index);
          break;
        }
      }
      setBuffered(bufferedEnd);
    }
    if (now - savedAt.current >= 5000) { savedAt.current = now; save(); }
    const time = element.currentTime - captionStyle.delay;
    const nativeText = captions.startsWith("hls:") ? (engine.current?.cues(Number(captions.slice(4))) ?? [])
      .filter((cue) => cue.startTime <= time && cue.endTime > time)
      .map((cue) => "text" in cue ? String(cue.text).replace(/<[^>]*>/g, "") : "").join("\n") : "";
    const text = externalTrack ? cueList.filter((cue) => cue.start <= time && cue.end > time).map((cue) => cue.text).join("\n") : nativeText;
    if (captionsRef.current && text !== lastCue.current) {
      captionsRef.current.textContent = text;
      captionsRef.current.hidden = !text;
      lastCue.current = text;
    }
  }

  function seek(time: number) {
    const element = video();
    if (!element || !Number.isFinite(element.duration)) return;
    element.currentTime = Math.max(0, Math.min(element.duration, time));
    tick(true);
  }

  function setCaption(value: string, manual = false) {
    captionChosen.current = manual;
    setCaptions(value);
    setCueList([]);
    lastCue.current = "";
    if (captionsRef.current) { captionsRef.current.textContent = ""; captionsRef.current.hidden = true; }
    engine.current?.captions(value.startsWith("hls:") ? Number(value.slice(4)) : -1);
  }

  function toggleCaptions() {
    if (captions !== "off") setCaption("off", true);
    else if (source.subtitles.length) setCaption("file:0", true);
    else if (tracks.captions.length) setCaption("hls:0", true);
    else setNote("No subtitle tracks are available.");
  }

  function toggle() {
    const element = video();
    if (!element) return;
    if (element.paused) startPlayback(element);
    else element.pause();
    wake();
  }

  function startPlayback(element: HTMLVideoElement) {
    const activeEngine = engine.current;
    void element.play().catch((failure: unknown) => {
      if (engine.current !== activeEngine) return;
      if (failure instanceof DOMException && failure.name === "AbortError") return;
      setWaiting(false);
      if (failure instanceof DOMException && failure.name === "NotAllowedError") {
        setNote("Autoplay was blocked. Press Play to start.");
      } else {
        activeEngine?.fail(undefined, failure instanceof Error ? failure.message : "Could not start playback.");
      }
    });
  }

  function updateVolume(value: number) {
    const element = video();
    if (!element) return;
    element.volume = Math.min(1, Math.max(0, value));
    setVolume(element.volume);
  }

  function toggleMute() {
    const element = video();
    if (!element) return;
    element.muted = !element.muted;
    setMuted(element.muted);
  }

  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await frame.current?.requestFullscreen();
    } catch { setNote("Fullscreen is unavailable."); }
  }

  function changeSource(index: number) {
    if (index === i) return;
    resumePlay.current = !video()?.paused;
    changingMedia.current = true;
    tried.current.clear();
    setAttempts([]);
    setWaiting(true);
    setDuration(0);
    setBuffered(0);
    setError("");
    setNote("");
    setTracks(emptyTracks);
    setAudio(-1);
    setQuality(-1);
    setCaption("off");
    setIndex(index);
  }

  async function resolve(item: PlaybackItem, options: { refresh?: boolean; qualityIndex?: number; fallback?: "format" | "network" } = {}) {
    retrying.current?.abort();
    const controller = new AbortController();
    retrying.current = controller;
    const qualitySwitch = options.qualityIndex !== undefined;
    const resume = options.refresh || qualitySwitch ? positionRef.current : 0;
    const shouldPlay = options.refresh || !!options.fallback || !qualitySwitch || !video()?.paused;
    const option = qualities.find(({ index }) => index === options.qualityIndex);
    if (!options.fallback) failedQualities.current.clear();
    setSwitching(true);
    setNote(options.fallback ? (options.fallback === "format" ? "This format cannot play in your browser. Trying " : "Trying ") + (option?.label ?? "another quality") + "…" :
      options.refresh ? "Refreshing sources…" : qualitySwitch ? "Switching quality…" : "Loading episode…");
    try {
      const updated = qualitySwitch ? await switchQuality(target, options.qualityIndex!, controller.signal) : {
        ...target, item, episodeNumber: item.series ?
          (item.ref === target.item.ref ? target.episodeNumber : undefined) ?? episodeNumberOf(item) ?? undefined : undefined,
      };
      const list = await playbackSources(updated.item, controller.signal, updated.preferredLanguage);
      if (controller.signal.aborted) return;
      save();
      const match = options.refresh ? list.findIndex(({ server, quality }) => server === source.server && quality === source.quality) : 0;
      tried.current.clear();
      setAttempts([]);
      changingMedia.current = true;
      positionRef.current = resume;
      resumePlay.current = shouldPlay;
      setIndex(Math.max(0, match));
      setRevision((previous) => previous + 1);
      setPosition(resume);
      setDuration(0);
      setBuffered(0);
      setPanel(null);
      setWaiting(true);
      setTracks(emptyTracks);
      setAudio(-1);
      setQuality(-1);
      setCaption("off");
      setError("");
      setNote("");
      usePlayback.getState().replace({ target: updated, sources: list, index: Math.max(0, match), position: resume });
      return true;
    } catch (failure) {
      if (controller.signal.aborted) return;
      if (failure instanceof CatalogError && failure.attempts.length) {
        setAttempts((current) => [...current, ...failure.attempts]);
      }
      setNote(failure instanceof Error ? failure.message : String(failure));
      return false;
    } finally { if (!controller.signal.aborted) setSwitching(false); }
  }

  async function tryFallback(formatFailure: boolean) {
    failedQualities.current.add(target.qualityIndex ?? 0);
    const alternatives = fallbackQualities(target, failedQualities.current);
    for (const option of alternatives) {
      failedQualities.current.add(option.index);
      const result = await resolve(target.item, { qualityIndex: option.index, fallback: formatFailure ? "format" : "network" });
      if (result !== false) return;
    }
    if (!alternatives.length) setNote("");
    setWaiting(false);
    setError(target.item.provider + " · playback · " + (formatFailure ? "This format cannot play in your browser." : "All attempted servers failed."));
  }

  function retry() {
    resumePlay.current = true;
    if (!error) {
      setWaiting(true);
      setRevision((previous) => previous + 1);
    } else void resolve(target.item, { refresh: true });
  }

  function close() {
    save();
    usePlayback.getState().close();
  }

  function handleKey(event: React.KeyboardEvent<HTMLElement>) {
    const element = event.target as HTMLElement;
    if (event.key === "Escape" && !document.fullscreenElement) { if (panel) setPanel(null); else close(); return; }
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey ||
        /^(?:INPUT|SELECT|TEXTAREA|BUTTON)$/.test(element.tagName) || element.isContentEditable) return;
    if (locked || minimized) return;
    switch (event.key.toLowerCase()) {
      case " ": case "k": toggle(); break;
      case "arrowleft": seek(positionRef.current - 5); break;
      case "arrowright": seek(positionRef.current + 5); break;
      case "j": seek(positionRef.current - 10); break;
      case "l": seek(positionRef.current + 10); break;
      case "arrowup": updateVolume(volume + .05); break;
      case "arrowdown": updateVolume(volume - .05); break;
      case "f": void fullscreen(); break;
      case "m": toggleMute(); break;
      case "c": toggleCaptions(); break;
      default: return;
    }
    event.preventDefault();
    wake();
  }

  const onMediaFailure = useEffectEvent((reason?: "format", diagnostic?: string) => {
    clearTimeout(stalled.current);
    changingMedia.current = true;
    const message = diagnostic ?? (reason === "format" ? "Codec or container unsupported during playback." : "Playback connection failed or stalled.");
    tried.current.add(i);
    setAttempts((current) => [...current, { server: source.server, quality: source.quality,
      probe: { ...source.probe, status: "failed", reason: message } }]);
    const replacement = sources.findIndex((_, index) => !tried.current.has(index));
    if (replacement >= 0) {
      setWaiting(true);
      setDuration(0);
      setBuffered(0);
      setNote("Trying another server…");
      setTracks(emptyTracks);
      setQuality(-1);
      setAudio(-1);
      setCaptions("off");
      setIndex(replacement);
    } else {
      void tryFallback(reason === "format");
    }
  });

  useEffect(() => {
    const element = videoRef.current;
    if (!element || !source) return;
    const preferred = target.preferredLanguage;
    preferredApplied.current = false;
    qualityChosen.current = false;
    captionChosen.current = false;
    changingMedia.current = true;
    clearTimeout(stalled.current);
    const current = attachMedia(element, source, {
      tracks: (nextTracks) => {
        setTracks(nextTracks);
        if (!preferredApplied.current && preferred && preferred !== "none") {
          const best = nextTracks.audio.findIndex((track) => normalizeLangCode(track.language || track.label) === preferred);
          if (best >= 0) { preferredApplied.current = true; current.audio(best); setAudio(best); }
        }
      },
      failed: (reason, diagnostic) => onMediaFailure(reason, diagnostic),
    });
    engine.current = current;
    return () => current.destroy();
  }, [i, revision, source, sources, target.preferredLanguage]);

  return <div className="player-layer" data-minimized={minimized}>
    <section ref={frame} tabIndex={0} aria-label={"Player for " + target.title.title}
      role={minimized ? undefined : "dialog"} aria-modal={!minimized || undefined}
      className="browser-player" data-theater={theater} data-mini={minimized} data-locked={locked}
      aria-keyshortcuts="Space ArrowLeft ArrowRight ArrowUp ArrowDown J L F M C"
      onKeyDown={handleKey} onPointerMove={wake}>
      <div className="player-picture">
        <div className="player-viewport" data-framing={minimized ? "fit" : framing}
          onTouchStart={(event) => {
            if (locked || minimized || event.touches.length !== 2 || event.target !== videoRef.current) return;
            const [a, b] = [event.touches[0], event.touches[1]];
            pinch.current = { distance: Math.max(1, Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)), scale: zoom };
          }}
          onTouchMove={(event) => {
            if (!pinch.current || event.touches.length !== 2) return;
            const [a, b] = [event.touches[0], event.touches[1]];
            const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
            setZoom(Math.round(Math.max(zoomMin, Math.min(zoomMax, pinch.current.scale * distance / pinch.current.distance))));
          }}
          onTouchEnd={() => { pinch.current = null; }} onTouchCancel={() => { pinch.current = null; }}>
          <div className="player-video-window">
            <video ref={videoRef} preload="metadata" playsInline disablePictureInPicture
              style={{ transform: !minimized && zoom !== 100 ? `scale(${zoom / 100})` : undefined }}
              onClick={() => { if (!locked) toggle(); }}
              onLoadedMetadata={(event) => {
                const element = event.currentTarget;
                setDuration(Number.isFinite(element.duration) ? element.duration : 0);
                if (positionRef.current > 0 && Number.isFinite(element.duration)) element.currentTime = Math.min(positionRef.current, Math.max(0, element.duration - .2));
                element.playbackRate = speed;
                element.volume = volume;
                element.muted = muted;
                changingMedia.current = false;
                if (resumePlay.current) startPlayback(element);
              }}
              onDurationChange={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
              onPlaying={() => { clearTimeout(stalled.current); setPlay(true); setWaiting(false); setNote(""); wake(); }}
              onPause={() => { clearTimeout(stalled.current); setPlay(false); if (!changingMedia.current) setWaiting(false); if (video()?.readyState) save(); }}
              onWaiting={(event) => {
                setWaiting(true);
                clearTimeout(stalled.current);
                if (!event.currentTarget.paused) {
                  stalled.current = setTimeout(() => { engine.current?.fail(); }, 18_000);
                }
              }}
              onCanPlay={() => { clearTimeout(stalled.current); setWaiting(false); }}
              onTimeUpdate={() => tick()}
              onSeeked={() => tick(true)}
              onEnded={() => { setPlay(false); save(); if (autoplay && next) void resolve(next); }} />
          </div>
        </div>
        <div className="player-caption" style={{ bottom: captionStyle.bottom, textAlign: captionStyle.align }}>
          <span ref={captionsRef} style={textStyle(captionStyle)} hidden />
        </div>
        {waiting && !error && !locked && <span className="player-spinner" role="status" aria-label="Buffering" />}
        {error && <div className="player-error">
          <p role="alert">{error}</p>
          <div className="max-h-32 overflow-auto"><SourceAttempts attempts={attempts} /></div>
          <button type="button" className="secondary-button" onClick={retry} disabled={switching}>Refresh sources</button>
        </div>}
        <div className="player-top" data-visible={!!controls}>
          <span className="min-w-0 flex-1 truncate font-semibold">{target.title.title}{target.item.series ? " · " + target.item.title : ""}</span>
          {minimized ? <PlayerButton title="Expand player" click={() => usePlayback.getState().expand()}><Expand size={19} /></PlayerButton> :
            <PlayerButton title="Minimize player" click={() => { save(); setPanel(null); usePlayback.getState().minimize(); }}><ChevronDown size={21} /></PlayerButton>}
          <PlayerButton title="Close player" click={close}><X size={20} /></PlayerButton>
        </div>
        {note && <p className="player-note" role="status">{note}</p>}
        <div className="player-controls" data-visible={!!controls} onFocusCapture={wake}>
          {locked ? <PlayerButton title="Unlock controls" click={() => { setLocked(false); wake(); }}><Unlock size={20} /></PlayerButton> :
            <>
              {!minimized && <div className="mb-2 flex items-center gap-3">
                <SeekControl position={position} duration={duration} buffered={buffered} seek={seek} locked={locked}
                  source={!source.hls ? source.url : undefined} />
                <span className="shrink-0 text-xs tabular-nums">{formatTime(position)} / {showRemaining && duration ? "−" + formatTime(duration - position) : formatTime(duration)}</span>
              </div>}
              <div className="flex flex-wrap items-center gap-1">
                <PlayerButton title={play ? "Pause" : "Play"} click={toggle}>{play ? <Pause size={21} /> : <Play size={21} />}</PlayerButton>
                {!minimized && <>
                  {next && <PlayerButton title="Next episode" click={() => void resolve(next)} disabled={switching}><SkipForward size={19} /></PlayerButton>}
                  <PlayerButton title={muted ? "Unmute" : "Mute"} click={toggleMute}>{muted ? <VolumeX size={20} /> : <Volume2 size={20} />}</PlayerButton>
                  <input className="player-volume accent-accent" type="range" aria-label="Volume" min={0} max={1} step={.05} value={volume}
                    onChange={(event) => updateVolume(Number(event.target.value))} />
                  <span className="flex-1" />
                  <PlayerButton title="Captions" click={toggleCaptions} pressed={captions !== "off"}><Captions size={20} /></PlayerButton>
                  {target.episodes.length > 1 && <PlayerButton title="Episodes" click={() => setPanel(panel === "episodes" ? null : "episodes")} pressed={panel === "episodes"}><ListVideo size={20} /></PlayerButton>}
                  <PlayerButton title="Quality" click={() => setPanel(panel === "quality" ? null : "quality")} pressed={panel === "quality"}><SlidersHorizontal size={19} /></PlayerButton>
                  <PlayerButton title="Audio tracks" click={() => setPanel(panel === "audio" ? null : "audio")} pressed={panel === "audio"}><AudioLines size={19} /></PlayerButton>
                  <PlayerButton title="Framing and zoom" click={() => setPanel(panel === "framing" ? null : "framing")} pressed={panel === "framing"}><Crop size={19} /></PlayerButton>
                  <PlayerButton title="Servers" click={() => setPanel(panel === "servers" ? null : "servers")} pressed={panel === "servers"}><Server size={18} /></PlayerButton>
                  <PlayerButton title="Playback settings" click={() => setPanel(panel === "settings" ? null : "settings")} pressed={panel === "settings"}><Settings2 size={19} /></PlayerButton>
                  <PlayerButton title="Lock controls" click={() => { setPanel(null); setLocked(true); }}><Lock size={19} /></PlayerButton>
                  <PlayerButton title="Theater mode" click={() => setTheater(!theater)} pressed={theater}>{theater ? <Minimize2 size={19} /> : <Expand size={19} />}</PlayerButton>
                  <PlayerButton title="Fullscreen" click={() => void fullscreen()}><Maximize size={19} /></PlayerButton>
                </>}
              </div>
            </>}
        </div>
      </div>
      {panel && !minimized && <aside className="player-panel" aria-label={panelNames[panel]}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{panelNames[panel]}</h2>
          <PlayerButton title="Close panel" click={() => setPanel(null)}><X size={19} /></PlayerButton>
        </div>
        {panel === "episodes" ? <ul className="grid gap-2">{target.episodes.map((item) => <li key={item.ref}>
          <button className="list-row w-full text-left" type="button" disabled={switching} aria-pressed={target.item.ref === item.ref}
            onClick={() => { if (target.item.ref === item.ref) setPanel(null); else void resolve(item); }}>{item.title}</button>
        </li>)}</ul> : panel === "servers" ? <ul className="grid gap-3">{[...new Set(sources.map((entry) => entry.serverKey ?? entry.server))].map((key) => (
          <li key={key}><ul className="grid gap-2">{sources.map((entry, index) => (entry.serverKey ?? entry.server) === key &&
            <li key={entry.url}><button className="list-row w-full text-left" type="button" aria-pressed={i === index} onClick={() => changeSource(index)}>
              {[entry.server, entry.quality, entry.format?.toUpperCase()].filter(Boolean).join(" · ")}
            </button></li>)}</ul></li>
        ))}</ul> : panel === "quality" ? <div className="grid min-w-0 gap-4">
          {!!qualities.length && <PlayerChoices label="Title quality" value={target.qualityIndex ?? qualities[0].index} disabled={switching}
            change={(index) => { if (index !== (target.qualityIndex ?? qualities[0].index)) void resolve(target.item, { qualityIndex: index }); }}
            options={qualities.map(({ index, label }) => ({ value: index, label }))} />}
          {!!tracks.levels.length && <PlayerChoices label="HLS levels" value={quality} change={(value) => {
            qualityChosen.current = true;
            setQuality(value);
            engine.current?.quality(value);
          }} options={[{ value: -1, label: "Auto" }, ...tracks.levels.map((track, index) => ({ value: index, label: track.label }))]} />}
          {!qualities.length && !tracks.levels.length && <p className="text-sm text-muted">{source.quality ? `Playing at ${source.quality}.` : "This source has one quality."}</p>}
        </div> : panel === "audio" ? tracks.audio.length ? <PlayerChoices label="Available audio tracks" value={audio} change={(value) => {
          preferredApplied.current = true;
          setAudio(value);
          engine.current?.audio(value);
        }} options={[{ value: -1, label: "Default" }, ...tracks.audio.map((track, index) => ({ value: index, label: track.label }))]} /> :
          <p className="text-sm text-muted">This source and browser do not expose alternate audio tracks.</p> : panel === "framing" ? <div className="grid gap-4">
          <PlayerChoices label="Framing" value={framing} change={(value) => { setFraming(value); setZoom(100); }} options={framingOptions} />
          <label className="grid gap-2 text-sm">
            <span className="flex justify-between">Zoom <span className="tabular-nums" aria-hidden="true">{zoom}%</span></span>
            <input type="range" aria-label="Zoom" aria-valuetext={`${zoom}%`} className="accent-accent" min={zoomMin} max={zoomMax} value={zoom}
              onChange={(event) => setZoom(event.target.valueAsNumber)} />
          </label>
          <button type="button" className="secondary-button justify-self-start" onClick={() => setZoom(100)} disabled={zoom === 100}>Reset zoom</button>
        </div> : <div className="grid gap-4">
          <Picker label="Speed" value={speed} change={(value) => { setSpeed(value); if (video()) video()!.playbackRate = value; }}
            options={[.25,.5,.75,1,1.25,1.5,1.75,2].map((rate) => ({ value: rate, label: rate + "×" }))} />
          <label className="grid gap-1 text-sm">Subtitle track
            <select className="field" value={captions} onChange={(event) => setCaption(event.target.value, true)}>
              <option value="off">Off</option>
              {source.subtitles.map((track,index) => <option key={index} value={"file:" + index}>{track.label}</option>)}
              {tracks.captions.map((track,index) => <option key={index} value={"hls:" + index}>{track.label}</option>)}
            </select>
          </label>
          {target.episodes.length > 1 && <label className="flex gap-2 text-sm"><input type="checkbox" checked={autoplay}
            onChange={() => preferences.set("autoplay", !autoplay)} /> Autoplay next episode</label>}
          <CaptionSettings />
        </div>}
      </aside>}
    </section>
  </div>;
}

function PlayerButton({ title, click, children, pressed, disabled }: {
  title: string; click: () => void; children: React.ReactNode; pressed?: boolean; disabled?: boolean;
}) {
  return <button type="button" className="player-button" aria-label={title} title={title} aria-pressed={pressed} disabled={disabled}
    onClick={click}>{children}</button>;
}

function PlayerChoices<T extends number | string>({ label, value, change, options, disabled }: {
  label: string; value: T; change: (value: T) => void; options: readonly { value: T; label: string }[]; disabled?: boolean;
}) {
  return <div className="grid gap-2">
    <h3 className="text-sm font-medium">{label}</h3>
    <ul className="grid gap-1" aria-label={label}>
      {options.map((option) => <li key={option.value}>
        <button type="button" className="player-choice" disabled={disabled} aria-pressed={option.value === value}
          onClick={() => change(option.value)}>{option.label}</button>
      </li>)}
    </ul>
  </div>;
}

function Picker({ label, value, change, options, disabled }: {
  disabled?: boolean; label: string; value: number; change: (value: number) => void; options: { value: number; label: string }[];
}) {
  return <label className="grid min-w-0 gap-1 text-sm">{label}
    <select className="field w-full min-w-0 truncate" disabled={disabled} aria-label={label} value={value} onChange={(event) => change(Number(event.target.value))}>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </label>;
}
