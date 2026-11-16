"use client";

import { ProviderWait } from "./provider-wait";

import Link from "next/link";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { YouTubeHome } from "./youtube";
import { BrowseModes } from "./layout-choice";
import { useCatalogReady } from "./catalog-context";
import { Artwork, CatalogSkeleton, QueryMessage } from "./catalog-ui";
import { HomeHero, HomeHeroSkeleton } from "./home-hero";
import { HomeRailViewport, HomeShelf } from "./home-rail";
import { resumePlayback } from "@/lib/player-actions";
import { useAppearance } from "@/lib/appearance";
import { useLibrary } from "@/lib/library";
import { providers, tmdb, type MovieRow } from "@/lib/catalog-api";
import type { Category, MediaType } from "@/lib/catalog-types";
import { categoryLink, providerLink, titleLink } from "@/lib/catalog-links";

export function CatalogHome() {
  const layout = useAppearance((state) => state.layout);
  const ready = useCatalogReady();
  return <div className="home-view">
    <BrowseModes />
    <div className="home-route" key={layout}>{!ready ? <HomeSkeleton /> : layout === "movie" ? <MovieHome /> :
      layout === "youtube" ? <><YouTubeHome /><ContinueWatching /></> : <ProviderHome />}</div>
  </div>;
}

function PendingRail() {
  return <div className="home-shelf mt-8" aria-hidden="true">
    <div className="mb-4 h-8 w-40 rounded-lg bg-surface" />
    <CatalogSkeleton rail />
  </div>;
}

function HomeSkeleton() {
  return <div role="status" aria-label="Loading catalog">
    <HomeHeroSkeleton />
    <PendingRail />
  </div>;
}

function ContinueWatching() {
  const layout = useAppearance((state) => state.layout);
  const progress = useLibrary((state) => state.progress);
  const dismiss = useLibrary((state) => state.dismissProgress);
  const [status, setStatus] = useState("");
  const [resuming, setResuming] = useState("");
  const entries = progress.filter((entry) => entry.layout === layout).slice(0, 20);
  if (!entries.length) return null;
  return <HomeShelf title="Continue Watching" wide>
    <p className="text-sm text-muted" role="status">{status}</p>
    <HomeRailViewport><ul className="poster-rail">
      {entries.map((entry) => <li key={entry.href} className="relative min-w-0">
        <Link href={entry.href} className="poster-card" onClick={async (event) => {
          if (!entry.playback || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          if (resuming) return;
          setResuming(entry.href);
          setStatus("Resuming " + entry.title + "…");
          try {
            const resumed = await resumePlayback(entry, AbortSignal.timeout(26000));
            setStatus(resumed ? "" : "Could not resume. Open title details to select another source.");
          } catch { setStatus("Could not resume. Open title details to select another source."); }
          finally { setResuming(""); }
        }}>
          <Artwork src={entry.image} className="aspect-video rounded-xl" />
          <progress className="w-full accent-accent" value={entry.position} max={entry.duration || 1} aria-label="Playback progress" />
          <span className="block truncate text-sm font-semibold">{entry.title}</span>
        </Link>
        {entry.playback && <Link className="text-xs text-accent" href={entry.href}>Title details</Link>}
        <button className="icon-button absolute top-1 right-1 bg-black/80" type="button" onClick={() => dismiss(entry.href)}
          aria-label={"Dismiss " + entry.title}><X size={16} /></button>
      </li>)}
    </ul></HomeRailViewport>
  </HomeShelf>;
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
  return <div ref={anchor}><HomeShelf title={category.title} href={categoryLink(id, category.filter)} pending={posts.isPending}
    items={posts.data?.map((post) => ({ ...post, href: providerLink(id, post.ref), note: post.tag }))}>
    {posts.isError ? <QueryMessage retry={() => void posts.refetch()}>{posts.error.message}</QueryMessage> : undefined}
  </HomeShelf></div>;
}

function ProviderHome() {
  const installed = useLibrary((state) => state.installed);
  const active = useLibrary((state) => state.activeProvider);
  const activate = useLibrary((state) => state.activate);
  const manifest = useQuery({ queryKey: ["manifest"], queryFn: ({ signal }) => providers.manifest(signal) });
  const missing = manifest.data?.find(({ id }) => id === active)?.addressUnavailable;
  const catalog = useQuery({ queryKey: ["catalog", active], queryFn: ({ signal }) => providers.catalog(active!, signal), enabled: !!active && !missing });
  const health = useQuery({ queryKey: ["provider-health"], queryFn: ({ signal }) => providers.health(signal) });
  const featured = useQueries({ queries: (active ? catalog.data?.slice(0, 4) ?? [] : []).map(({ filter }) => ({
    queryKey: ["posts", active, filter, 1],
    queryFn: ({ signal }: { signal: AbortSignal }) => providers.posts(active!, filter, 1, signal),
  })) });
  const candidates = Array.from(new Map(featured.flatMap(({ data }) => (data ?? []).slice(0, 4))
    .map((post) => [post.ref, post])).values());
  const items = candidates.filter((post) => post.image);
  const rotation = items.length ? items : candidates;
  const features = active ? rotation.slice(0, 6).map((item) => ({ ...item, href: providerLink(active, item.ref),
    meta: [item.title.match(/\b(?:19|20)\d{2}\b/)?.[0], item.type, item.tag].filter((value): value is string => !!value) })) : [];

  return <>
    {active && !missing && (features.length ? <HomeHero items={features} key={active} /> :
      (catalog.isPending || featured.some((query) => query.isPending)) && <HomeHeroSkeleton />)}
    <div className="provider-toolbar home-provider-toolbar">
      {!!installed.length && <label>Provider
        <select className="field" value={active ?? ""} onChange={(event) => activate(event.target.value)}>
          {installed.map((id) => <option value={id} key={id}>{manifest.data?.find((entry) => entry.id === id)?.name ?? id}</option>)}
        </select>
      </label>}
      {active && health.data?.[active] && <span className="chip capitalize" data-health={health.data[active].state}>{health.data[active].state}</span>}
      <Link href="/providers" className="secondary-button">Manage providers</Link>
    </div>
    <ContinueWatching />
    {!active ? <QueryMessage>Install a provider to browse its catalog.</QueryMessage> :
      missing ? <QueryMessage>{missing}</QueryMessage> :
      catalog.isPending ? <><ProviderWait message="Loading the provider catalog…" /><PendingRail /></> :
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
  return <HomeShelf title={label} pending={catalog.isPending}
    items={catalog.data?.items.map((title) => ({ ...title, href: titleLink(title), note: title.year }))}>
    {catalog.isError ? <QueryMessage retry={() => void catalog.refetch()}>{catalog.error.message}</QueryMessage> :
      catalog.data && !catalog.data.items.length ? <QueryMessage>No titles found.</QueryMessage> : undefined}
  </HomeShelf>;
}

function MovieHome() {
  const language = useLibrary((state) => state.language);
  const [page] = useState(() => 1 + Math.floor(Math.random() * 10));
  const trending = useQuery({ queryKey: ["tmdb", "trending", "movie", 1, undefined],
    queryFn: ({ signal }) => tmdb.row("trending", "movie", 1, undefined, signal) });
  const featured = trending.data?.items.filter((item) => item.backdrop).slice(0, 6).map((item) => ({
    ...item, href: titleLink(item),
    meta: [item.year, item.rating ? "★ " + item.rating.toFixed(1) : undefined, item.mediaType === "tv" ? "Series" : "Movie"]
      .filter((value): value is string => !!value),
  }));
  const label = language === "none" ? null : new Intl.DisplayNames(["en"], { type: "language" }).of(language);

  if (trending.isError) return <QueryMessage retry={() => void trending.refetch()}>{trending.error.message}</QueryMessage>;

  return <>
    {featured?.length ? <HomeHero items={featured} /> : trending.isPending ? <HomeHeroSkeleton /> : null}
    <ContinueWatching />
    {trending.isPending ? <PendingRail /> : <>
      {label && <>
        <MovieRail label={"Popular " + label + " Movies"} row="language" type="movie" page={1} language={language} />
        <MovieRail label={"Popular " + label + " Series"} row="language" type="tv" page={1} language={language} />
      </>}
      {rows.map((row) => <MovieRail key={row.label} {...row} page={row.row === "discover" ? page : 1} />)}
    </>}
  </>;
}
