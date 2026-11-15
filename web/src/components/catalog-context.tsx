"use client";

import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { type ReactNode, useEffect, useState, useSyncExternalStore } from "react";
import { useAppearance } from "@/lib/appearance";
import { usePlayerPreferences } from "@/lib/player-preferences";
import { useLibrary } from "@/lib/library";
import { CatalogError, providers } from "@/lib/catalog-api";

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

function InstallDefaultProviders() {
  const ready = useCatalogReady();
  const initialized = useLibrary((state) => state.providersInitialized);
  const initialize = useLibrary((state) => state.initializeProviders);
  const manifest = useQuery({ queryKey: ["manifest"], queryFn: ({ signal }) => providers.manifest(signal), enabled: ready && !initialized });
  useEffect(() => {
    if (ready && !initialized && manifest.data) initialize(manifest.data.map(({ id }) => id));
  }, [ready, initialized, initialize, manifest.data]);
  return null;
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
    void usePlayerPreferences.persist.rehydrate();
  }, []);

  return <QueryClientProvider client={queryClient}><InstallDefaultProviders />{children}</QueryClientProvider>;
}
