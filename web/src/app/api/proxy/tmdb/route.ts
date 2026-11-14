import { runTmdb, tmdbRequest } from "@/server/tmdb";
import { HttpError, jsonResponse, rateLimit } from "@/server/http";

export function GET(request: Request) {
  return jsonResponse(async () => {
    rateLimit(request, "tmdb", 180);
    const input = tmdbRequest.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!input.success) throw new HttpError(400, "Invalid TMDB request.");
    return runTmdb(input.data, request.signal);
  });
}
