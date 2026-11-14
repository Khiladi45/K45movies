import assert from "node:assert/strict";
import { test } from "node:test";
import { attachMedia } from "../src/lib/media-engine";
import { checkSource, resumePlayback } from "../src/lib/player-actions";
import { usePlayback, type PlaybackTarget } from "../src/lib/playback";
import { parseCues } from "../src/lib/video-cues";
import type { Source } from "../src/lib/catalog-types";

const source: Source = { server: "First", quality: "720p", url: "/api/proxy/media/token",
  hls: false, subtitles: [], languages: [] };

test("native media reports fatal errors once and removes listeners during cleanup", () => {
  class FakeVideo extends EventTarget {
    src = "";
    loadCount = 0;
    textTracks = new EventTarget();
    load() { this.loadCount++; }
    removeAttribute(name: string) { if (name === "src") this.src = ""; }
  }
  const video = new FakeVideo();
  let failures = 0;
  let updates = 0;
  const engine = attachMedia(video as unknown as HTMLVideoElement, source, {
    tracks: () => { updates++; },
    failed: () => { failures++; },
  });
  assert.equal(video.src, source.url);
  video.dispatchEvent(new Event("loadedmetadata"));
  video.dispatchEvent(new Event("error"));
  engine.fail();
  assert.equal(updates, 1);
  assert.equal(failures, 1);
  engine.destroy();
  video.dispatchEvent(new Event("error"));
  assert.equal(failures, 1);
  assert.equal(video.src, "");
  assert.equal(video.loadCount, 1);
});

test("source probes distinguish confirmed failure from an inconclusive HEAD", async (context) => {
  let status = 405;
  let contentType = "video/mp4";
  context.mock.method(globalThis, "fetch", async (_input: RequestInfo | URL, options?: RequestInit) => {
    assert.equal(options?.method, "HEAD");
    return new Response(null, { status, headers: { "Content-Type": contentType } });
  });
  const signal = new AbortController().signal;
  assert.equal(await checkSource(source, signal), "unknown");
  status = 404;
  assert.equal(await checkSource(source, signal), "failed");
  status = 200;
  assert.equal(await checkSource(source, signal), "available");
  contentType = "text/html";
  assert.equal(await checkSource(source, signal), "failed");
});

test("resume resolves fresh URLs and restores the saved server and position", async (context) => {
  const target: PlaybackTarget = {
    title: { href: "/title/tv/1", title: "Example", layout: "movie" },
    item: { provider: "vega", ref: "ep.ref", title: "Episode 1", series: true },
    episodes: [],
  };
  const selected = { ...source, url: "/api/proxy/media/fresh", server: "Saved" };
  context.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    assert.match(String(input), /type=series/);
    return Response.json([source, selected]);
  });
  assert.equal(await resumePlayback({
    ...target.title, playback: target, source: { server: "Saved", quality: "720p" },
    position: 120, duration: 180, updatedAt: 1,
  }, new AbortController().signal), true);
  const session = usePlayback.getState().session!;
  assert.equal(session.position, 120);
  assert.equal(session.sources[session.index].url, selected.url);
  usePlayback.getState().close();
});

test("subtitle parsing accepts WebVTT and SRT timing and rejects reversed ranges", () => {
  const cues = parseCues("WEBVTT\n\n2\n00:00:05,000 --> 00:00:06,250\n<i>Later</i>\n\n00:01.000 --> 00:02.500 line:90%\nEarlier\n\n00:05.000 --> 00:02.000\nInvalid");
  assert.deepEqual(cues, [{ start: 1, end: 2.5, text: "Earlier" }, { start: 5, end: 6.25, text: "Later" }]);
});
