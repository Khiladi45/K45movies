import { provider } from "./live-api.js";

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

const clock = (seconds) => Number.isFinite(seconds)
  ? Math.floor(seconds / 60) + ":" + String(Math.floor(seconds % 60)).padStart(2, "0") : "–:––";

const icons = {
  Play: "m9 5 12 7-12 7z",
  Pause: "M9 5v14m6-14v14",
  Mute: "M3 9h4l5-4v14l-5-4H3z M16 8a6 6 0 0 1 0 8m2-10a9 9 0 0 1 0 12",
  Unmute: "M3 9h4l5-4v14l-5-4H3z m13 1 5 5m0-5-5 5",
  Settings: "M4 7h16M4 17h16M9 4v6m6 4v6",
  Theater: "M3 6h18v12H3z m4 2h10",
  Fullscreen: "M9 4H4v5m11-5h5v5m0 6v5h-5M9 20H4v-5",
  PiP: "M12 18H3V5h18v5m-8 2h9v7h-9z",
  Close: "m6 6 12 12m0-12L6 18",
};
function drawButton(node, label) {
  if (node.dataset.icon === label) return;
  node.dataset.icon = label;
  node.replaceChildren();
  const ns = "http://www.w3.org/2000/svg";
  const icon = document.createElementNS(ns, "svg");
  const path = document.createElementNS(ns, "path");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("aria-hidden", "true");
  path.setAttribute("d", icons[label]);
  icon.append(path);
  node.append(icon);
}

function bridgeLoader(ticket) {
  return class {
    constructor(config) { this.stats = new globalThis.Hls.DefaultConfig.loader(config).stats; }
    abort() { this.stats.aborted = true; }
    destroy() { this.abort(); }
    load(context, configuration, callbacks) {
      this.context = context;
      const stats = this.stats;
      stats.loading.start = performance.now();
      const range = Number.isFinite(context.rangeStart) && Number.isFinite(context.rangeEnd) && context.rangeEnd > context.rangeStart ? { start: context.rangeStart, end: context.rangeEnd } : {};
      void provider("media", { ticket, url: context.url, ...range }).then((result) => {
        if (stats.aborted) return;
        const data = result.playlist ?? Uint8Array.from(atob(result.encoded), (char) => char.charCodeAt(0)).buffer;
        stats.loading.first = stats.loading.end = performance.now();
        stats.loaded = stats.total = result.bytes;
        callbacks.onSuccess({ url: context.url, data, code: 200 }, stats, context, null);
      }).catch((error) => {
        if (!stats.aborted) callbacks.onError({ code: 0, text: error.message }, context, null, stats);
      });
    }
  };
}

let close;
export function closePlayer() { close?.(); }

export function openPlayer(title, sources, selected = 0, options = {}) {
  closePlayer();
  const opener = document.activeElement;
  const dialog = element("dialog", "player-shell");
  dialog.setAttribute("aria-label", "Player: " + title);
  const video = element("video");
  video.playsInline = true;
  video.preload = "metadata";
  const stage = element("div", "player-stage");
  const status = element("p", "player-status");
  status.setAttribute("role", "status");
  let engine, index = selected, generation = 0, resume = options.resume || 0, lastPaint = 0, timer, savedAt = -10, ready = false;
  let tried = new Set();
  const announce = (message) => { status.textContent = message; };
  function button(label, action, accessibleLabel = label) {
    const node = element("button", "", label);
    node.type = "button";
    node.setAttribute("aria-label", accessibleLabel);
    node.title = accessibleLabel;
    if (icons[label]) drawButton(node, label);
    node.onclick = action;
    return node;
  }
  function range(label, max, step, className) {
    const input = element("input", className);
    Object.assign(input, { type: "range", min: 0, max, step, value: 0 });
    input.setAttribute("aria-label", label);
    return input;
  }
  const heading = element("div");
  const server = element("small");
  heading.append(element("strong", "", title), server);
  const head = element("div", "bar player-head");
  const back = button("←", () => dialog.close(), "Close player");
  head.append(back, heading);
  const toggle = () => {
    if (video.paused) void video.play().catch(() => announce("Press Play to start playback."));
    else video.pause();
  };
  const center = button("▶", toggle, "Play video");
  center.className = "player-center";
  stage.append(video, center);
  video.onclick = toggle;
  const seek = range("Seek", 1, .1, "player-seek");
  seek.disabled = true;
  seek.oninput = () => { video.currentTime = Number(seek.value); };
  const time = element("span", "player-time", "0:00 / –:––");
  const play = button("Play", toggle);
  const volume = range("Volume", 1, .02, "player-volume");
  volume.value = 1;
  volume.oninput = () => { video.volume = Number(volume.value); video.muted = false; };
  const mute = button("Mute", () => { video.muted = !video.muted; });
  const theater = button("Theater", () => {
    theater.setAttribute("aria-pressed", String(dialog.classList.toggle("theater")));
  });
  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await dialog.requestFullscreen();
    } catch { announce("Fullscreen is unavailable."); }
  };
  const panel = element("div", "actions player-panel");
  panel.hidden = true;
  const settings = button("Settings", () => {
    showSettings("all");
  });
  function select(label, options, change) {
    const group = element("label", "", label);
    const field = element("select");
    for (const [value, name] of options) field.add(new Option(name, value));
    field.onchange = () => change(Number(field.value));
    group.append(field);
    panel.append(group);
    return { group, field };
  }
  const source = select("Source", sources.map((item, i) => [i, [item.server, item.quality].filter(Boolean).join(" · ")]), (value) => {
    tried = new Set();
    resume = video.currentTime || 0;
    load(value);
  });
  const speed = select("Speed", [.5, .75, 1, 1.25, 1.5, 2].map((rate) => [rate, rate + "×"]), (value) => { video.playbackRate = value; });
  speed.field.value = 1;
  const quality = select("Quality", [[-1, "Auto"]], (value) => { if (engine) engine.currentLevel = value; });
  const audio = select("Audio", [], (value) => { if (engine) engine.audioTrack = value; });
  const captions = select("Captions", [[-1, "Off"]], (value) => {
    if (engine) { engine.subtitleTrack = value; engine.subtitleDisplay = value >= 0; }
  });
  function showSettings(tab) {
    const selectedTab = panel.dataset.tab === tab && !panel.hidden;
    panel.dataset.tab = tab;
    panel.hidden = selectedTab;
    panel.classList.toggle("track-settings", tab === "tracks");
    settings.setAttribute("aria-expanded", String(!panel.hidden));
    if (tab === "tracks" && !panel.hidden) {
      trackNotice.hidden = !(audio.group.hidden && captions.group.hidden);
    } else trackNotice.hidden = true;
  }
  const trackNotice = element("p", "", "No optional audio or subtitle tracks are listed.");
  trackNotice.hidden = true;
  panel.append(trackNotice);
  head.append(button("Quality", () => showSettings("quality")), button("Audio & subtitles", () => showSettings("tracks")));
  audio.group.dataset.track = captions.group.dataset.track = "true";
  function rebuildSources() {
    source.field.replaceChildren(...sources.map((item, i) => new Option([item.server, item.quality].filter(Boolean).join(" · "), i)));
  }
  const skip = (offset) => {
    if (Number.isFinite(video.duration)) video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + offset));
  };
  const controls = element("div", "player-controls");
  const row = element("div", "actions");
  row.append(button("−10s", () => skip(-10)), play, button("+10s", () => skip(10)), mute, volume, time, settings,
    theater, button("Fullscreen", fullscreen));
  if (document.pictureInPictureEnabled) row.append(button("PiP", async () => {
    try { await (document.pictureInPictureElement ? document.exitPictureInPicture() : video.requestPictureInPicture()); }
    catch { announce("Picture-in-picture is unavailable."); }
  }, "Picture-in-picture"));
  controls.append(seek, row, status);
  dialog.append(head, stage, controls, panel);
  document.body.append(dialog);
  function sync() {
    seek.disabled = !Number.isFinite(video.duration);
    seek.max = seek.disabled ? 1 : video.duration;
    seek.value = video.currentTime;
    time.textContent = clock(video.currentTime) + " / " + clock(video.duration);
    const playback = video.paused ? "Play" : "Pause";
    drawButton(play, playback);
    play.setAttribute("aria-label", playback);
    play.title = playback;
    time.title = "Elapsed time / duration";
    center.hidden = !video.paused;
    const volumeLabel = video.muted ? "Unmute" : "Mute";
    drawButton(mute, volumeLabel);
    mute.setAttribute("aria-label", volumeLabel);
    mute.title = volumeLabel;
  }
  function reportProgress(force = false) {
    if (ready && video.currentTime > 1 && Number.isFinite(video.duration) && (force || Math.abs(video.currentTime - savedAt) >= 8)) {
      savedAt = video.currentTime;
      options.onProgress?.(savedAt, video.duration);
    }
  }
  video.ontimeupdate = () => {
    if (performance.now() - lastPaint >= 175) { lastPaint = performance.now(); sync(); }
    reportProgress();
  };
  video.onplay = video.onpause = video.onvolumechange = sync;
  video.onplaying = () => announce("");
  video.onwaiting = () => announce("Buffering…");
  video.onloadedmetadata = () => {
    if (resume && Number.isFinite(video.duration)) video.currentTime = Math.min(resume, video.duration);
    video.playbackRate = Number(speed.field.value);
    sync();
  };
  function load(next, viaBridge = false) {
    clearTimeout(timer);
    index = next;
    const token = ++generation;
    ready = false;
    const item = sources[index];
    const hls = /hls|m3u8/i.test(item.type ?? "") || /\.m3u8(?:[?#]|$)/i.test(item.url);
    video.onerror = null;
    video.oncanplay = null;
    engine?.destroy();
    engine = undefined;
    video.removeAttribute("src");
    video.load();
    server.textContent = [item.server, item.quality].filter(Boolean).join(" · ");
    source.field.value = index;
    quality.group.hidden = audio.group.hidden = captions.group.hidden = true;
    announce("Connecting to source…");
    async function failed() {
      clearTimeout(timer);
      if (token !== generation) return;
      if (video.currentTime > 0) resume = video.currentTime;
      if (hls && !viaBridge && item.ticket && globalThis.Hls?.isSupported()) {
        load(index, true);
        return;
      }
      tried.add(index);
      const replacement = sources.findIndex((_, i) => !tried.has(i));
      if (replacement >= 0) load(replacement);
      else {
        const request = ++generation;
        announce("Checking other sources for this title…");
        let extra;
        try { extra = await options.nextSources?.(); }
        catch (error) {
          if (request === generation) announce(error.needsAccess ? error.message : "No other source could be reached.");
          return;
        }
        if (request !== generation) return;
        if (extra?.length) {
          const start = sources.length;
          sources.push(...extra);
          rebuildSources();
          load(start);
        } else announce("None of the available sources could play this title right now.");
      }
    }
    timer = setTimeout(failed, 18000);
    video.onerror = () => failed();
    video.oncanplay = () => {
      video.oncanplay = null;
      clearTimeout(timer);
      if (token !== generation) return;
      ready = true;
      void video.play().catch((error) => {
        if (error.name === "NotAllowedError") announce("Press Play to start.");
        else if (error.name !== "AbortError") failed();
      });
    };
    if (hls && globalThis.Hls?.isSupported()) {
      engine = new globalThis.Hls({ enableWorker: true, maxBufferLength: 24,
        ...(viaBridge ? { loader: bridgeLoader(item.ticket) } : {}) });
      const update = () => {
        if (!engine || token !== generation) return;
        quality.field.replaceChildren(new Option("Auto", -1), ...engine.levels.map((level, i) => new Option(level.height + "p", i)));
        audio.field.replaceChildren(...engine.audioTracks.map((track, i) => new Option(track.name, i)));
        captions.field.replaceChildren(new Option("Off", -1), ...engine.subtitleTracks.map((track, i) => new Option(track.name, i)));
        quality.group.hidden = !engine.levels.length;
        audio.group.hidden = !engine.audioTracks.length;
        captions.group.hidden = !engine.subtitleTracks.length;
        if (panel.dataset.tab === "tracks") trackNotice.hidden = !(audio.group.hidden && captions.group.hidden);
      };
      const events = globalThis.Hls.Events;
      for (const type of [events.MANIFEST_PARSED, events.AUDIO_TRACKS_UPDATED, events.SUBTITLE_TRACKS_UPDATED]) engine.on(type, update);
      engine.on(events.ERROR, (_, data) => {
        if (data.fatal || (!viaBridge && item.ticket && data.type === globalThis.Hls.ErrorTypes.NETWORK_ERROR)) {
          queueMicrotask(() => { if (token === generation) void failed(); });
        }
      });
      engine.loadSource(item.url);
      engine.attachMedia(video);
    } else video.src = item.url;
  }
  dialog.onkeydown = (event) => {
    if (event.target.matches("input,select") || event.metaKey || event.ctrlKey) return;
    const key = event.key.toLowerCase();
    if (key === " " && event.target.matches("button")) return;
    if (key === " " || key === "k") toggle();
    else if (key === "f") void fullscreen();
    else if (key === "m") video.muted = !video.muted;
    else if (key === "j" || key === "arrowleft") skip(-10);
    else if (key === "l" || key === "arrowright") skip(10);
    else return;
    event.preventDefault();
  };
  close = () => {
    reportProgress(true);
    generation++;
    clearTimeout(timer);
    video.onerror = video.oncanplay = null;
    engine?.destroy();
    video.pause();
    video.removeAttribute("src");
    video.load();
    dialog.remove();
    opener?.focus();
    close = undefined;
  };
  dialog.onclose = close;
  dialog.showModal();
  load(index);
}
