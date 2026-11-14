import "server-only";

export class HttpError extends Error {
  constructor(public status: number, message: string, public retryAfter?: string) {
    super(message);
  }
}

const windows = new Map<string, { count: number; expires: number }>();

export function rateLimit(request: Request, scope: string, limit: number) {
  // Set this only behind ingress that overwrites the named header.
  const header = process.env.K45_TRUSTED_CLIENT_IP_HEADER;
  const client = header ? request.headers.get(header)?.split(",")[0].trim().slice(0, 100) : undefined;
  const key = scope + ":" + (client || "shared");
  const now = Date.now();
  let entry = windows.get(key);
  if (!entry || entry.expires <= now) {
    for (const [existing, window] of windows) if (window.expires <= now) windows.delete(existing);
    if (windows.size >= 4096) throw new HttpError(429, "Too many requests. Try again shortly.", "60");
    entry = { count: 0, expires: now + 60_000 };
    windows.set(key, entry);
  }
  if (++entry.count > limit) {
    throw new HttpError(429, "Too many requests. Try again shortly.", String(Math.ceil((entry.expires - now) / 1000)));
  }
}

export async function jsonResponse(run: () => Promise<unknown>) {
  try {
    return Response.json(await run(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 502;
    const message = error instanceof HttpError ? error.message : "The upstream catalog is unavailable. Try again.";
    const headers = new Headers({ "Cache-Control": "no-store" });
    if (error instanceof HttpError && error.retryAfter) headers.set("Retry-After", error.retryAfter);
    return Response.json({ error: message }, { status, headers });
  }
}
