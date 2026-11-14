"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useEffect, useState, useSyncExternalStore } from "react";
import { useAppearance } from "@/lib/appearance";
import { useLibrary } from "@/lib/library";
import { CatalogError } from "@/lib/catalog-api";

function subscribe(onChange: () => void) {
  const appearance = useAppearance.persist.onFinishHydration(onChange);
  const library = useLibrary.persist.onFinishHydration(onChange);
  return () => { appearance(); library(); };
}

export function useCatalogReady() {
  return useSyncExternalStore(subscribe,
    () => useAppearance.persist.hasHydrated() && useLibrary.persist.hasHydrated(),
    () => false);
}

export function CatalogContext({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: {
      staleTime: 300_000, refetchOnWindowFocus: false,
      retry: (count, error) => count < 1 && (!(error instanceof CatalogError) || error.status === 502 || error.status === 504),
    } },
  }));

  useEffect(() => {
    void useAppearance.persist.rehydrate();
    void useLibrary.persist.rehydrate();
  }, []);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
