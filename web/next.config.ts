import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const config: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: [{ key: "Permissions-Policy", value: "picture-in-picture=()" }] }];
  },
  outputFileTracingIncludes: { "/api/proxy/providers": ["./vendor/android/src/providers/**/*"] },
  turbopack: { root: fileURLToPath(new URL(".", import.meta.url)) },
};

export default config;
