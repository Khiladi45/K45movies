import { execFileSync } from "node:child_process";
import { test } from "node:test";

test("Sources API, media expiry, public destinations and provider cache", () => {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  execFileSync(process.execPath, ["--expose-gc", "--conditions=react-server", "--import", "tsx", "--test",
    "scripts/provider-smoke/phase5-server-checks.mts"], { env, stdio: ["ignore", "pipe", "inherit"] });
});
