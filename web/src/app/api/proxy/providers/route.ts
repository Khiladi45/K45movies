import { getProviders, providerRequest, runProvider } from "@/server/providers";
import { getProviderHealth, ProviderError, providerIssue, recordProviderHealth } from "@/server/provider-errors";
import { providerRateLimit } from "@/server/provider-rate-limit";
import { enqueueProvider } from "@/server/provider-client-queue";
import type { ProviderStage } from "@/lib/catalog-types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const suppliedOperation = params.get("op");
  const operation = /^(manifest|health|catalog|posts|search|title|episodes|sources)$/.test(suppliedOperation ?? "")
    ? suppliedOperation! : "invalid";
  const suppliedProvider = params.get("id");
  const id = /^[\w-]{1,65}$/.test(suppliedProvider ?? "") ? suppliedProvider! : undefined;
  let stage: ProviderStage = "rate-limit";
  let cookie: string | undefined;
  let response: Response;
  try {
    const client = providerRateLimit(request);
    cookie = client.cookie;
    stage = operation === "manifest" ? "registry" : "request";
    let value;
    if (operation === "manifest") value = await getProviders();
    else if (operation === "health") value = getProviderHealth();
    else {
      const input = providerRequest.safeParse(Object.fromEntries(params));
      if (!input.success) throw new ProviderError(400, "Invalid provider request.", "request");
      value = await enqueueProvider(client.clientKey, request.signal, () => runProvider(input.data, request.signal));
      if (!Array.isArray(value) && "sources" in value) recordProviderHealth(input.data.id, operation, value.issue);
      else if (!Array.isArray(value) || value.length) recordProviderHealth(input.data.id, operation);
    }
    response = Response.json(value, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    response = providerIssue(error, id, operation, stage);
  }
  if (cookie) response.headers.append("Set-Cookie", cookie);
  return response;
}
