import { getProviders, providerRequest, runProvider } from "@/server/providers";
import { HttpError, jsonResponse } from "@/server/http";
import { providerRateLimit } from "@/server/provider-rate-limit";

export const runtime = "nodejs";

export async function GET(request: Request) {
  let cookie: string | undefined;
  const response = await jsonResponse(async () => {
    const params = new URL(request.url).searchParams;
    cookie = providerRateLimit(request);
    if (params.get("op") === "manifest") return getProviders();
    const input = providerRequest.safeParse(Object.fromEntries(params));
    if (!input.success) throw new HttpError(400, "Invalid provider request.");
    return runProvider(input.data, request.signal);
  });
  if (cookie) response.headers.append("Set-Cookie", cookie);
  return response;
}
