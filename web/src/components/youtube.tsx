"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Play } from "lucide-react";
import { useState } from "react";
import { providers } from "@/lib/catalog-api";
import type { Post } from "@/lib/catalog-types";
import { Artwork, BackLink, CardGrid, CatalogSkeleton, QueryMessage, SaveButton } from "./catalog-ui";

function cards(items: Post[]) {
  return items.flatMap(({ ref, title, videoId, image, tag }) => videoId ? [{
    href: "/youtube/" + encodeURIComponent(ref), title, image, note: tag, wide: true,
  }] : []);
}

export function YouTubeHome() {
  const [topic, setTopic] = useState("");
  const catalog = useQuery({ queryKey: ["catalog", "youtube"], queryFn: ({ signal }) => providers.catalog("youtube", signal) });
  const selected = topic || catalog.data?.[0]?.filter;
  const videos = useQuery({ queryKey: ["posts", "youtube", selected, 1],
    enabled: !!selected, queryFn: ({ signal }) => providers.posts("youtube", selected!, 1, signal) });
  if (catalog.isError) return <QueryMessage retry={() => void catalog.refetch()}>{catalog.error.message}</QueryMessage>;
  if (catalog.isPending) return <CatalogSkeleton wide />;
  return <section aria-label="YouTube videos" className="space-y-5">
    <div className="topic-rail" aria-label="Topics">
      {catalog.data.map(({ title, filter }) => <button type="button" className="chip" aria-pressed={selected === filter}
        key={filter} onClick={() => setTopic(filter)}>{title}</button>)}
    </div>
    <Link className="secondary-button" href="/search">Search YouTube</Link>
    {videos.isPending ? <CatalogSkeleton wide /> : videos.isError
      ? <QueryMessage retry={() => void videos.refetch()}>{videos.error.message}</QueryMessage>
      : cards(videos.data).length ? <CardGrid wide items={cards(videos.data)} /> : <QueryMessage>No videos are available in this topic.</QueryMessage>}
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
  if (result.isPending) return <CatalogSkeleton wide />;
  if (result.isError) return <QueryMessage retry={() => void result.refetch()}>{result.error.message}</QueryMessage>;
  const { title, image, synopsis, videoId } = result.data;
  if (!videoId) return <QueryMessage>This video has no YouTube ID.</QueryMessage>;
  return <>
    <BackLink />
    <div className="youtube-player">
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
