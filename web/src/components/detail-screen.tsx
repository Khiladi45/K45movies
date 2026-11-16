"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { ArrowUpDown, ExternalLink, Play } from "lucide-react";
import { CatalogError, providers, tmdb } from "@/lib/catalog-api";
import { providerLink, titleLink } from "@/lib/catalog-links";
import type { Episode, MediaType, ProviderDetail, SourceAttempt, TitleDetail } from "@/lib/catalog-types";
import { usePlayerPreferences } from "@/lib/player-preferences";
import { usePlayback, type PlaybackTarget } from "@/lib/playback";
import { useLibrary } from "@/lib/library";
import { choicesFor, groupEpisodes, matchProvider } from "@/lib/title-bridge";
import { orderEpisodes, parseEpisodeNumber, parseSeasonNumber } from "@/lib/episodes";
import { playbackSources, qualityLabel } from "@/lib/player-switch";
import { languageName } from "@/lib/languages";
import { Artwork, BackLink, CardGrid, CatalogSkeleton, QueryMessage, Rail, SaveButton } from "./catalog-ui";
import { useCatalogReady } from "./catalog-context";
import { SourceAttempts } from "./source-attempts";
import { ProviderWait } from "./provider-wait";

function DetailHero({ title, image, backdrop, synopsis, tags, children }: {
  title: string; image?: string; backdrop?: string; synopsis?: string; tags: string[];
  children: React.ReactNode;
}) {
  return <section className="detail-hero">
    {backdrop && <Artwork src={backdrop} className="detail-backdrop" />}
    <Artwork src={image} className="detail-poster" />
    <div className="detail-copy">
      <h1>{title}</h1>
      {!!tags.length && <p className="mt-3 text-sm font-medium text-accent">{tags.join(" · ")}</p>}
      {synopsis && <p className="mt-4 max-w-2xl text-sm leading-6 text-muted sm:text-base">{synopsis}</p>}
      <div className="mt-5 flex flex-wrap gap-2">{children}</div>
    </div>
  </section>;
}

function useStartPlayback() {
  const active = useRef<AbortController>(null);
  const [status, setStatus] = useState<{ pending?: boolean; error?: string; attempts?: SourceAttempt[] }>({});
  useEffect(() => () => active.current?.abort(), []);

  function cancel() {
    active.current?.abort();
    setStatus({});
  }

  async function start(target: PlaybackTarget) {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setStatus({ pending: true });
    try {
      const sources = await playbackSources(target.item, controller.signal, target.preferredLanguage);
      if (controller.signal.aborted) return;
      const saved = useLibrary.getState().progress.find((item) => item.href === target.title.href && item.playback?.item.ref === target.item.ref);
      usePlayback.getState().open({
        target, sources, index: 0, position: usePlayerPreferences.getState().resume ? saved?.position ?? 0 : 0,
      });
      setStatus({});
    } catch (error) {
      if (!controller.signal.aborted) setStatus({
        error: error instanceof Error ? error.message : target.item.provider + " · sources · " + String(error),
        attempts: error instanceof CatalogError ? error.attempts : undefined,
      });
    }
  }

  return { ...status, start, cancel };
}

function ProviderEpisodes({ id, detail }: { id: string; detail: ProviderDetail }) {
  const [groupIndex, setGroupIndex] = useState(0);
  const [filter, setFilter] = useState("");
  const playback = useStartPlayback();
  const sortKey = id + ":" + detail.ref;
  const order = useLibrary((state) => state.episodeOrder[sortKey] ?? "asc");
  const setOrder = useLibrary((state) => state.setEpisodeOrder);
  const group = detail.groups[groupIndex];
  const series = /series|tv|show/i.test(detail.type ?? "") ||
    (!/movie/i.test(detail.type ?? "") && detail.groups.some((entry) => !!entry.episodesRef));
  const episodes = useQuery({ queryKey: ["episodes", id, group?.episodesRef],
    queryFn: ({ signal }) => groupEpisodes(id, group, signal), enabled: !!group?.episodesRef });
  if (!group) return <QueryMessage>No sources are listed for this title.</QueryMessage>;

  const items = episodes.data?.length ? episodes.data : group.directLinks;
  const ordered = series ? orderEpisodes(items) : items;
  const visible = ordered.filter((item) => item.title.toLowerCase().includes(filter.toLowerCase()));
  if (order === "desc") visible.reverse();

  function choose(episode: Episode) {
    const make = ({ ref, title }: Episode) => ({ provider: id, ref, title, series });
    void playback.start({
      title: { href: providerLink(id, detail.ref), title: detail.title, image: detail.poster ?? detail.image, layout: "provider" },
      item: make(episode), episodes: series ? ordered.map(make) : [],
      qualities: detail.groups, qualityIndex: groupIndex, itemIndex: items.indexOf(episode),
      episodeNumber: series ? parseEpisodeNumber(episode.title) ?? undefined : undefined,
      seasonNumber: series ? parseSeasonNumber(group.title) ?? undefined : undefined,
    });
  }

  return <div className="min-w-0 space-y-4">
    <div className="playback-form flex flex-wrap items-end gap-3">
      {detail.groups.length > 1 && <label className="grid min-w-0 max-w-full gap-1 text-sm font-medium">{series ? "Season or quality" : "Quality"}
        <select className="field w-full min-w-0 truncate" value={groupIndex}
          onChange={(event) => { setGroupIndex(Number(event.target.value)); playback.cancel(); setFilter(""); }}>
          {detail.groups.map((entry,i) => <option key={i} value={i}>{qualityLabel(entry)}</option>)}
        </select>
      </label>}
      {series && <>
        <label className="grid min-w-0 max-w-full gap-1 text-sm font-medium">Filter episodes
          <input className="field min-w-0" type="search" value={filter} onChange={(event) => setFilter(event.target.value)} />
        </label>
        <button className="secondary-button" type="button" onClick={() => setOrder(sortKey, order === "asc" ? "desc" : "asc")}>
          <ArrowUpDown size={16} /> {order === "asc" ? "Ascending" : "Descending"}
        </button>
      </>}
      <button className="primary-button" type="button" disabled={!ordered.length || playback.pending}
        onClick={() => choose(ordered[0])}><Play size={16} aria-hidden="true" /> {playback.pending ? "Resolving streams…" : "Watch Now"}</button>
    </div>
    {playback.pending && <ProviderWait message="Checking provider servers…" />}
    {playback.error && <div role="alert" className="text-sm text-muted">{playback.error}<SourceAttempts attempts={playback.attempts ?? []} /></div>}
    {group.episodesRef && episodes.isPending && !items.length ? <p role="status">Loading episodes…</p> :
      group.episodesRef && episodes.isError && !items.length ? <QueryMessage retry={() => void episodes.refetch()}>{episodes.error.message}</QueryMessage> :
      !visible.length ? <QueryMessage>No matching {series ? "episodes" : "sources"}.</QueryMessage> :
      (series || visible.length > 1) && <ul className="episode-grid">
        {visible.map((item,i) => <li key={item.ref + i}>
          <button type="button" className="list-row episode-row" disabled={playback.pending} onClick={() => choose(item)}>
            <Play size={16} className="shrink-0 text-accent" aria-hidden="true" /> <span>{item.title}</span>
          </button>
        </li>)}
      </ul>}
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
    <Rail title="Sources"><ProviderEpisodes key={data.ref} id={provider} detail={data} /></Rail>
    {data.cast.length > 0 && <Rail title="Cast"><p className="text-muted">{data.cast.join(" · ")}</p></Rail>}
  </>;
}

const subscribeToShareCapability = () => () => {};

function MovieChoices({ title, season, episode }: { title: TitleDetail; season: number; episode: number }) {
  const installed = useLibrary((state) => state.installed);
  const language = useLibrary((state) => state.language);
  const [selection, setSelection] = useState("");
  const playback = useStartPlayback();
  const manifest = useQuery({ queryKey: ["manifest"], queryFn: ({ signal }) => providers.manifest(signal) });
  const matching = useQueries({ queries: installed.map((provider) => ({
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
  const selected = items.find((item) => item.provider + ":" + item.episode.ref === selection) ?? items[0];
  const pending = matching.some((entry, i) => entry.isPending || (entry.isSuccess && choices[i].isPending));


  if (!installed.length) return <QueryMessage><Link href="/providers">Install a provider to find sources.</Link></QueryMessage>;

  return <div className="space-y-4">
    <ul className="flex flex-wrap gap-2" aria-label="Provider status">
      {matching.map((match,i) => {
        const provider = installed[i];
        const result = choices[i];
        const name = manifest.data?.find((entry) => entry.id === provider)?.name ?? provider;
        const failure = match.error ?? result.error;
        const failed = !!failure;
        const status = failed ? "Failed" : match.isPending || result.isPending ? "Checking…" : result.data?.length ? "Available" : "No match";
        return <li key={provider} className="chip">{name} · {status}
          {failed && <button type="button" className="ml-1 underline" onClick={() => void (match.isError ? match.refetch() : result.refetch())}>Retry</button>}
          {failure && <details className="whitespace-normal break-words"><summary>Reason</summary>{failure.message}</details>}
        </li>;
      })}
    </ul>
    {!!items.length && <div className="flex min-w-0 flex-wrap items-end gap-3">
      {items.length > 1 && <label className="grid min-w-0 max-w-full gap-1 text-sm font-medium">Quality
        <select className="field w-full min-w-0 truncate" value={selected ? items.indexOf(selected) : 0} onChange={(event) => {
          const item = items[Number(event.target.value)];
          setSelection(item.provider + ":" + item.episode.ref);
          playback.cancel();
        }}>
          {items.map((choice, index) => <option key={choice.provider + choice.episode.ref} value={index}>
            {manifest.data?.find((entry) => entry.id === choice.provider)?.name ?? choice.provider} · {choice.label}
            {choice.languages.length ? " · " + choice.languages.map(languageName).join(", ") : ""}
          </option>)}
        </select>
      </label>}
      {selected && <button type="button" className="primary-button" disabled={playback.pending} onClick={() => void playback.start({
        title: { href: titleLink(title), title: title.title, image: title.image, layout: "movie" },
        item: { provider: selected.provider, ref: selected.episode.ref, title: selected.episode.title, series: title.mediaType === "tv" },
        episodes: selected.episodes.map((item) => ({ provider: selected.provider, ref: item.ref, title: item.title, series: true })),
        qualities: selected.groups, qualityIndex: selected.groupIndex,
        itemIndex: Math.max(0, selected.groups[selected.groupIndex].directLinks.findIndex(({ ref }) => ref === selected.episode.ref)),
        episodeNumber: episode || undefined, seasonNumber: season || undefined, preferredLanguage: language,
      })}><Play size={16} aria-hidden="true" /> {playback.pending ? "Resolving streams…" : "Watch Now"}</button>}
    </div>}
    {playback.pending && <ProviderWait message="Checking provider servers…" />}
    {playback.error && <div role="alert" className="text-sm text-muted">{playback.error}<SourceAttempts attempts={playback.attempts ?? []} /></div>}
    {!items.length && <p role="status" className="text-muted">{pending ? "Checking installed providers…" : "No matching sources found."}</p>}
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
