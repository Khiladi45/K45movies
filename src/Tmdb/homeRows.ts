// The Movie Based layout's home rows, shared by the phone and TV home screens.
import { NO_LANGUAGE, languageName } from "@/lib/languages";
import {
  getDiscover,
  getNewReleasesInLanguage,
  getNowPlaying,
  getOnTheAir,
  getPopular,
  getPopularInLanguage,
  getTopRated,
  getTrending,
  type TmdbItem,
} from "@/lib/tmdbApi";

export type HomeRow = {
  title: string;
  rowKey: string;
  fetcher: (signal?: AbortSignal) => Promise<TmdbItem[]>;
};

// A different "Discover" page each time the app starts.
const DISCOVER_PAGE = 1 + Math.floor(Math.random() * 10);

/** Rows in display order; the preferred-language rows come first when set. */
export function homeRows(preferredLanguage: string | null | undefined): HomeRow[] {
  const language =
    preferredLanguage && preferredLanguage !== NO_LANGUAGE ? preferredLanguage : null;
  const rows: HomeRow[] = [];
  if (language) {
    const langName = languageName(language);
    rows.push(
      // First row: this week's releases in the preferred language, best rated first.
      {
        title: `New in ${langName} this week`,
        rowKey: `new-week-${language}`,
        fetcher: (signal) => getNewReleasesInLanguage(language, 7, signal),
      },
    );
    rows.push(
      {
        title: `Popular ${langName} Movies`,
        rowKey: `lang-movie-${language}`,
        fetcher: (signal) => getPopularInLanguage("movie", language, signal),
      },
      {
        title: `Popular ${langName} Series`,
        rowKey: `lang-tv-${language}`,
        fetcher: (signal) => getPopularInLanguage("tv", language, signal),
      },
    );
  }
  rows.push(
    { title: "Trending This Week", rowKey: "trending", fetcher: getTrending },
    { title: "Popular Movies", rowKey: "popular-movie", fetcher: (s) => getPopular("movie", s) },
    { title: "Popular Series", rowKey: "popular-tv", fetcher: (s) => getPopular("tv", s) },
    { title: "Now Playing", rowKey: "now-playing", fetcher: getNowPlaying },
    { title: "On The Air", rowKey: "on-the-air", fetcher: getOnTheAir },
    { title: "Top Rated Movies", rowKey: "top-movie", fetcher: (s) => getTopRated("movie", s) },
    { title: "Top Rated Series", rowKey: "top-tv", fetcher: (s) => getTopRated("tv", s) },
    {
      title: "Discover Movies",
      rowKey: `discover-movie-${DISCOVER_PAGE}`,
      fetcher: (s) => getDiscover("movie", DISCOVER_PAGE, s),
    },
    {
      title: "Discover Series",
      rowKey: `discover-tv-${DISCOVER_PAGE}`,
      fetcher: (s) => getDiscover("tv", DISCOVER_PAGE, s),
    },
  );
  return rows;
}

/** The "New in <language> this week" row is shown above Continue Watching. */
export const isNewReleasesRow = (row: HomeRow | undefined) =>
  !!row && row.rowKey.startsWith("new-week-");
