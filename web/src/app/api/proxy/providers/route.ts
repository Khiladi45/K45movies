import { getProviders, providerRequest, runProvider } from "@/server/providers";
import { HttpError, jsonResponse, rateLimit } from "@/server/http";

export const runtime = "nodejs";

export function GET(request: Request) {
  return jsonResponse(async () => {
    const params = new URL(request.url).searchParams;
    rateLimit(request, "providers", 180);
    if (params.get("op") === "manifest") return getProviders();
    const input = providerRequest.safeParse(Object.fromEntries(params));
    if (!input.success) throw new HttpError(400, "Invalid provider request.");
    return runProvider(input.data, request.signal);
  });
}
