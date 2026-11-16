"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Play } from "lucide-react";
import { useState } from "react";
import { providers } from "@/lib/catalog-api";
import type { Post } from "@/lib/catalog-types";
import { Artwork, BackLink, CardGrid, CatalogSkeleton, QueryMessage, SaveButton } from "./catalog-ui";
import { HomeHero, HomeHeroSkeleton } from "./home-hero";
import { HomeShelf } from "./home-rail";
import { useRequestedPlayback } from "@/lib/requested-playback";

function cards(items: Post[]) {
  return items.flatMap(({ ref, title, videoId, image, tag }) => videoId ? [{
    href: "/youtube/" + encodeURIComponent(ref), title, image, note: tag, wide: true,
  }] : []);
}

export function YouTubeHome() {
  const [topic, setTopic] = useState("");
  const catalog = useQuery({ queryKey: ["catalog", "youtube"], queryFn: ({ signal }) => providers.catalog("youtube", signal) });
  const initial = topic || catalog.data?.[0]?.filter;
  const first = useQuery({ queryKey: ["posts", "youtube", initial, 1],
    enabled: !!initial, queryFn: ({ signal }) => providers.posts("youtube", initial!, 1, signal) });
  const fallback = !topic && first.data && !cards(first.data).length ? catalog.data?.[1]?.filter : undefined;
  const alternate = useQuery({ queryKey: ["posts", "youtube", fallback, 1],
    enabled: !!fallback, queryFn: ({ signal }) => providers.posts("youtube", fallback!, 1, signal) });
  const selected = fallback ?? initial;
  const videos = fallback ? alternate : first;
  if (catalog.isError) return <QueryMessage retry={() => void catalog.refetch()}>{catalog.error.message}</QueryMessage>;
  if (catalog.isPending) return <><HomeHeroSkeleton /><HomeShelf title="YouTube" wide pending /></>;
  const items = cards(videos.data ?? []);
  return <section aria-label="YouTube videos" className="space-y-5">
    {items.length ? <HomeHero key={selected} items={items.map((item) => ({ ...item, meta: ["YouTube", item.note].filter((value): value is string => !!value) }))} /> :
      videos.isPending ? <HomeHeroSkeleton /> : null}
    <div className="topic-rail home-topic-rail" aria-label="Topics">
      {catalog.data.map(({ title, filter }) => <button type="button" className="chip" aria-pressed={selected === filter}
        key={filter} onClick={() => setTopic(filter)}>{title}</button>)}
    </div>
    <HomeShelf title={catalog.data.find(({ filter }) => filter === selected)?.title ?? "YouTube"} href="/search"
      wide pending={videos.isPending} items={items}>
      {videos.isError ? <QueryMessage retry={() => void videos.refetch()}>{videos.error.message}</QueryMessage> :
        !videos.isPending && !items.length ? <QueryMessage>No videos are available in this topic.</QueryMessage> : undefined}
    </HomeShelf>
  </section>;
}

export function YouTubeSearch({ query }: { query: string }) {
  const result = useQuery({ queryKey: ["provider-search", "youtube", query],
    queryFn: ({ signal }) => providers.search("youtube", query, signal) });
  if (result.isPending) return <CatalogSkeleton wide />;
  if (result.isError) return <QueryMessage retry={() => void result.refetch()}>{result.error.message}</QueryMessage>;
  const items = cards(result.data);
  return items.length ? <CardGrid wide items={items} /> : <QueryMessage>No YouTube videos match “{query}”.</QueryMessage>;
}

export function YouTubeVideo({ reference }: { reference: string }) {
  const [playing, setPlaying] = useState(false);
  const result = useQuery({ queryKey: ["provider-title", "youtube", reference],
    queryFn: ({ signal }) => providers.title("youtube", reference, signal) });
  useRequestedPlayback(!!result.data?.videoId, () => setPlaying(true));
  if (result.isPending) return <CatalogSkeleton wide />;
  if (result.isError) return <QueryMessage retry={() => void result.refetch()}>{result.error.message}</QueryMessage>;
  const { title, image, synopsis, videoId } = result.data;
  if (!videoId) return <QueryMessage>This video has no YouTube ID.</QueryMessage>;
  return <>
    <BackLink />
    <div id="play" className="youtube-player">
      {playing ? <iframe title={title} src={"https://www.youtube.com/embed/" + videoId + "?autoplay=1"}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /> :
        <><Artwork src={image} className="youtube-cover" priority />
          <button type="button" className="primary-button youtube-play" onClick={() => setPlaying(true)}><Play size={18} aria-hidden="true" /> Play video</button></>}
    </div>
    <h1 className="page-heading mt-6">{title}</h1>
    <div className="flex flex-wrap gap-2">
      <SaveButton entry={{ href: "/youtube/" + encodeURIComponent(reference), title, image, layout: "youtube" }} />
      <a className="secondary-button" href={"https://www.youtube.com/watch?v=" + videoId} target="_blank" rel="noreferrer">
        Open on YouTube <ExternalLink size={16} aria-hidden="true" />
      </a>
    </div>
    {synopsis && <p className="mt-5 max-w-3xl whitespace-pre-line leading-relaxed text-muted">{synopsis}</p>}
  </>;
}
