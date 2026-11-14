"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { useInfiniteQuery, useQueries, useQuery } from "@tanstack/react-query";
import { useCatalogReady } from "./catalog-context";
import { Artwork, BackLink, CardGrid, CatalogSkeleton, QueryMessage, type Card } from "./catalog-ui";
import { LoadMore } from "./load-more";
import { PageHeading } from "./page-heading";
import { useAppearance } from "@/lib/appearance";
import { useLibrary } from "@/lib/library";
import { providers, tmdb } from "@/lib/catalog-api";
import { providerLink, titleLink } from "@/lib/catalog-links";

function unique(cards: Card[]) {
  return Array.from(new Map(cards.map((card) => [card.href, card])).values());
}

export function ProviderCategory({ id, filter }: { id: string; filter: string }) {
  const catalog = useQuery({ queryKey: ["catalog", id], queryFn: ({ signal }) => providers.catalog(id, signal) });
  const selected = catalog.data?.find((entry) => entry.filter === filter);
  const pages = useInfiniteQuery({
    queryKey: ["category", id, filter],
    queryFn: ({ pageParam, signal }) => providers.posts(id, filter, pageParam, signal),
    initialPageParam: 1, enabled: !!selected,
    getNextPageParam: (last, all, page) => page < 150 && last.some((post) => !all.slice(0, -1).some((prev) => prev.some(({ ref }) => ref === post.ref))) ? page + 1 : undefined,
  });

  const items = unique((pages.data?.pages.flat() ?? []).map((post) => ({ ...post, href: providerLink(id, post.ref), note: post.tag })));
  return <>
    <BackLink />
    <PageHeading title={selected?.title ?? "Category"} />
    {catalog.isError ? <QueryMessage retry={() => void catalog.refetch()}>{catalog.error.message}</QueryMessage> :
      catalog.isPending ? <CatalogSkeleton /> : !selected ? <QueryMessage>Category unavailable.</QueryMessage> :
      pages.isPending ? <CatalogSkeleton /> :
      !items.length && !pages.isError ? <QueryMessage>No titles found.</QueryMessage> : <CardGrid items={items} />}
    {pages.isError && <QueryMessage retry={() => void (items.length ? pages.fetchNextPage() : pages.refetch())}>{pages.error.message}</QueryMessage>}
    {pages.hasNextPage && !pages.isError && <LoadMore pending={pages.isFetchingNextPage} load={() => void pages.fetchNextPage()} />}
  </>;
}

function SearchHistory() {
  const history = useLibrary((state) => state.history);
  const remove = useLibrary((state) => state.removeSearch);
  const clear = useLibrary((state) => state.clearSearch);
  if (!history.length) return null;
  return <section className="mb-6">
    <div className="mb-3 flex max-w-xl items-center justify-between gap-4">
      <h2 className="text-lg font-semibold">Recent searches</h2>
      <button type="button" className="text-sm text-accent" onClick={clear}>Clear history</button>
    </div>
    <ul className="flex flex-wrap gap-2">
      {history.map((q) => <li className="search-history" key={q}>
        <Link href={"/search?" + new URLSearchParams({ q })}>{q}</Link>
        <button type="button" aria-label={"Remove " + q} onClick={() => remove(q)}><X size={14} /></button>
      </li>)}
    </ul>
  </section>;
}

function ProviderSearch({ q }: { q: string }) {
  const installed = useLibrary((state) => state.installed);
  const results = useQueries({ queries: installed.map((id) => ({
    queryKey: ["provider-search", id, q],
    queryFn: ({ signal }: { signal: AbortSignal }) => providers.search(id, q, signal),
  })) });
  const manifest = useQuery({ queryKey: ["manifest"], queryFn: ({ signal }) => providers.manifest(signal) });
  const items = unique(results.flatMap((result, index) => {
    const id = installed[index];
    return (result.data ?? []).map((post) => ({ ...post, href: providerLink(id, post.ref), note: manifest.data?.find((provider) => provider.id === id)?.name ?? id }));
  }));
  const pending = results.some((result) => result.isPending);
  const failed = results.filter((result) => result.isError);
  if (!installed.length) return <QueryMessage><Link href="/providers">Install a provider to search.</Link></QueryMessage>;
  return <>
    {!!items.length && <CardGrid items={items} />}
    {pending && (!items.length ? <CatalogSkeleton /> : <p className="mt-4 text-muted" role="status">Searching more providers…</p>)}
    {!!failed.length && <QueryMessage retry={() => { for (const result of failed) void result.refetch(); }}>
      {failed.length === results.length ? "Provider search failed." : "Some providers could not be searched."}
    </QueryMessage>}
    {!pending && !failed.length && !items.length && <QueryMessage>No titles match “{q}”.</QueryMessage>}
  </>;
}

function MovieSearch({ q }: { q: string }) {
  const results = useInfiniteQuery({
    queryKey: ["tmdb-search", q], initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => tmdb.search(q, pageParam, signal),
    getNextPageParam: (last, _, page) => last.more ? page + 1 : undefined,
  });
  if (results.isPending) return <CatalogSkeleton />;
  const items = unique((results.data?.pages.flatMap((page) => page.items) ?? []).map((title) => ({ ...title, href: titleLink(title), note: title.year })));
  return <>
    {items.length ? <CardGrid items={items} /> : !results.isError && <QueryMessage>No titles match “{q}”.</QueryMessage>}
    {results.isError && <QueryMessage retry={() => void (items.length ? results.fetchNextPage() : results.refetch())}>{results.error.message}</QueryMessage>}
    {results.hasNextPage && !results.isError && <LoadMore pending={results.isFetchingNextPage} load={() => void results.fetchNextPage()} />}
  </>;
}

export function SearchResults({ q }: { q: string }) {
  const ready = useCatalogReady();
  const layout = useAppearance((state) => state.layout);
  if (!ready) return <CatalogSkeleton />;
  if (q.length < 2) return <SearchHistory />;
  return layout === "movie" ? <MovieSearch q={q} /> : <ProviderSearch q={q} />;
}

export function Watchlist() {
  const ready = useCatalogReady();
  const layout = useAppearance((state) => state.layout);
  const saved = useLibrary((state) => state.watchlist);
  const toggle = useLibrary((state) => state.toggleSaved);
  if (!ready) return <CatalogSkeleton />;
  const items = saved.filter((entry) => entry.layout === layout);
  return items.length ? <ul className="grid gap-3">
    {items.map((entry) => <li className="list-row" key={entry.href}>
      <Link className="flex min-w-0 flex-1 items-center gap-3 font-semibold hover:text-accent" href={entry.href}>
        <Artwork src={entry.image} className="aspect-[2/3] max-w-10 shrink-0 rounded-md" />
        <span>{entry.title}{entry.note && <span className="block text-xs text-muted">{entry.note}</span>}</span>
      </Link>
      <button className="icon-button" type="button" aria-label={"Remove " + entry.title} onClick={() => toggle(entry)}><X size={18} /></button>
    </li>)}
  </ul> : <QueryMessage><p>Your watchlist is empty.</p><Link className="primary-button mt-4" href="/">Browse titles</Link></QueryMessage>;
}
