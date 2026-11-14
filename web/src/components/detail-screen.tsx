"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { ArrowUpDown, ExternalLink, Play } from "lucide-react";
import { providers, tmdb } from "@/lib/catalog-api";
import { providerLink, titleLink } from "@/lib/catalog-links";
import type { Episode, MediaType, ProviderDetail, TitleDetail } from "@/lib/catalog-types";
import { usePlayerPreferences } from "@/lib/player-preferences";
import { usePlayback, type PlaybackTarget } from "@/lib/playback";
import { useLibrary } from "@/lib/library";
import { choicesFor, episodeNumber, groupEpisodes, matchProvider, streamLanguages, type Choice } from "@/lib/title-bridge";
import { languageName } from "@/lib/languages";
import { Artwork, BackLink, CardGrid, CatalogSkeleton, QueryMessage, Rail, SaveButton } from "./catalog-ui";
import { useCatalogReady } from "./catalog-context";

function DetailHero({ title, image, backdrop, synopsis, tags, children }: {
  title: string; image?: string; backdrop?: string; synopsis?: string; tags: string[];
  children: React.ReactNode;
}) {
  return <section className="detail-hero">
    {backdrop && <Artwork src={backdrop} className="detail-backdrop" />}
    <Artwork src={image} className="detail-poster" />
    <div className="relative min-w-0">
      <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">{title}</h1>
      {!!tags.length && <p className="mt-3 text-sm font-medium text-accent">{tags.join(" · ")}</p>}
      {synopsis && <p className="mt-4 max-w-2xl text-sm leading-6 text-muted sm:text-base">{synopsis}</p>}
      <div className="mt-5 flex flex-wrap gap-2">{children}</div>
    </div>
  </section>;
}

function SourceList({ choice, series, language, target }: { choice: Choice; series: boolean; language: string; target: PlaybackTarget }) {
  const query = useQuery({ queryKey: ["sources", choice.provider, choice.episode.ref, series],
    queryFn: ({ signal }) => providers.sources(choice.provider, choice.episode.ref, series ? "series" : "movie", signal),
    staleTime: 60_000, gcTime: 120_000,
  });
  if (query.isPending) return <p className="text-muted" role="status">Resolving playback sources…</p>;
  if (query.isError) return <QueryMessage retry={() => void query.refetch()}>{query.error.message}</QueryMessage>;
  if (!query.data.length) return <QueryMessage>No sources were returned for this selection.</QueryMessage>;
  const hasLanguage = (values: string[]) => streamLanguages(values).includes(language);
  const list = [...query.data].sort((a,b) => Number(hasLanguage(b.languages)) - Number(hasLanguage(a.languages)));
  return <section aria-label="Available servers">
    <h3 className="mb-3 font-semibold">{choice.label} servers</h3>
    {language !== "none" && !choice.languages.includes(language) && !list.some((entry) => hasLanguage(entry.languages)) &&
      <p className="mb-3 text-sm text-muted">{languageName(language)} audio could not be confirmed from source metadata.</p>}
    <ul className="grid gap-2">
      {list.map((entry,i) => <li className="list-row" key={entry.server + i}>
        <button type="button" className="primary-button" onClick={() => {
          const resume = useLibrary.getState().progress.find((item) => item.href === target.title.href && item.playback?.item.ref === target.item.ref);
          usePlayback.getState().open({ target, sources: list, index: i, position: usePlayerPreferences.getState().resume ? resume?.position ?? 0 : 0 });
        }}><Play size={16} aria-hidden="true" /> Play {entry.server}</button>
        {(entry.quality || entry.type) && <span className="text-sm text-muted">{[entry.quality, entry.type].filter(Boolean).join(" · ")}</span>}
        {entry.languages.length > 0 && <span className="text-sm text-muted">{streamLanguages(entry.languages).map(languageName).join(", ")}</span>}
      </li>)}
    </ul>
  </section>;
}

function ProviderEpisodes({ id, detail }: { id: string; detail: ProviderDetail }) {
  const [groupIndex, setGroupIndex] = useState(0);
  const [filter, setFilter] = useState("");
  const [choice, select] = useState<Choice | null>(null);
  const sortKey = id + ":" + detail.ref;
  const order = useLibrary((state) => state.episodeOrder[sortKey] ?? "asc");
  const setOrder = useLibrary((state) => state.setEpisodeOrder);
  const group = detail.groups[groupIndex];
  const series = /series|tv|show/i.test(detail.type ?? "") || detail.groups.some((entry) => !!entry.episodesRef);
  const episodes = useQuery({ queryKey: ["episodes", id, group?.episodesRef],
    queryFn: ({ signal }) => groupEpisodes(id, group, signal), enabled: !!group?.episodesRef });
  if (!group) return <QueryMessage>No sources are listed for this title.</QueryMessage>;

  const items = group.episodesRef ? episodes.data ?? [] : group.directLinks;
  const visible = items.filter((item) => item.title.toLowerCase().includes(filter.toLowerCase()));
  if (series && visible.every((item) => episodeNumber(item.title) !== undefined)) {
    visible.sort((a,b) => episodeNumber(a.title)! - episodeNumber(b.title)!);
  }
  if (order === "desc") visible.reverse();

  function choose(episode: Episode) {
    select({ provider: id, episode, episodes: items, label: group.quality || group.title, languages: [] });
  }

  return <div className="space-y-4">
    <div className="flex flex-wrap items-end gap-3">
      <label className="grid gap-1 text-sm font-medium">{series ? "Season or quality" : "Quality"}
        <select className="field" value={groupIndex} onChange={(event) => { setGroupIndex(Number(event.target.value)); select(null); setFilter(""); }}>
          {detail.groups.map((entry,i) => <option key={i} value={i}>{entry.title}{entry.quality && !entry.title.includes(entry.quality) ? " · " + entry.quality : ""}</option>)}
        </select>
      </label>
      {series && <>
        <label className="grid gap-1 text-sm font-medium">Filter episodes
          <input className="field" type="search" value={filter} onChange={(event) => setFilter(event.target.value)} />
        </label>
        <button className="secondary-button" type="button" onClick={() => setOrder(sortKey, order === "asc" ? "desc" : "asc")}>
          <ArrowUpDown size={16} /> {order === "asc" ? "Ascending" : "Descending"}
        </button>
      </>}
    </div>
    {group.episodesRef && episodes.isPending ? <p role="status">Loading episodes…</p> :
      group.episodesRef && episodes.isError ? <QueryMessage retry={() => void episodes.refetch()}>{episodes.error.message}</QueryMessage> :
      !visible.length ? <QueryMessage>No matching {series ? "episodes" : "sources"}.</QueryMessage> :
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((item,i) => <li key={item.ref + i}>
          <button type="button" className="list-row w-full text-left" aria-pressed={choice?.episode.ref === item.ref} onClick={() => choose(item)}>
            <Play size={16} className="shrink-0 text-accent" /> <span>{item.title}</span>
          </button>
        </li>)}
      </ul>}
    {choice && <SourceList choice={choice} series={series} language="none" target={{
      title: { href: providerLink(id, detail.ref), title: detail.title, image: detail.poster ?? detail.image, layout: "provider" },
      item: { provider: id, ref: choice.episode.ref, title: choice.episode.title, series },
      episodes: series ? [...items].sort((a, b) => (episodeNumber(a.title) ?? Infinity) - (episodeNumber(b.title) ?? Infinity))
        .map((episode) => ({ provider: id, ref: episode.ref, title: episode.title, series })) : [],
    }} />}
  </div>;
}

export function ProviderTitle({ provider, reference }: { provider: string; reference: string }) {
  const detail = useQuery({ queryKey: ["provider-title", provider, reference], queryFn: ({ signal }) => providers.title(provider, reference, signal) });
  const ready = useCatalogReady();
  if (!ready || detail.isPending) return <><BackLink /><CatalogSkeleton /></>;
  if (detail.isError) return <><BackLink /><QueryMessage retry={() => void detail.refetch()}>{detail.error.message}</QueryMessage></>;
  const data = detail.data;

  return <>
    <BackLink />
    <DetailHero title={data.title} image={data.poster ?? data.image} backdrop={data.poster ? data.image : undefined}
      synopsis={data.synopsis} tags={[...data.tags, ...(data.rating ? [data.rating] : [])]}>
      <SaveButton entry={{ href: providerLink(provider, reference), title: data.title, image: data.poster ?? data.image, layout: "provider" }} />
    </DetailHero>
    {data.cast.length > 0 && <Rail title="Cast"><p className="text-muted">{data.cast.join(" · ")}</p></Rail>}
    <Rail title="Sources"><ProviderEpisodes key={data.ref} id={provider} detail={data} /></Rail>
  </>;
}

const subscribeToShareCapability = () => () => {};

function MovieChoices({ title, season, episode }: { title: TitleDetail; season: number; episode: number }) {
  const installed = useLibrary((state) => state.installed);
  const language = useLibrary((state) => state.language);
  const [selected, setSelected] = useState<Choice | null>(null);
  const [checked, setChecked] = useState(3);
  const manifest = useQuery({ queryKey: ["manifest"], queryFn: ({ signal }) => providers.manifest(signal) });
  const matching = useQueries({ queries: installed.slice(0,checked).map((provider) => ({
    queryKey: ["title-match", provider, title.mediaType, title.id],
    queryFn: ({ signal }: { signal: AbortSignal }) => matchProvider(provider, title, signal),
  })) });
  const choices = useQueries({ queries: matching.map((match, i) => ({
    queryKey: ["title-choices", installed[i], title.mediaType, title.id, season, episode, match.data?.map(({ post }) => post.ref)],
    queryFn: ({ signal }: { signal: AbortSignal }) => choicesFor(installed[i], match.data ?? [], season, episode, title.seasons.length, signal),
    enabled: !!match.data,
  })) });
  const items = choices.flatMap((entry) => entry.data ?? []).sort((a,b) =>
    Number(b.languages.includes(language)) - Number(a.languages.includes(language)));
  const pending = matching.some((entry, i) => entry.isPending || (entry.isSuccess && choices[i].isPending));

  useEffect(() => {
    if (pending || checked >= installed.length) return;
    const timer = window.setTimeout(() => setChecked((current) => current + 3), 0);
    return () => window.clearTimeout(timer);
  }, [checked, installed.length, pending]);

  if (!installed.length) return <QueryMessage><Link href="/providers">Install a provider to find sources.</Link></QueryMessage>;

  return <div className="space-y-4">
    <ul className="flex flex-wrap gap-2" aria-label="Provider status">
      {matching.map((match,i) => {
        const provider = installed[i];
        const result = choices[i];
        const name = manifest.data?.find((entry) => entry.id === provider)?.name ?? provider;
        const failed = match.isError || result.isError;
        const status = failed ? "Failed" : match.isPending || result.isPending ? "Checking…" : result.data?.length ? "Available" : "No match";
        return <li key={provider} className="chip">{name} · {status}
          {failed && <button type="button" className="ml-1 underline" onClick={() => void (match.isError ? match.refetch() : result.refetch())}>Retry</button>}
        </li>;
      })}
    </ul>
    {checked < installed.length && <p className="text-sm text-muted">{installed.length - checked} providers queued</p>}
    {!!items.length && <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((choice) => <li key={choice.provider + choice.episode.ref}>
        <button type="button" className="list-row w-full text-left" aria-pressed={selected?.episode.ref === choice.episode.ref}
          onClick={() => setSelected(choice)}>
          <Play size={16} className="shrink-0 text-accent" />
          <span><strong className="block">{choice.label}</strong>
          <span className="text-sm text-muted">{manifest.data?.find((e) => e.id === choice.provider)?.name ?? choice.provider}
            {choice.languages.length ? " · " + choice.languages.map(languageName).join(", ") : ""}</span></span>
        </button>
      </li>)}
    </ul>}
    {!items.length && <p role="status" className="text-muted">{pending ? "Checking installed providers…" : "No matching sources found."}</p>}
    {selected && <SourceList choice={selected} series={title.mediaType === "tv"} language={language} target={{
      title: { href: titleLink(title), title: title.title, image: title.image, layout: "movie" },
      item: { provider: selected.provider, ref: selected.episode.ref, title: selected.episode.title, series: title.mediaType === "tv" },
      episodes: selected.episodes.map((item) => ({ provider: selected.provider, ref: item.ref, title: item.title, series: true })),
      episodeNumber: episode || undefined, seasonNumber: season || undefined, preferredLanguage: language,
    }} />}
  </div>;
}

function MovieEpisodes({ title }: { title: TitleDetail }) {
  const [season, setSeason] = useState(title.seasons[0]?.number ?? 0);
  const [episode, setEpisode] = useState(0);
  const query = useQuery({ queryKey: ["tmdb-season", title.id, season],
    queryFn: ({ signal }) => tmdb.season(title.id, season, signal), enabled: season > 0 });
  const selected = query.data?.find((item) => item.number === episode);
  return <div className="space-y-4">
    {title.seasons.length > 0 ? <label className="grid w-fit gap-1 text-sm font-medium">Season
      <select className="field" aria-label="Season" value={season} onChange={(event) => { setSeason(Number(event.target.value)); setEpisode(0); }}>
        {title.seasons.map((entry) => <option key={entry.number} value={entry.number}>{entry.name}</option>)}
      </select>
    </label> : <QueryMessage>No seasons are listed.</QueryMessage>}
    {season > 0 && (query.isPending ? <p role="status">Loading episodes…</p> :
      query.isError ? <QueryMessage retry={() => void query.refetch()}>{query.error.message}</QueryMessage> :
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{query.data.map((entry) => <li key={entry.number}>
        <button type="button" className="list-row w-full text-left" onClick={() => setEpisode(entry.number)} aria-pressed={episode === entry.number}>
          <span className="text-accent">{entry.number}</span><span>{entry.name}</span>
        </button>
      </li>)}</ul>)}
    {selected && <section className="empty-panel">
      <h3 className="mb-3 font-semibold text-white">{selected.name}</h3>
      {selected.overview && <p className="mb-4">{selected.overview}</p>}
      <MovieChoices key={season + ":" + episode} title={title} season={season} episode={episode} />
    </section>}
  </div>;
}

export function MovieTitle({ type, id }: { type: MediaType; id: number }) {
  const ready = useCatalogReady();
  const query = useQuery({ queryKey: ["tmdb-title", type, id], queryFn: ({ signal }) => tmdb.title(type, id, signal) });
  const canShare = useSyncExternalStore(subscribeToShareCapability, () => !!navigator.share || !!navigator.clipboard, () => false);
  const [copyStatus, setCopyStatus] = useState("");
  if (!ready || query.isPending) return <><BackLink /><CatalogSkeleton /></>;
  if (query.isError) return <><BackLink /><QueryMessage retry={() => void query.refetch()}>{query.error.message}</QueryMessage></>;
  const title = query.data;
  const tags = [title.year, title.certification, title.runtime ? title.runtime + " min" : "", ...title.genres].filter((value): value is string => !!value);
  return <>
    <BackLink />
    <DetailHero title={title.title} image={title.image} backdrop={title.backdrop} synopsis={title.synopsis} tags={tags}>
      <SaveButton entry={{ href: titleLink(title), layout: "movie", title: title.title, image: title.image, note: title.year }} />
      {title.trailer && <a className="secondary-button" href={title.trailer} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Trailer</a>}
      {canShare && <button type="button" className="secondary-button" onClick={async () => {
        try {
          if (navigator.share) await navigator.share({ title: title.title, url: location.href });
          else { await navigator.clipboard.writeText(location.href); setCopyStatus("Link copied."); }
        } catch (error) {
          if (!(error instanceof DOMException && error.name === "AbortError")) setCopyStatus("Could not share this title.");
        }
      }}>Share</button>}
      <span role="status" className="text-sm text-muted">{copyStatus}</span>
    </DetailHero>
    <Rail title={type === "tv" ? "Episodes" : "Sources"}>
      {type === "tv" ? <MovieEpisodes title={title} /> : <MovieChoices title={title} season={0} episode={0} />}
    </Rail>
    {!!title.cast.length && <Rail title="Cast">
      <ul className="flex gap-4 overflow-auto pb-2">{title.cast.map((person,i) => <li key={i} className="w-24 shrink-0">
        <Artwork src={person.image} className="aspect-square rounded-xl" />
        <p className="mt-1 text-sm font-semibold">{person.name}</p><p className="text-xs text-muted">{person.character}</p>
      </li>)}</ul>
    </Rail>}
    {!!title.similar.length && <Rail title="More Like This"><CardGrid rail items={title.similar.map((item) => ({ ...item, href: titleLink(item), note: item.year }))} /></Rail>}
  </>;
}
