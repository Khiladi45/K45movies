# GitHub Pages preview

This static build reuses the redesigned Home UI and reads the existing K45movies-api manifest and URL registry. The live `gh-pages` deployment continues to serve the old demo. The Next.js app remains the full version.

## Run locally

Run from `web/`.

```sh
npm ci
npm run build:pages
npm run preview:pages
```

Open [the static preview](http://127.0.0.1:3201/K45movies/) on the same PC. The file-only preview uses the GitHub Pages project path. The publish directory is `web/.pages/`, including `.nojekyll`.

| Layout | Available in this build | Playback |
| --- | --- | --- |
| Provider Based | Live KickAssAnime trending, popular and recent catalogs, metadata and the first Japanese episode page. If direct search is unavailable, search filters those catalog pages. | Open on the provider’s site. Its frame policy blocks embedding from GitHub Pages. |
| Movie Based | Movie and series discovery and search in a dated TMDB snapshot | Links to TMDB title pages |
| YouTube | Browse and search the video snapshot | Standard embeds where YouTube allows them, plus links to YouTube |
| Providers | Live manifest with browser eligibility shown for every listed entry | Providers without an adapter are marked unavailable in this preview |

The preview needs no changes to K45movies-api. It reads JSON and does not execute JavaScript downloaded from the provider manifest. The KickAssAnime adapter runs only while the registry publishes the tested HTTPS origin. The build ships no browser extension, CORS proxy, TMDB key or provider session.

To refresh the Movie Based and YouTube snapshots, run the full Next.js app locally and then run `node scripts/refresh-pages-catalog.mjs src/pages-preview/catalog-snapshot.json` from `web/`. The saved snapshot contains public metadata only. Viewing the built Pages files requires no Next.js process.

## Browser verification

The Chromium test served the generated frontend files at the GitHub Pages project hostname through Playwright. The catalog, artwork and YouTube requests went to their actual upstreams. [Browser results](static-preview/browser-audit.json)

| Layout | 1440 px | 390 px |
| --- | --- | --- |
| Provider Based | [Desktop](static-preview/provider-1440.png) | [Mobile](static-preview/provider-390.png) |
| Movie Based | [Desktop](static-preview/movie-1440.png) | [Mobile](static-preview/movie-390.png) |
| YouTube | [Desktop](static-preview/youtube-1440.png) | [Mobile](static-preview/youtube-390.png) |

To repeat the browser test, build the preview and install Playwright and `@axe-core/playwright` in a separate dependencies directory. Run from `web/`.

```sh
node scripts/provider-smoke/static-pages.mjs docs/static-preview PLAYWRIGHT_ROOT CHROMIUM_EXECUTABLE
```
