/**
 * Joins a video-only and an audio-only fragmented MP4 (the "adaptive" files
 * YouTube serves for 1080p-4K) into one playable fragmented MP4, with no
 * re-encoding. No ffmpeg is needed: only box headers are rewritten and the
 * media data is copied through in chunks, so memory stays small even for 4K.
 */

export interface ByteSource {
  size: number;
  read(offset: number, length: number): Promise<Uint8Array>;
}

export interface ByteSink {
  write(bytes: Uint8Array): Promise<void> | void;
}

type Box = { type: string; start: number; size: number; header: number };
type Fragment = { start: number; moofSize: number; mdatStart: number; mdatSize: number; time: number };

const CHUNK = 1024 * 1024;

const u32 = (b: Uint8Array, o: number) =>
  ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
const u64 = (b: Uint8Array, o: number) => u32(b, o) * 4294967296 + u32(b, o + 4);
const put32 = (b: Uint8Array, o: number, v: number) => {
  b[o] = (v >>> 24) & 255;
  b[o + 1] = (v >>> 16) & 255;
  b[o + 2] = (v >>> 8) & 255;
  b[o + 3] = v & 255;
};
const fourcc = (b: Uint8Array, o: number) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);

/** Boxes directly inside buf[start, end). */
function children(buf: Uint8Array, start = 0, end = buf.length): Box[] {
  const out: Box[] = [];
  let pos = start;
  while (pos + 8 <= end) {
    let size = u32(buf, pos);
    let header = 8;
    if (size === 1) {
      size = u64(buf, pos + 8);
      header = 16;
    } else if (size === 0) {
      size = end - pos;
    }
    if (size < header || pos + size > end) break;
    out.push({ type: fourcc(buf, pos + 4), start: pos, size, header });
    pos += size;
  }
  return out;
}

const find = (buf: Uint8Array, parent: Box, type: string) =>
  children(buf, parent.start + parent.header, parent.start + parent.size).find((b) => b.type === type);

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function makeBox(type: string, ...payload: Uint8Array[]): Uint8Array {
  const body = concat(payload);
  const out = new Uint8Array(8 + body.length);
  put32(out, 0, out.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(body, 8);
  return out;
}

async function readTop(source: ByteSource): Promise<Box[]> {
  const boxes: Box[] = [];
  let pos = 0;
  while (pos + 8 <= source.size) {
    const head = await source.read(pos, 16);
    let size = u32(head, 0);
    let header = 8;
    if (size === 1) {
      size = u64(head, 8);
      header = 16;
    } else if (size === 0) {
      size = source.size - pos;
    }
    if (size < header) throw new Error("Corrupt MP4 box.");
    boxes.push({ type: fourcc(head, 4), start: pos, size, header });
    pos += size;
  }
  return boxes;
}

type Parsed = {
  ftyp?: Uint8Array;
  trak: Uint8Array;
  trex: Uint8Array;
  mvhd: Uint8Array;
  trackId: number;
  timescale: number;
  fragments: Fragment[];
};

const tkhdId = (trak: Uint8Array, tkhd: Box) => {
  const p = tkhd.start + tkhd.header;
  return u32(trak, trak[p] === 1 ? p + 20 : p + 12);
};

async function parse(source: ByteSource): Promise<Parsed> {
  const top = await readTop(source);
  const ftypBox = top.find((b) => b.type === "ftyp");
  const moovBox = top.find((b) => b.type === "moov");
  if (!moovBox) throw new Error("MP4 has no moov box.");
  const moov = await source.read(moovBox.start, moovBox.size);
  const moovRoot: Box = { type: "moov", start: 0, size: moov.length, header: 8 };
  const traks = children(moov, 8).filter((b) => b.type === "trak");
  if (traks.length !== 1) throw new Error("Expected a single-track MP4.");
  const trakBox = traks[0];
  const trakBytes = moov.slice(trakBox.start, trakBox.start + trakBox.size);
  const trakRoot: Box = { type: "trak", start: 0, size: trakBytes.length, header: 8 };
  const tkhd = find(trakBytes, trakRoot, "tkhd");
  const mdia = find(trakBytes, trakRoot, "mdia");
  if (!tkhd || !mdia) throw new Error("MP4 track is incomplete.");
  const mdhd = find(trakBytes, mdia, "mdhd");
  if (!mdhd) throw new Error("MP4 track has no mdhd.");
  const mp = mdhd.start + mdhd.header;
  const timescale = u32(trakBytes, trakBytes[mp] === 1 ? mp + 20 : mp + 12) || 1;
  const trackId = tkhdId(trakBytes, tkhd);

  const mvhdBox = find(moov, moovRoot, "mvhd");
  const mvex = find(moov, moovRoot, "mvex");
  const trexBox = mvex && find(moov, mvex, "trex");
  if (!mvhdBox || !trexBox) throw new Error("MP4 is not fragmented.");

  const fragments: Fragment[] = [];
  for (let i = 0; i < top.length; i++) {
    const box = top[i];
    if (box.type !== "moof") continue;
    const next = top[i + 1];
    if (!next || next.type !== "mdat") throw new Error("Unsupported fragment layout.");
    const moof = await source.read(box.start, box.size);
    const moofRoot: Box = { type: "moof", start: 0, size: moof.length, header: 8 };
    const traf = find(moof, moofRoot, "traf");
    const tfdt = traf && find(moof, traf, "tfdt");
    if (!tfdt) throw new Error("Fragment has no tfdt.");
    const p = tfdt.start + tfdt.header;
    const t = moof[p] === 1 ? u64(moof, p + 4) : u32(moof, p + 4);
    fragments.push({
      start: box.start,
      moofSize: box.size,
      mdatStart: next.start,
      mdatSize: next.size,
      time: t / timescale,
    });
  }
  if (fragments.length === 0) throw new Error("MP4 has no fragments.");

  return {
    ftyp: ftypBox ? await source.read(ftypBox.start, ftypBox.size) : undefined,
    trak: trakBytes,
    trex: moov.slice(trexBox.start, trexBox.start + trexBox.size),
    mvhd: moov.slice(mvhdBox.start, mvhdBox.start + mvhdBox.size),
    trackId,
    timescale,
    fragments,
  };
}

async function copyRange(source: ByteSource, sink: ByteSink, start: number, length: number) {
  let done = 0;
  while (done < length) {
    const n = Math.min(CHUNK, length - done);
    await sink.write(await source.read(start + done, n));
    done += n;
  }
}

/**
 * Writes one MP4 holding both tracks. `onProgress` gets 0..1.
 * Throws if the inputs are not single-track fragmented MP4 files.
 */
export async function muxFragmentedMp4(
  video: ByteSource,
  audio: ByteSource,
  sink: ByteSink,
  onProgress?: (ratio: number) => void,
): Promise<void> {
  const v = await parse(video);
  const a = await parse(audio);

  const audioId = a.trackId === v.trackId ? v.trackId + 1 : a.trackId;
  const audioTrak = a.trak.slice();
  const audioTrex = a.trex.slice();
  const tkhd = find(audioTrak, { type: "trak", start: 0, size: audioTrak.length, header: 8 }, "tkhd")!;
  const tp = tkhd.start + tkhd.header;
  put32(audioTrak, audioTrak[tp] === 1 ? tp + 20 : tp + 12, audioId);
  put32(audioTrex, 8 + 4, audioId);

  const mvhd = v.mvhd.slice();
  const mp = 8;
  put32(mvhd, mvhd[mp] === 1 ? mp + 104 : mp + 96, Math.max(v.trackId, audioId) + 1);

  const moov = makeBox("moov", mvhd, v.trak, audioTrak, makeBox("mvex", v.trex, audioTrex));
  if (v.ftyp) await sink.write(v.ftyp);
  await sink.write(moov);

  type Item = { frag: Fragment; src: ByteSource; remap?: number };
  const items: Item[] = [
    ...v.fragments.map((frag) => ({ frag, src: video })),
    ...a.fragments.map((frag) => ({ frag, src: audio, remap: audioId !== a.trackId ? audioId : undefined })),
  ];
  // Time order; video first on ties so a keyframe leads its audio.
  items.sort((x, y) => x.frag.time - y.frag.time || (x.src === video ? -1 : 1));

  const total = items.reduce((n, i) => n + i.frag.moofSize + i.frag.mdatSize, 0);
  let written = 0;
  let sequence = 1;
  for (const item of items) {
    const moof = await item.src.read(item.frag.start, item.frag.moofSize);
    const root: Box = { type: "moof", start: 0, size: moof.length, header: 8 };
    const mfhd = find(moof, root, "mfhd");
    if (mfhd) put32(moof, mfhd.start + mfhd.header + 4, sequence++);
    const traf = find(moof, root, "traf");
    const tfhd = traf && find(moof, traf, "tfhd");
    if (!tfhd) throw new Error("Fragment has no tfhd.");
    const fp = tfhd.start + tfhd.header;
    const flags = u32(moof, fp) & 0xffffff;
    if (flags & 0x1) throw new Error("Unsupported fragment addressing.");
    if (item.remap) put32(moof, fp + 4, item.remap);
    await sink.write(moof);
    await copyRange(item.src, sink, item.frag.mdatStart, item.frag.mdatSize);
    written += item.frag.moofSize + item.frag.mdatSize;
    onProgress?.(written / total);
  }
}
