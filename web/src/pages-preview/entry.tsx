import { createRoot } from "react-dom/client";
import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { ArrowLeft, Film, House, Play, Puzzle, Search } from "lucide-react";
import { Artwork, QueryMessage, type Card } from "../components/catalog-ui";
import { HomeHero, HomeHeroSkeleton, type HomeFeature } from "../components/home-hero";
import { HomeShelf } from "../components/home-rail";
import { animeCollection, animeDetail, animeSearch, collections, registry, safeArtwork, videoId, type AnimeTitle } from "./runtime";
import snapshot from "./catalog-snapshot.json";

type Load<T> = { data?: T; error?: string };
const subscribe = (listener: () => void) => {
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
};
const hash = () => window.location.hash.slice(1);

function useLoad<T>(key: string, load: (signal: AbortSignal) => Promise<T>): Load<T> {
  const [settled, finish] = useState<Load<T> & { key: string }>();
  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    load(controller.signal).then((data) => {
      if (!controller.signal.aborted) finish({ key, data });
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) finish({ key, error: error instanceof Error ? error.message : "Could not load this catalog." });
    });
    return () => controller.abort();
  }, [key, load]);
  return settled?.key === key ? settled : {};
}

const modes = [
  { key: "provider", label: "Provider Based", icon: Puzzle },
  { key: "movie", label: "Movie Based", icon: Film },
  { key: "youtube", label: "YouTube", icon: Play },
] as const;
type Mode = typeof modes[number]["key"];
const has = (value: unknown): value is string => typeof value === "string" && value.length > 0;
const match = (title: string, q: string) => title.toLocaleLowerCase().includes(q.toLocaleLowerCase());
const animeCard = (show: AnimeTitle): HomeFeature => ({
  href: "#/provider/" + encodeURIComponent(show.id), title: show.title,
  image: show.image, backdrop: show.backdrop, synopsis: show.synopsis,
  meta: [show.year?.toString(), show.type === "tv" ? "Series" : show.type === "movie" ? "Movie" : undefined].filter(has), playHref: null,
});
const movieCard = (show: typeof snapshot.movies[number]): HomeFeature => ({
  href: "#/movie/" + show.mediaType + "/" + show.id, title: show.title,
  image: safeArtwork(show.image), backdrop: safeArtwork(show.backdrop), synopsis: show.synopsis,
  note: show.year, meta: [show.year, show.rating ? "★ " + show.rating.toFixed(1) : "", show.mediaType === "tv" ? "Series" : "Movie"].filter(has),
  playHref: null,
});
const videos = snapshot.youtubeRows.flatMap(({ entries }) => entries);
type Video = typeof videos[number];
const youtubeCard = (entry: Video): HomeFeature => ({
  href: "#/youtube/" + entry.videoId, playHref: "#/youtube/" + entry.videoId + "?play=1", title: entry.title,
  image: safeArtwork(entry.image), note: entry.tag, meta: ["YouTube", entry.tag].filter(has), wide: true,
});
const unique = <T extends Card>(items: T[]) => [...new Map(items.map((item) => [item.href, item])).values()];

function Shelf({ name, load, wide = false }: { name: string; load: Load<HomeFeature[]>; wide?: boolean }) {
  return <HomeShelf title={name} wide={wide} pending={!load.data && !load.error} items={load.data}>
    {load.error ? <QueryMessage>{load.error}</QueryMessage> : load.data?.length === 0 ? <QueryMessage>No results found.</QueryMessage> : undefined}
  </HomeShelf>;
}
function AnimeShelf({ title, path }: typeof collections[number]) {
  const [load] = useState(() => collectionLoader(path));
  const result = useLoad(path, load);
  return <Shelf name={title} load={{ data: result.data?.map(animeCard), error: result.error }} />;
}
const collectionLoader = (path: string) => (signal: AbortSignal) => animeCollection(path, signal);
const trendingLoad = collectionLoader(collections[0].path);
function AnimeHome({ enabled }: { enabled: boolean | undefined }) {
  const result = useLoad(enabled ? "trending" : "", trendingLoad);
  if (enabled === false) return <QueryMessage>The address published for this catalog has changed. It needs browser verification before it can be enabled again.</QueryMessage>;
  return <>
    {result.data?.length ? <HomeHero items={result.data.map(animeCard)} /> : !result.error ? <HomeHeroSkeleton /> : null}
    <p className="preview-description">Browse KickAssAnime and open episodes on the provider’s site.</p>
    <Shelf name={collections[0].title} load={{ data: result.data?.map(animeCard), error: result.error }} />
    {enabled && collections.slice(1).map((entry) => <AnimeShelf key={entry.path} {...entry} />)}
  </>;
}

function MovieHome() {
  return <>
    <HomeHero items={snapshot.movies.filter((item) => item.backdrop).map(movieCard)} />
    <p className="preview-description">Movie and series discovery snapshot from {snapshot.captured}. Title pages link to TMDB.</p>
    <HomeShelf title="Featured movies" items={snapshot.movies.filter((item) => item.mediaType === "movie").map(movieCard)} />
    <HomeShelf title="Featured series" items={snapshot.movies.filter((item) => item.mediaType === "tv").map(movieCard)} />
  </>;
}
function YouTubeHome() {
  return <>
    <HomeHero items={unique(videos.filter(({ videoId: id }) => videoId.test(id)).map(youtubeCard))} />
    {snapshot.youtubeRows.map(({ title, entries }) => <HomeShelf key={title} title={title} wide items={unique(entries.map(youtubeCard))} />)}
  </>;
}
function SearchResults({ mode, query, enabled }: { mode: Mode; query: string; enabled: boolean | undefined }) {
  const [request] = useState(() => (signal: AbortSignal) => animeSearch(query, signal));
  const anime = useLoad(mode === "provider" && enabled ? query : "", request);
  const title = "Results for “" + query + "”";
  if (mode === "provider") return <>
    {anime.data?.limited && <p role="status" className="preview-description">Provider search is unavailable. Showing matches from the preview’s catalog pages.</p>}
    <Shelf name={title} load={{
      data: anime.data?.shows.map(animeCard), error: enabled === false ? "The published provider address needs browser verification." : anime.error,
    }} />
  </>;
  const items = mode === "movie" ? snapshot.movies.filter((item) => match(item.title, query)).map(movieCard) :
    videos.filter((item) => match(item.title, query)).map(youtubeCard);
  return <Shelf name={title} wide={mode === "youtube"} load={{ data: unique(items) }} />;
}

function Detail({ item, children }: { item: HomeFeature; children: React.ReactNode }) {
  return <>
    <a className="secondary-button mb-5" href={item.href.split("/").slice(0, 2).join("/")}>
      <ArrowLeft aria-hidden="true" size={16} /> Back to catalog
    </a>
    <section className="detail-hero">
      {item.backdrop && <Artwork src={item.backdrop} className="detail-backdrop" backdrop />}
      <Artwork src={item.image} className="detail-poster" priority />
      <div className="detail-copy">
        <h1>{item.title}</h1>
        {!!item.meta?.length && <p className="mt-3 font-semibold text-accent">{item.meta.join(" · ")}</p>}
        {item.synopsis && <p className="mt-4 leading-relaxed text-muted">{item.synopsis}</p>}
      </div>
    </section>
    {children}
  </>;
}
function AnimeDetail({ slug, enabled }: { slug: string; enabled: boolean | undefined }) {
  const [request] = useState(() => (signal: AbortSignal) => animeDetail(slug, signal));
  const data = useLoad(enabled ? slug : "", request);
  if (data.error || enabled === false) return <QueryMessage>{data.error ?? "The provider address needs browser verification."}</QueryMessage>;
  if (!data.data) return <p role="status">Loading title…</p>;
  const { show, external, episodes } = data.data;
  return <Detail item={animeCard(show)}>
    <section className="mt-6 space-y-4" aria-label="Episodes">
      <a className="primary-button" href={external} target="_blank" rel="noopener noreferrer">Open on provider</a>
      <p className="text-sm text-muted">The provider’s video host allows playback on its own site.</p>
      <h2 className="text-xl font-semibold">Episodes</h2>
      {episodes.length ? <ul className="episode-grid">{episodes.map((episode) => <li className="list-row" key={episode.slug}>
        {episode.title?.trim() || "Episode " + episode.episode_string}
      </li>)}</ul> : <QueryMessage>No episodes were returned.</QueryMessage>}
    </section>
  </Detail>;
}
function MovieDetail({ type, id }: { type: string; id: string }) {
  const movie = snapshot.movies.find((item) => item.mediaType === type && String(item.id) === id);
  if (!movie) return <QueryMessage>This title is outside the current snapshot.</QueryMessage>;
  return <Detail item={movieCard(movie)}>
    <a className="secondary-button mt-6" href={"https://www.themoviedb.org/" + type + "/" + id} target="_blank" rel="noopener noreferrer">View on TMDB</a>
  </Detail>;
}
function YouTubeDetail({ id, play }: { id: string; play: boolean }) {
  const entry = videoId.test(id) ? videos.find((item) => item.videoId === id) : undefined;
  if (!entry) return <QueryMessage>This video is outside the current snapshot.</QueryMessage>;
  return <Detail item={youtubeCard(entry)}>
    <section className="youtube-player mt-6" aria-label="YouTube player">
      {play ? <iframe title={entry.title} src={"https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1"}
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen /> :
        <><Artwork src={safeArtwork(entry.image)} className="youtube-cover" />
        <a className="primary-button youtube-play" href={youtubeCard(entry).playHref ?? undefined}>Play video</a></>}
    </section>
    <a className="secondary-button mt-4" href={"https://www.youtube.com/watch?v=" + id} target="_blank" rel="noopener noreferrer">Open on YouTube</a>
  </Detail>;
}

function ProviderList({ result }: { result: Load<Awaited<ReturnType<typeof registry>>> }) {
  return <>
    <h1 className="page-heading">Providers</h1>
    {result.error ? <QueryMessage>{result.error}</QueryMessage> : !result.data ? <p role="status">Loading provider manifest…</p> :
      <ul className="grid gap-2 md:grid-cols-2">{result.data.providers.map(({ id, name }) => {
        const status = id === "youtube" ? "YouTube embeds" :
          id === "kickAssAnime" && result.data?.anime ? "Browse and search · play on provider" : "Unavailable in this preview";
        return <li className="list-row flex-wrap justify-between" key={id}><strong>{name}</strong><span className="chip">{status}</span></li>;
      })}</ul>}
  </>;
}
function SearchForm({ mode, current }: { mode: Mode; current: string }) {
  const [value, setValue] = useState(current);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    window.location.hash = "/" + mode + (value.trim() ? "?q=" + encodeURIComponent(value.trim()) : "");
  }
  return <form className="preview-search" onSubmit={submit} role="search">
    <input type="search" className="field" aria-label="Search titles" placeholder="Search titles" value={value}
      onChange={(event) => setValue(event.target.value)} minLength={2} maxLength={120} />
    <button type="submit" className="icon-button" aria-label="Search"><Search size={19} /></button>
  </form>;
}

function App() {
  const route = useSyncExternalStore(subscribe, hash, () => "");
  const [path, query] = route.split("?");
  const segments = path.split("/").filter(Boolean);
  const params = new URLSearchParams(query);
  const mode: Mode = segments[0] === "movie" || segments[0] === "youtube" ? segments[0] : "provider";
  const providerPage = segments[0] === "providers";
  const search = (params.get("q") ?? "").trim().slice(0, 120);
  const manifest = useLoad("registry", registry);
  useEffect(() => { window.scrollTo(0, 0); }, [route]);

  return <div className="site-shell pages-preview">
    <a className="skip-link" href="#preview-main" onClick={(event) => { event.preventDefault(); document.querySelector<HTMLElement>("#preview-main")?.focus(); }}>Skip to content</a>
    <header className="site-header">
      <a className="brand" href="#/provider">
        {/* eslint-disable-next-line @next/next/no-img-element -- The static logo is already a small local asset. */}
        <img src="./brand.png" alt="" width={35} height={35} />
        K45movies
      </a>
      <SearchForm key={mode + search} mode={mode} current={search} />
    </header>
    <nav className="site-nav" aria-label="Navigation">
      <a href="#/" aria-label="Home" aria-current={!providerPage ? "page" : undefined}><House size={20} aria-hidden="true" /><span>Home</span></a>
      <a href="#/providers" aria-label="Providers" aria-current={providerPage ? "page" : undefined}><Puzzle size={20} aria-hidden="true" /><span>Providers</span></a>
    </nav>
    <div className="site-content">
      <main id="preview-main" tabIndex={-1}>
        {providerPage ? <ProviderList result={manifest} /> :
          segments.length > 1 ? mode === "provider" ? <AnimeDetail key={path} slug={segments[1]} enabled={manifest.data?.anime} /> :
            mode === "movie" ? <MovieDetail type={segments[1]} id={segments[2]} /> : <YouTubeDetail id={segments[1]} play={params.has("play")} /> :
            <div className="home-view">
              <h1 className="sr-only">K45movies static preview</h1>
              <nav className="browse-modes preview-modes" aria-label="Browse layout">
                {modes.map(({ key, label, icon: Icon }) => <a key={key} href={"#/" + key} aria-current={key === mode ? "page" : undefined}><Icon size={16} aria-hidden="true" />{label}</a>)}
              </nav>
              <div className="home-route" key={mode}>
                {search.length >= 2 ? <SearchResults key={mode + search} mode={mode} query={search} enabled={manifest.data?.anime} /> :
                  mode === "movie" ? <MovieHome /> : mode === "youtube" ? <YouTubeHome /> :
                  manifest.error ? <QueryMessage>{manifest.error}</QueryMessage> : <AnimeHome enabled={manifest.data?.anime} />}
              </div>
            </div>}
      </main>
      <footer className="site-footer">
        Static preview · Movie metadata from <a href="https://www.themoviedb.org/">TMDB</a>. This product uses the TMDB API but is not endorsed or certified by TMDB.
      </footer>
    </div>
  </div>;
}

createRoot(document.getElementById("root")!).render(<App />);
