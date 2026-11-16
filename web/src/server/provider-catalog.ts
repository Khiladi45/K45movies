import "server-only";
import type { Category } from "@/lib/catalog-types";
import { providerResult } from "./provider-cache";
import { providerStore } from "./provider-store";

const legacy = new Set(["disneyPlus", "hotstar", "marvel", "netflix", "pixar", "primeVideo", "starWars"]);
const fresh = 15 * 60_000;
const maxAge = 24 * 60 * 60_000;

export function persistentCatalog(id: string, signal: AbortSignal, load: (signal: AbortSignal) => Promise<Category[]>) {
  const key = "catalog:" + id;
  if (!legacy.has(id)) return providerResult(key, 300_000, signal, load);
  const store = providerStore(id, "network");
  const refresh = (requested: AbortSignal) => providerResult("revalidate:" + key, fresh, requested, async (shared) => {
    const items = await load(shared);
    if (items.length) await store.set("catalog", { items, checkedAt: Date.now() }).catch(() => undefined);
    return items;
  });
  return providerResult(key, 30_000, signal, async (shared) => {
    const entry = await store.get("catalog").catch(() => undefined) as { items: Category[]; checkedAt: number } | undefined;
    if (!Array.isArray(entry?.items) || !entry.items.length || !Number.isFinite(entry.checkedAt)) return refresh(shared);
    const age = Date.now() - entry.checkedAt;
    if (age >= maxAge) return refresh(shared);
    if (age >= fresh) void refresh(AbortSignal.timeout(85_000)).catch(() => undefined);
    return entry.items;
  });
}
