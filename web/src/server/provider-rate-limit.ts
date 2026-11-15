import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { rateLimit, trustedClient } from "./http";
import { referenceKey } from "./references";

const cookieName = "k45-provider-client";

function signature(value: string) {
  return createHmac("sha256", referenceKey()).update("provider-client\0" + value).digest().subarray(0, 16);
}

export function providerRateLimit(request: Request) {
  const client = trustedClient(request);
  if (client) {
    rateLimit(request, "providers", 360, "ip:" + client);
    return;
  }

  // Ingress should provide a trusted IP in production. The anonymous cookie
  // isolates browser budgets, and a shared ceiling covers disposable cookies.
  rateLimit(request, "providers-anonymous", 2400, "shared");
  const value = request.headers.get("cookie")?.match(/(?:^|;\s*)k45-provider-client=([\w-]{24})\.([\w-]{22})(?:;|$)/);
  if (value) {
    const supplied = Buffer.from(value[2], "base64url");
    const expected = signature(value[1]);
    if (supplied.length === expected.length && timingSafeEqual(supplied, expected)) {
      rateLimit(request, "providers", 360, "cookie:" + value[1]);
      return;
    }
  }
  const id = randomBytes(18).toString("base64url");
  rateLimit(request, "providers", 360, "cookie:" + id);
  return cookieName + "=" + id + "." + signature(id).toString("base64url") +
    "; Path=/api/proxy/providers; Max-Age=86400; HttpOnly; SameSite=Lax" +
    (new URL(request.url).protocol === "https:" ? "; Secure" : "");
}
