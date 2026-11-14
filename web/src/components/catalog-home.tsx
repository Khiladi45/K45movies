"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useCatalogReady } from "./catalog-context";
import { Artwork, CardGrid, CatalogSkeleton, QueryMessage, Rail, type Card } from "./catalog-ui";
import { useAppearance } from "@/lib/appearance";
import { useLibrary } from "@/lib/library";
import { providers, tmdb, type MovieRow } from "@/lib/catalog-api";
import type { Category, MediaType } from "@/lib/catalog-types";
import { categoryLink, providerLink, titleLink } from "@/lib/catalog-links";

export function CatalogHome() {
  const layout = useAppearance((state) => state.layout);
  const ready = useCatalogReady();
  if (!ready) return <CatalogSkeleton />;
  return layout === "movie" ? <MovieHome /> : <ProviderHome />;
}

function ContinueWatching() {
  const layout = useAppearance((state) => state.layout);
  const progress = useLibrary((state) => state.progress);
  const dismiss = useLibrary((state) => state.dismissProgress);
  const entries = progress.filter((entry) => entry.layout === layout).slice(0, 20);
  if (!entries.length) return null;
  return <Rail title="Continue Watching">
    <ul className="poster-rail">
      {entries.map((entry) => <li key={entry.href} className="relative min-w-0">
        <Link href={entry.href} className="poster-card">
          <Artwork src={entry.image} className="aspect-video rounded-xl" />
          <progress className="w-full accent-accent" value={entry.position} max={entry.duration || 1} aria-label="Playback progress" />
          <span className="block truncate text-sm font-semibold">{entry.title}</span>
        </Link>
        <button className="icon-button absolute top-1 right-1 bg-black/80" type="button" onClick={() => dismiss(entry.href)}
          aria-label={"Dismiss " + entry.title}><X size={16} /></button>
      </li>)}
    </ul>
  </Rail>;
}

function Hero({ item, subtitle, change }: { item: Card; subtitle?: string; change?: (offset: number) => void }) {
  return <section className="catalog-hero">
    <Artwork src={item.image} className="catalog-hero-art" />
    <div className="relative max-w-xl">
      <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">{item.title}</h2>
      {subtitle && <p className="mt-3 line-clamp-3 text-sm text-muted sm:text-base">{subtitle}</p>}
      <div className="mt-5 flex flex-wrap gap-2">
        <Link className="primary-button" href={item.href}>View details</Link>
        {change && <>
          <button type="button" className="secondary-button" aria-label="Previous featured title" onClick={() => change(-1)}><ChevronLeft size={18} /></button>
          <button type="button" className="secondary-button" aria-label="Next featured title" onClick={() => change(1)}><ChevronRight size={18} /></button>
        </>}
      </div>
    </div>
  </section>;
}

function ProviderRail({ id, category }: { id: string; category: Category }) {
  const [visible, setVisible] = useState(false);
  const [node, anchor] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (visible || !node) return;
    const observe = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setVisible(true);
    }, { rootMargin: "250px" });
    observe.observe(node);
    return () => observe.disconnect();
  }, [node, visible]);
  const posts = useQuery({ queryKey: ["posts", id, category.filter, 1], queryFn: ({ signal }) => providers.posts(id, category.filter, 1, signal), enabled: visible });
  if (posts.data && !posts.data.length) return null;
  return <div ref={anchor}><Rail title={category.title} href={categoryLink(id, category.filter)}>
    {posts.isPending ? <CatalogSkeleton /> : posts.isError ? <QueryMessage retry={() => void posts.refetch()}>{posts.error.message}</QueryMessage> :
      <CardGrid rail items={posts.data.map((post) => ({ ...post, href: providerLink(id, post.ref), note: post.tag }))} />}
  </Rail></div>;
}

function ProviderHome() {
  const installed = useLibrary((state) => state.installed);
  const active = useLibrary((state) => state.activeProvider);
  const activate = useLibrary((state) => state.activate);
  const manifest = useQuery({ queryKey: ["manifest"], queryFn: ({ signal }) => providers.manifest(signal) });
  const catalog = useQuery({ queryKey: ["catalog", active], queryFn: ({ signal }) => providers.catalog(active!, signal), enabled: !!active });
  const [index, setIndex] = useState(0);
  const featured = useQueries({ queries: (active ? catalog.data?.slice(0, 4) ?? [] : []).map(({ filter }) => ({
    queryKey: ["posts", active, filter, 1],
    queryFn: ({ signal }: { signal: AbortSignal }) => providers.posts(active!, filter, 1, signal),
  })) });
  const candidates = Array.from(new Map(featured.flatMap(({ data }) => (data ?? []).slice(0, 4))
    .map((post) => [post.ref, post])).values());
  const items = candidates.filter((post) => post.image);
  const rotation = items.length ? items : candidates;
  const item = rotation[index % rotation.length];

  return <>
    <div className="mb-5 flex flex-wrap items-center gap-2" aria-label="Installed providers">
      {installed.map((id) => <button type="button" className="chip" aria-pressed={id === active} key={id} onClick={() => { activate(id); setIndex(0); }}>
        {manifest.data?.find((entry) => entry.id === id)?.name ?? id}
      </button>)}
      <Link href="/providers" className="chip">Manage providers</Link>
    </div>
    {item && active && <Hero item={{ ...item, href: providerLink(active, item.ref) }} subtitle={item.tag} change={rotation.length > 1 ? (offset) => setIndex((current) => (current + offset + rotation.length) % rotation.length) : undefined} />}
    <ContinueWatching />
    {!active ? <QueryMessage>Install a provider to browse its catalog.</QueryMessage> :
      catalog.isPending ? <CatalogSkeleton /> :
      catalog.isError ? <QueryMessage retry={() => void catalog.refetch()}>{catalog.error.message}</QueryMessage> :
      !catalog.data.length ? <QueryMessage>This provider has no categories.</QueryMessage> :
      catalog.data.map((category) => <ProviderRail key={category.filter + category.title} id={active} category={category} />)}
  </>;
}

const rows: { label: string; row: MovieRow; type: MediaType }[] = [
  { label: "Trending This Week", row: "trending", type: "movie" },
  { label: "Popular Movies", row: "popular", type: "movie" },
  { label: "Popular Series", row: "popular", type: "tv" },
  { label: "Now Playing", row: "now", type: "movie" },
  { label: "On the Air", row: "air", type: "tv" },
  { label: "Top Rated Movies", row: "top", type: "movie" },
  { label: "Top Rated Series", row: "top", type: "tv" },
  { label: "Discover Movies", row: "discover", type: "movie" },
  { label: "Discover Series", row: "discover", type: "tv" },
];

function MovieRail({ label, row, type, page, language }: typeof rows[number] & { page: number; language?: string }) {
  const catalog = useQuery({ queryKey: ["tmdb", row, type, page, language],
    queryFn: ({ signal }) => tmdb.row(row, type, page, language, signal) });
  return <Rail title={label}>
    {catalog.isPending ? <CatalogSkeleton /> :
      catalog.isError ? <QueryMessage retry={() => void catalog.refetch()}>{catalog.error.message}</QueryMessage> :
      catalog.data.items.length ? <CardGrid rail items={catalog.data.items.map((title) => ({ ...title, href: titleLink(title), note: title.year }))} /> :
      <QueryMessage>No titles found.</QueryMessage>}
  </Rail>;
}

function MovieHome() {
  const language = useLibrary((state) => state.language);
  const [page] = useState(() => 1 + Math.floor(Math.random() * 10));
  const trending = useQuery({ queryKey: ["tmdb", "trending", "movie", 1, undefined],
    queryFn: ({ signal }) => tmdb.row("trending", "movie", 1, undefined, signal) });
  const featured = trending.data?.items.find((item) => item.backdrop);
  const label = language === "none" ? null : new Intl.DisplayNames(["en"], { type: "language" }).of(language);

  if (trending.isError) return <QueryMessage retry={() => void trending.refetch()}>{trending.error.message}</QueryMessage>;

  return <>
    {featured && <Hero item={{ ...featured, href: titleLink(featured), image: featured.backdrop }} subtitle={featured.synopsis} />}
    <ContinueWatching />
    {trending.isPending ? <CatalogSkeleton /> : <>
      {label && <>
        <MovieRail label={"Popular " + label + " Movies"} row="language" type="movie" page={1} language={language} />
        <MovieRail label={"Popular " + label + " Series"} row="language" type="tv" page={1} language={language} />
      </>}
      {rows.map((row) => <MovieRail key={row.label} {...row} page={row.row === "discover" ? page : 1} />)}
    </>}
  </>;
}
