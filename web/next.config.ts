import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const config: NextConfig = {
  outputFileTracingIncludes: { "/api/proxy/providers": ["./vendor/android/src/providers/**/*"] },
  turbopack: { root: fileURLToPath(new URL(".", import.meta.url)) },
};

export default config;
