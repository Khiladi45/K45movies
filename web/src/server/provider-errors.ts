import "server-only";
import type { ProviderHealth, ProviderIssue, ProviderStage } from "@/lib/catalog-types";
import { HttpError } from "./http";

export class ProviderError extends HttpError {
  constructor(status: number, message: string, public stage: ProviderStage, public upstreamStatus?: number, retryAfter?: string) {
    super(status, message, retryAfter);
  }
}

export function providerMessage(error: unknown) {
  if (!error || typeof error !== "object" || !("message" in error) || typeof error.message !== "string") return "";
  return error.message.split(/\s+\|\s+[{]|\r|\n/)[0]
    .replace(/https?:\/\/[^\s"'<>]+/gi, "[url]")
    .replace(/\b(?:cookie|authorization|api[_-]?key|token|password|secret)\s*[:=]\s*[^,\s}]+/gi, "[credential]")
    .replace(/\b(?:Bearer|Basic)\s+[\w.~+/=-]+/gi, "[credential]")
    .replace(/"input"\s*:\s*"[^"]*"/gi, '"input":"[redacted]"')
    .slice(0, 200);
}

const health = new Map<string, Map<string, ProviderHealth>>();
const healthTtl = 10 * 60_000;

export function recordProviderHealth(id: string, operation: string, issue?: ProviderIssue) {
  if (!["catalog", "posts", "search", "title", "episodes", "sources"].includes(operation)) return;
  if (issue && ["request", "registry", "rate-limit", "queue"].includes(issue.stage)) return;
  if (!health.has(id) && health.size >= 256) {
    const oldest = health.keys().next().value;
    if (oldest !== undefined) health.delete(oldest);
  }
  let operations = health.get(id);
  if (!operations) health.set(id, operations = new Map());
  operations.set(operation, {
    state: issue ? issue.stage === "verification" ? "needs verification" : "degraded" : "healthy",
    checkedAt: Date.now(), issue,
  });
}

export function getProviderHealth() {
  const states: Record<string, ProviderHealth> = Object.create(null);
  for (const [id, checks] of health) {
    const recent = [...checks.values()].filter(({ checkedAt }) => Date.now() - checkedAt < healthTtl);
    const last = recent.sort((a, b) => b.checkedAt - a.checkedAt);
    const state = last.find(({ state }) => state === "needs verification") ??
      last.find(({ state }) => state === "degraded") ?? last[0];
    if (state) states[id] = state;
  }
  return states;
}

export function providerIssue(error: unknown, provider: string | undefined, operation: string, stage: ProviderStage) {
  const specific = error instanceof ProviderError ? error : undefined;
  const http = error instanceof HttpError ? error : undefined;
  const details: ProviderIssue = {
    provider, operation, stage: specific?.stage ?? stage, upstreamStatus: specific?.upstreamStatus,
    message: providerMessage(error) || "Provider returned an unrecognized failure.",
  };
  if (provider) recordProviderHealth(provider, operation, details);
  console.warn("Provider request failed", details);
  const headers = new Headers({ "Cache-Control": "no-store" });
  if (http?.retryAfter) headers.set("Retry-After", http.retryAfter);
  return Response.json({ error: details.message, details }, { status: http?.status ?? 502, headers });
}
