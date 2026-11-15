import assert from "node:assert/strict";
import { test } from "node:test";
import { episodeNumberOf, findNextEpisode, findSameEpisode, orderEpisodes, parseEpisodeNumber, parseSeasonNumber } from "../src/lib/episodes";
import { normalizeStreams, preferredStreams } from "../src/lib/streams";
import { probeCandidates, probePlayback } from "../src/lib/stream-probe";
import { fallbackQualities, playerQualityOptions } from "../src/lib/player-switch";
import type { PlaybackTarget } from "../src/lib/playback";

test("normalizes quality and omits duplicate, download-only, embed-download and split tracks", () => {
  const streams = normalizeStreams([
    { server: "One", link: "//example.test/a-720p.m3u8" },
    { server: "One", link: "example.test/b.mp4", quality: "1080" },
    { server: "Two", link: "https://example.test/c.mkv", quality: "4K" },
    { server: "Two", link: "https://example.test/d.mkv", quality: "HD" },
    { server: "Download only", link: "https://example.test/download.mp4" },
    { server: "Flagged", link: "https://example.test/download2.mp4", downloadOnly: true },
    { server: "HDMoviesLife", link: "https://fxshare.org/example", type: "embed" },
    { server: "Audio", link: "https://example.test/split.mp4", kind: "audio" },
    { server: "Duplicate", link: "https://example.test/a-720p.m3u8" },
    { link: "magnet:?invalid" },
  ]);
  assert.deepEqual(streams.map(({ height }) => height), [720, 1080, 2160, 720]);
  assert.deepEqual(preferredStreams(streams, "highest").map(({ height }) => height), [1080, 2160, 720, 720]);
  assert.deepEqual(preferredStreams(streams, "lowest").map(({ url }) => url.split("/").at(-1)), ["a-720p.m3u8", "d.mkv", "b.mp4", "c.mkv"]);
});

test("rejects HTML disguised as video and invalid manifests and detects real media prefixes", async () => {
  const signal = new AbortController().signal;
  const html = await probePlayback(async (method) => new Response(method === "HEAD" ? null : "<html>challenge</html>",
    { headers: { "Content-Type": "video/mp4" } }), "mp4", signal);
  assert.equal(html.status, "failed");
  const invalid = await probePlayback(async () => new Response("#EXTM3U\nbroken"), "hls", signal);
  assert.equal(invalid.status, "failed");
  const valid = await probePlayback(async () => new Response('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=200,CODECS="avc1.4d401f,mp4a.40.2"\nstream.m3u8\n'), "hls", signal);
  assert.deepEqual(valid.codecs, ["avc1.4d401f", "mp4a.40.2"]);
  const mp4 = await probePlayback(async (method) => method === "HEAD" ? new Response(null, { status: 405 }) :
    new Response("....ftypavc1", { status: 206 }), "mkv", signal);
  assert.equal(mp4.format, "mp4");
  assert.equal(mp4.status, "ok");
});

test("probes up to four at once and retains preference order after varying completion times", async () => {
  let active = 0;
  let peak = 0;
  const checked = await probeCandidates([...Array(20).keys()], async (index) => {
    peak = Math.max(peak, ++active);
    await new Promise((resolve) => setTimeout(resolve, index === 0 ? 20 : 1));
    active--;
    return index === 2 ? undefined : index;
  }, new AbortController().signal);
  assert.equal(peak, 4);
  assert.deepEqual(checked, [0, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
});

test("identifies episodes, preserves unnumbered order, and avoids switching to a different episode", () => {
  assert.equal(parseEpisodeNumber("S02E03 · 1080p H.265 1.3GB"), 3);
  assert.equal(parseEpisodeNumber("1080p HEVC 10bit"), null);
  assert.equal(parseSeasonNumber("S02E03"), 2);
  assert.equal(parseSeasonNumber("Season 02 · 720p"), 2);
  const items = [{ ref: "3", title: "S02E03" }, { ref: "1", title: "Episode 1" }, { ref: "2", title: "Ep.02" }];
  assert.deepEqual(orderEpisodes(items).map(episodeNumberOf), [1, 2, 3]);
  assert.equal(findNextEpisode(items, 2, "2")?.ref, "3");
  assert.equal(findNextEpisode(items, 3, "3"), undefined);
  assert.equal(findSameEpisode(items, 5, 0), undefined);
  assert.equal(findSameEpisode([{ ref: "t", title: "Pilot" }], 1, 0)?.ref, "t");
});

test("title quality options and codec fallback stay in the current season", () => {
  const target: PlaybackTarget = {
    title: { title: "Show", href: "/", layout: "provider" },
    item: { provider: "test", ref: "x", title: "Episode 1", series: true },
    episodes: [], qualityIndex: 0, qualities: [
      { title: "Season 1 2160p HEVC", directLinks: [] },
      { title: "Season 1 1080p HDR", directLinks: [] },
      { title: "Season 1 720p H.264", directLinks: [] },
      { title: "Season 2 480p H.264", directLinks: [] },
    ],
  };
  assert.deepEqual(playerQualityOptions(target).map(({ index }) => index), [0, 1, 2]);
  assert.deepEqual(fallbackQualities(target, new Set()).map(({ index }) => index), [2, 1]);
});
