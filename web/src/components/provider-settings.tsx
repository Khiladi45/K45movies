"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Puzzle, RefreshCw, Trash2 } from "lucide-react";
import { providers } from "@/lib/catalog-api";
import type { Provider } from "@/lib/catalog-types";
import { useLibrary } from "@/lib/library";
import { Artwork, CatalogSkeleton, QueryMessage } from "./catalog-ui";
import { useCatalogReady } from "./catalog-context";

export function ProviderSettings() {
  const ready = useCatalogReady();
  const queryClient = useQueryClient();
  const installed = useLibrary((state) => state.installed);
  const active = useLibrary((state) => state.activeProvider);
  const activate = useLibrary((state) => state.activate);
  const remove = useLibrary((state) => state.removeProvider);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState<string>();
  const [notice, setNotice] = useState("");
  const manifest = useQuery({ queryKey: ["manifest"], queryFn: ({ signal }) => providers.manifest(signal) });

  async function select(provider: Provider) {
    setBusy(provider.id);
    setNotice("");
    try {
      await queryClient.fetchQuery({ queryKey: ["catalog", provider.id], queryFn: ({ signal }) => providers.catalog(provider.id, signal) });
      activate(provider.id);
      setNotice(provider.name + " is active.");
    } catch {
      setNotice("Could not activate " + provider.name + ". Try again.");
    } finally { setBusy(undefined); }
  }

  if (!ready || manifest.isPending) return <CatalogSkeleton />;
  if (manifest.isError) return <QueryMessage retry={() => void manifest.refetch()}>{manifest.error.message}</QueryMessage>;
  const find = filter.trim().toLowerCase();
  const list = manifest.data.filter(({ name, id }) => (name + " " + id).toLowerCase().includes(find));
  const available = new Set(manifest.data.map((entry) => entry.id));
  const missing = installed.filter((id) => !available.has(id));
  const installedList = list.filter(({ id }) => installed.includes(id));
  const availableList = list.filter(({ id }) => !installed.includes(id));
  const groups = [
    { title: "Installed", entries: installedList },
    { title: "Available", entries: availableList },
  ];

  return <>
    <div className="mb-4 flex max-w-xl gap-2">
      <input className="field min-w-0 flex-1" type="search" aria-label="Filter providers" placeholder="Filter providers"
        value={filter} onChange={(event) => setFilter(event.target.value)} />
      <button type="button" className="secondary-button" disabled={manifest.isFetching} onClick={() => void manifest.refetch()}>
        <RefreshCw size={16} aria-hidden="true" /> Refresh
      </button>
    </div>
    <div role="status" className="mb-3 text-sm text-muted">{notice}</div>
    {missing.map((id) => <div key={id} className="list-row mb-2"><span className="flex-1">{id} is no longer listed.</span>
      <button type="button" className="secondary-button" onClick={() => remove(id, manifest.data[0]?.id)}>Remove</button></div>)}
    {groups.map((group) => <section key={group.title} className="mt-6 max-w-4xl">
      <h2 className="mb-3 text-xl font-semibold">{group.title}</h2>
      {group.entries.length ? <ul className="grid gap-2">{group.entries.map((provider) => <li key={provider.id} className="list-row flex-wrap">
        {provider.icon ? <Artwork src={provider.icon} className="size-10 rounded-lg" /> : <Puzzle className="text-accent" size={23} />}
        <div className="min-w-24 flex-1">
          <strong>{provider.name}</strong>
          {provider.version && <span className="ml-2 text-xs text-muted">v{provider.version}</span>}
          {provider.description && <p className="text-sm text-muted">{provider.description}</p>}
        </div>
        {active === provider.id ? <span className="chip"><Check size={15} /> Active</span> :
          <button type="button" className="secondary-button" disabled={!!busy} onClick={() => void select(provider)}>
            {busy === provider.id ? "Connecting…" : installed.includes(provider.id) ? "Activate" : "Install"}
          </button>}
        {installed.includes(provider.id) && <button type="button" className="icon-button" aria-label={"Remove " + provider.name}
          onClick={() => {
            if (!window.confirm("Remove " + provider.name + "?")) return;
            remove(provider.id, manifest.data.find(({ id }) => id !== provider.id)?.id);
            setNotice(provider.name + " removed.");
          }}><Trash2 size={17} /></button>}
      </li>)}</ul> : <p className="text-sm text-muted">{find ? "No matching providers." : "No providers here."}</p>}
    </section>)}
    <Link href="/" className="secondary-button mt-6">Browse catalog</Link>
  </>;
}
