import "server-only";
import { spawn } from "node:child_process";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeStream } from "node:stream/web";
import { HttpError } from "./http";
import type { MediaTarget } from "./media-token";
import { streamUpstream } from "./provider-network";

let active = 0;

export const compatibilityArgs = [
  "-nostdin", "-hide_banner", "-loglevel", "error", "-protocol_whitelist", "pipe",
  "-f", "matroska", "-i", "pipe:0", "-map", "0:v:0", "-map", "0:a:0?",
  "-sn", "-dn", "-c:v", "copy", "-c:a", "aac", "-ac", "2", "-b:a", "160k",
  "-movflags", "+frag_keyframe+empty_moov+default_base_moof", "-f", "mp4", "pipe:1",
];

export async function compatibleMedia(target: MediaTarget, request: Request) {
  const executable = process.env.K45_FFMPEG_PATH;
  if (!executable) throw new HttpError(404, "Compatibility conversion is disabled.");
  const headers = {
    "Content-Type": "video/mp4", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
  };
  if (request.method === "HEAD") return new Response(null, { headers });
  if (active >= 2) throw new HttpError(503, "Compatibility conversion is busy.", "3");
  active++;
  const upstream = new AbortController();
  const signal = AbortSignal.any([request.signal, upstream.signal]);
  let releaseOnClose = false;
  try {
    const outgoing = new Headers(target.headers);
    outgoing.set("accept-encoding", "identity");
    const { response } = await streamUpstream(target.url, "GET", outgoing, signal);
    if (!response.ok || !response.body || /^(?:text\/|application\/json)/i.test(response.headers.get("content-type") ?? "")) {
      void response.body?.cancel().catch(() => undefined);
      throw new HttpError(502, "Compatibility conversion could not open the upstream video.");
    }
    const child = spawn(executable, compatibilityArgs, { windowsHide: true, signal, stdio: ["pipe", "pipe", "ignore"] });
    child.on("error", () => { upstream.abort(); });
    child.once("close", () => { active--; upstream.abort(); });
    releaseOnClose = true;
    child.stdout.once("close", () => { upstream.abort(); });
    await new Promise<void>((resolve, reject) => {
      child.once("spawn", resolve);
      child.once("error", () => reject(new HttpError(503, "FFmpeg could not start.")));
    });
    void pipeline(Readable.fromWeb(response.body as NodeStream<Uint8Array>), child.stdin, { signal })
      .catch(() => { if (!signal.aborted) upstream.abort(); });
    return new Response(Readable.toWeb(child.stdout) as ReadableStream<Uint8Array>, { headers });
  } finally {
    if (!releaseOnClose) { active--; upstream.abort(); }
  }
}
