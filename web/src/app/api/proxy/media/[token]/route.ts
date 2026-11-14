import { streamUpstream } from "@/server/provider-network";
import { mediaTarget } from "@/server/media-token";
import { limitedText, rewritePlaylist, toWebVtt } from "@/server/media";
import { HttpError, jsonResponse, rateLimit } from "@/server/http";

export const runtime = "nodejs";

const safeType = /^(?:video\/|audio\/|application\/(?:octet-stream|mp4|x-mpegurl|vnd\.apple\.mpegurl|ttml\+xml))|^text\/vtt/i;

async function serve(request: Request, token: string) {
  try {
    rateLimit(request, "media", 1000);
    const target = mediaTarget(token);
    const headers = new Headers(target.headers);
    headers.set("accept-encoding", "identity");
    const range = request.headers.get("range");
    if (range && target.kind === "media") {
      if (!/^bytes=(?:\d{1,16}-\d{0,16}|-\d{1,16})$/.test(range)) throw new HttpError(416, "Invalid media range.");
      headers.set("range", range);
    }
    const { response, url } = await streamUpstream(target.url, request.method, headers, request.signal);
    const bodyStream = response.body as unknown as ReadableStream<Uint8Array> | null;
    const type = response.headers.get("content-type") ?? "";
    const playlist = /mpegurl/i.test(type) || /\.m3u8$/i.test(url.pathname);
    const subtitle = target.kind === "subtitle" || /^text\/vtt/i.test(type) || /\.vtt$/i.test(url.pathname);
    const output = new Headers({
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Content-Type": playlist ? "application/vnd.apple.mpegurl" : subtitle ? "text/vtt; charset=utf-8" :
        safeType.test(type) && target.kind !== "key" ? type : "application/octet-stream",
    });
    if (response.status === 416) {
      await response.body?.cancel();
      const contentRange = response.headers.get("content-range");
      if (contentRange) output.set("content-range", contentRange);
      return new Response(null, { status: 416, headers: output });
    }
    if (!response.ok || response.status === 204) {
      await response.body?.cancel();
      throw new HttpError(response.status === 404 || response.status === 410 ? response.status : 502, "The upstream media could not be loaded.");
    }
    if (!playlist && !subtitle) {
      for (const name of ["accept-ranges", "content-range", "content-length"]) {
        const value = response.headers.get(name);
        if (value && !response.headers.get("content-encoding")) output.set(name, value);
      }
    }
    if (request.method === "HEAD") return new Response(null, { status: response.status, headers: output });
    if (playlist || subtitle) {
      const body = await limitedText(new Response(bodyStream), 2 * 1024 * 1024);
      if (playlist && !body.trimStart().startsWith("#EXTM3U")) throw new HttpError(502, "Invalid HLS playlist.");
      return new Response(playlist ? rewritePlaylist(body, url.href, target) : toWebVtt(body), { headers: output });
    }
    if (/^(?:text\/html|application\/(?:json|xml))/i.test(type)) {
      await response.body?.cancel();
      throw new HttpError(502, "The source did not return media.");
    }
    return new Response(bodyStream, { status: response.status, headers: output });
  } catch (error) {
    return jsonResponse(async () => { throw error; });
  }
}

export async function GET(request: Request, { params }: RouteContext<"/api/proxy/media/[token]">) {
  return serve(request, (await params).token);
}
export const HEAD = GET;
