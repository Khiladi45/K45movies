import type Hls from "hls.js";
import type { Source } from "./catalog-types";

export type TrackOption = { label: string; language?: string };
export type MediaTracks = { levels: TrackOption[]; audio: TrackOption[]; captions: TrackOption[] };
export const emptyTracks: MediaTracks = { levels: [], audio: [], captions: [] };

type NativeAudioTrack = { label: string; language: string; enabled: boolean };
type NativeAudioTracks = ArrayLike<NativeAudioTrack> & EventTarget;
type NativeMedia = HTMLVideoElement & { audioTracks?: NativeAudioTracks };

export function attachMedia(video: HTMLVideoElement, source: Source, events: {
  tracks: (tracks: MediaTracks) => void;
  failed: () => void;
}) {
  let engine: Hls | undefined;
  let disposed = false;
  let networkRecovered = false;
  let initialAudio = 0;
  let mediaRecovered = false;
  const native = video as NativeMedia;
  const textTracks = () => Array.from(video.textTracks).filter((track) => track.kind === "subtitles" || track.kind === "captions");
  let working = true;

  function fail() {
    if (!disposed && working) { working = false; events.failed(); }
  }

  function update() {
    if (disposed) return;
    events.tracks({
      levels: engine?.levels.map(({ height, name }) => ({ label: height ? height + "p" : name || "HLS" })) ?? [],
      audio: engine?.audioTracks.map(({ name, lang }) => ({ label: name, language: lang })) ??
        Array.from(native.audioTracks ?? []).map(({ label, language }, i) => ({ label: label || language || "Track " + (i + 1), language })),
      captions: engine?.subtitleTracks.map(({ name, lang }) => ({ label: name, language: lang })) ??
        textTracks().map(({ label, language }, i) => ({ label: label || language || "Track " + (i + 1), language })),
    });
  }

  video.addEventListener("error", fail);
  video.addEventListener("loadedmetadata", update);
  video.textTracks.addEventListener("addtrack", update);

  async function load() {
    if (!source.hls) {
      video.src = source.url;
      return;
    }
    const { default: Hls } = await import("hls.js");
    if (disposed) return;
    if (Hls.isSupported()) {
      engine = new Hls({
        enableWorker: true, capLevelToPlayerSize: true, maxBufferLength: 22, maxMaxBufferLength: 45,
        backBufferLength: 30, maxBufferSize: 35 * 1024 * 1024, renderTextTracksNatively: true,
      });
      engine.on(Hls.Events.MEDIA_ATTACHED, () => engine?.loadSource(source.url));
      engine.on(Hls.Events.MANIFEST_PARSED, () => { initialAudio = Math.max(0, engine?.audioTrack ?? 0); update(); });
      engine.on(Hls.Events.AUDIO_TRACKS_UPDATED, update);
      engine.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, update);
      engine.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal || !engine || disposed) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && !networkRecovered) {
          networkRecovered = true;
          engine.startLoad(video.currentTime || -1);
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !mediaRecovered) {
          mediaRecovered = true;
          engine.recoverMediaError();
        } else fail();
      });
      engine.attachMedia(video);
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) video.src = source.url;
    else fail();
  }
  void load().catch(fail);

  return {
    fail,
    quality(index: number) { if (engine) engine.loadLevel = index; },
    audio(index: number) {
      if (engine) engine.audioTrack = index < 0 ? initialAudio : index;
      else Array.from(native.audioTracks ?? []).forEach((track, i) => { track.enabled = i === Math.max(0, index); });
    },
    cues(index: number) {
      if (index < 0) return [];
      const selected = engine?.subtitleTracks[index];
      const track = selected ? textTracks().find((item) => item.label === selected.name ||
        (!!selected.lang && item.language === selected.lang)) : textTracks()[index];
      if (!track) return [];
      if (track.mode !== "hidden") track.mode = "hidden";
      return Array.from(track.cues ?? []);
    },
    captions(index: number) {
      if (engine) {
        engine.subtitleTrack = index;
        engine.subtitleDisplay = false;
      } else textTracks().forEach((track, i) => { track.mode = i === index ? "hidden" : "disabled"; });
    },
    destroy() {
      disposed = true;
      video.removeEventListener("error", fail);
      video.removeEventListener("loadedmetadata", update);
      video.textTracks.removeEventListener("addtrack", update);
      engine?.destroy();
      video.removeAttribute("src");
      video.load();
    },
  };
}
