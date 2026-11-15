import assert from "node:assert/strict";
import { rewritePlaylist, sniffHlsSegment } from "../../src/server/media";
import { mediaTarget } from "../../src/server/media-token";

const base = "https://origin.example/hls/master";
const target = { url: base, origin: new URL(base).origin, kind: "media" as const, expires: Date.now() + 60000,
  headers: { referer: "https://origin.example/", origin: "https://origin.example", cookie: "fixture" } };
const decode = (line: string) => mediaTarget(/\/api\/proxy\/media\/([\w-]+)/.exec(line)![1]);
const master = rewritePlaylist('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=200\nvariant\n#EXT-X-MEDIA:TYPE=AUDIO,URI="https://cdn.example/audio"', base, target).split("\n");
assert.equal(decode(master[2]).format, "hls");
assert.equal(decode(master[2]).url, "https://origin.example/hls/variant");
assert.equal(decode(master[3]).format, "hls");
assert.equal(decode(master[3]).headers?.cookie, undefined);
assert.equal(decode(master[3]).headers?.referer, target.headers.referer);
const variant = rewritePlaylist('#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="../key"\n#EXT-X-MAP:URI="init.mp4",BYTERANGE="500@10"\n#EXTINF:2,\nsegment.jpg', base, target).split("\n");
assert.equal(decode(variant[1]).kind, "key");
assert.equal(decode(variant[1]).url, "https://origin.example/key");
assert.equal(decode(variant[2]).kind, "segment");
assert.ok(variant[2].includes('BYTERANGE="500@10"'));
assert.equal(decode(variant[4]).kind, "segment");
const packets = Uint8Array.from({ length: 3 * 188 + 17 }, (_, index) => index % 188 === 0 ? 0x47 : 0);
const sniffed = await sniffHlsSegment(new Response(packets).body!);
assert.equal(sniffed?.type, "video/mp2t");
assert.deepEqual(new Uint8Array(await new Response(sniffed?.body).arrayBuffer()), packets);
assert.equal(await sniffHlsSegment(new Response("<!DOCTYPE html>").body!), undefined);
console.log(JSON.stringify({ extensionlessVariants: true, crossOriginCredentialsRemoved: true, relativeKey: true,
  initRangePreserved: true, segmentBytesPreserved: true, htmlRejected: true }));
