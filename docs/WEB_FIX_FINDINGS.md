# Website fix findings · Phase 0

Baseline measured 15 November 2026 on website commit `5c4fcd8`. The install and production build ran with Node 24.21.0 and npm 11.19.0. npm ci, build, typecheck, and lint passed, and all nine existing tests passed. npm ci reported seven moderate audit findings. Baseline work is confined to diagnostic scripts and evidence. [Expo SDK 57 reference](https://docs.expo.dev/versions/v57.0.0/)

Two Android revisions matter. The local main checkout was 42e4097. The fetched GitHub main was a77aa81 and has a different provider registry, bundles, and stream filter. Both were read and exercised from Git without switching or updating either app checkout. The findings name the revision wherever it changes the result. [Android and limit fixture output](web-phase-0/baseline.jsonl)

## A. Android reference

| Finding | Verdict | Reproduction and evidence |
| --- | --- | --- |
| A1. Metadata, dropdown and episode links | Confirmed | Android providerApi calls getMeta. DetailScreen gives SeasonList the linkList with a synthesized default when necessary. SeasonList renders one dropdown when there is more than one entry, then plays from the selected entry's directLinks or its getEpisodes result. DetailScreen passes the selected quality index and episode context to the player. Call sites inspected on both app refs. |
| A2. Stream selection | Confirmed on GitHub main; embed flag disproved on the older local main | The fixture runs both versions of streams.ts. Both repair scheme-less URLs, try the preferred entry from each server before additional streams, probe four with HEAD or ranged GET, reject an HTML response, and choose the first healthy candidate by preference order even when a later candidate finishes earlier. Adaptive checks validate the manifest prefix. GitHub main skips both synthetic download-only candidates. Local main skips the server named “Download only” and retains the raw-flagged embed. On both, an inconclusive result is eligible when no healthy result is available. |
| A3. Quality switch, decoder fallback and next episode | Confirmed | Both revisions offered the two Season 1 options and excluded Season 2 in the fixture. The switch reloaded Episode 3 and carried resume at 112 seconds. The fallback selected the lower-risk H.264 option, and the next episode helper selected Episode 4 from an unsorted list. PlayerOverlay uses these helpers for quality selection and recovery. The fixture exercises the app's functions with controlled networking and store dependencies. |

## B. Website

| Finding | Verdict | Reproduction and evidence |
| --- | --- | --- |
| B1. Two source-selection steps and player quality gap | Confirmed | Live Vega title “The Beast” offered six detail quality entries. The selected entry led to a separate list of three Play buttons. Before the server click, Playwright observed zero media proxy requests on this route. The player offered a Server picker and no title quality picker for this file. BrowserPlayer adds its Quality picker when hls.js supplies levels. It can fall back to another server and has an episode list, but gets a flat set of sources. Its post-mount check examines the first six positions and skips the selected index. GitHub Pages returned HTTP 200 and served app.js?v=cinema with the same download-label split as web/pages-demo/app.js. This split belongs to the separate static deployment. |
| B2. Runtime and WAF | Confirmed for the implementation; live WebView causation unproven | The VM throws when openWebView is called. GitHub main has the 13 named references and 18 kvStore references. The older local main has 16 and 24 respectively. These are references, so they may be conditional. The 42-provider smoke recorded 0 actual WebView calls across the sampled paths. GokuHD saw upstream 403 and a timeout. Other blocked paths included connection resets, invalid URLs, empty responses, and operation deadlines. An upstream 403 by itself does not identify an interactive challenge. The app's AsyncStorage store persists across calls. The web allocates a new Map and cookie jar on each execution and supplies only Mozilla/5.0 as commonHeaders UA. The web sets a 500 ms bundle initialization limit, a separate 1,000 ms synchronous invocation limit and 24 active executions. Android's LocalProviderRunner passes its Pixel 7 UA through providerContext and has a 30 s overall timeout. The 500 ms and 24 limits were verified in source and were not reached by the smoke workload. |
| B3. Provider network policy | Confirmed with a port qualification | A direct request to example.com:8443 was rejected before network I/O. URL parsing removes explicit default ports, so the check rejects non-default ports. provider-network.ts sets 12 s per request, a 70-hop request budget including redirects, and an 8 MiB buffered body limit. providers.ts starts the 25 s operation timer after bundle load. Live 12 s requests and ~25 s operation failures support the timers. No live workload was driven to the request or body cap. |
| B4. Shared quota, query fan-out and generic errors | Confirmed | With no trusted header configured, 181 local route requests alternating two forwarded IPs produced 180 invalid-request responses and then one 429. No external traffic was generated by the check. Movie Based uses up to four search variants per provider, then detail and episode work. The production TMDB route returned 503 for the missing credential, so the multi-provider Movie Based flow was verified from source. In the provider run the HTTP body hid the error for rejected VM calls. Test-only VM tracing recovered exceptions and detected bundle console calls. |
| B5. Settings activation and app defaults | Website confirmed; app “all installed” disproved | A fresh browser profile showed only Vega installed. Injecting a 403 with a specific cause for the other provider showed only “Could not activate Fixture Provider. Try again.” and made one catalog call. On both app refs, useProviderStore initializes only Vega and startup reconciles the active provider. Bundled providers are available to the engine and can be enabled without a bundle download. Installing all providers by default remains an explicit Phase 2 website requirement. |
| B6. Missing or filtered providers | Confirmed with a moviesApi qualification | DisneyMirror, NetflixMirror and PrimeMirror are bundled on both app refs and absent from the pinned web registry. The three web operations returned 404 at provider lookup. The manifest does list youtube, and the web filters it out. The same filter names moviesApi, but the pinned manifest already omits it and the Android ProviderManager treats it as an aggregator helper. Next.js Settings offers only Provider Based and Movie Based at baseline, so YouTube requires implementation for the three-layout requirement. |
| B7. Container and codec compatibility | Confirmed as a compatibility risk in the sample | The media table below reports real container and track evidence. On this Chrome build, platform APIs advertised native MKV H.264/AAC and HEVC in MP4. They did not advertise AC-3 or E-AC-3 support or MKV through MSE. Actual browser decode was observed for Vega's MP4 only in the screen captures. Container and codec capability alone does not prove playability of a specific stream. |
| B8. Pinned registry and API drift | Confirmed for bundles and manifest; commit equality disproved | API pin fce60ad and current API main 02f2b0e have the same manifest blob and bundled tree covering 43 bundles. They differ in urls.json, with three changed lines. The Next.js server loads the manifest and bundles and does not read urls.json itself. The repository has a scheduled URL-check workflow. The base URL is already configurable through K45MOVIES_API_BASE_URL in .env.example and web/README.md. Phase 2 should retain that documented override when adding the vendored source. |

### Browser evidence

Chrome 157.0.8103.51, Windows, Provider Based with live Vega data. The desktop viewports were 900 px high and the mobile viewport was 844 px high. Home captures show the first viewport. Detail, Player, and Settings are full-page captures, which preserve horizontal overflow. The mobile Playback settings panel was opened with Enter after a pointer attempt failed. Vega's video had readyState 4 and advanced past 0.2 seconds at each width. The mobile Detail and Player document measured 564 px wide in a 390 px viewport.

| Width | Home | Detail | Player | Settings |
| ---: | --- | --- | --- | --- |
| 1440 | [Home](web-phase-0/home-1440.png) | [Detail](web-phase-0/detail-1440.png) | [Player](web-phase-0/player-1440.png) | [Settings](web-phase-0/settings-1440.png) |
| 1024 | [Home](web-phase-0/home-1024.png) | [Detail](web-phase-0/detail-1024.png) | [Player](web-phase-0/player-1024.png) | [Settings](web-phase-0/settings-1024.png) |
| 390 | [Home](web-phase-0/home-390.png) | [Detail](web-phase-0/detail-390.png) | [Player](web-phase-0/player-390.png) | [Settings](web-phase-0/settings-390.png) |

[Browser capture data](web-phase-0/screenshots.json) · [Activation, TMDB response and browser codec capabilities](web-phase-0/ui-observations.json) · [Static GitHub Pages deployment](https://khiladi45.github.io/K45movies/)

## Provider smoke

The script runs the same provider GET handler against the default pinned registry. Each of four workers checks the first category, searches for Batman, opens one title (preferring series-tagged results), and follows its signed episode and stream references. Registered providers with interrupted upstream chains still appear in the table. The last five entries test registry rejection for the named missing or excluded IDs. The older local main also contains app-only bundles outside the website API, so they are outside the web registry smoke. The timings are wall time for one request and include wrapper work. The columns correspond to catalog, getPosts, getSearchPosts, getMeta, getEpisodes and getStream.

A pass is a usable operation response at its stage. Empty means HTTP 200 with no items. A dash means there was no valid prerequisite reference or the title supplied direct links. A Stream pass means the API returned source records. The separate media measurement checks up to three of those records through the gateway using a range request and optional ffprobe.

[Full run with timings, upstream status, exceptions and media samples](web-phase-0/provider-smoke.json)

| Registered operations | Pass | Empty | Fail | Skipped |
| --- | ---: | ---: | ---: | ---: |
| catalog | 35 | 0 | 7 | 0 |
| posts | 25 | 3 | 7 | 7 |
| search | 20 | 6 | 16 | 0 |
| meta | 24 | 0 | 1 | 17 |
| episodes | 5 | 1 | 0 | 36 |
| stream | 16 | 6 | 1 | 19 |

Timings are in milliseconds. The first 42 IDs appear in the web manifest. The other five are unavailable through the website route.

| Provider | Catalog | Posts | Search | Meta | Episodes | Stream | Observed issue |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1flex | pass · 197 | pass · 308 | pass · 236 | pass · 98 | — | pass · 15404 | — |
| 1tamilblasters | pass · 113 | HTTP 502 · 213 | HTTP 502 · 343 | — | — | — | Connection reset; Bundle lost underlying error |
| 1tamilmv | pass · 65 | pass · 706 | HTTP 502 · 377 | pass · 348 | — | — | Connection reset; Bundle lost underlying error |
| 4khdhub | pass · 163 | pass · 528 | pass · 778 | pass · 271 | — | pass · 7543 | — |
| Joya9tv | pass · 65 | HTTP 502 · 12058 | HTTP 502 · 12059 | — | — | — | Bundle lost underlying error |
| anikoto | pass · 2693 | pass · 1284 | pass · 3554 | pass · 319 | — | pass · 1370 | — |
| animesalt | pass · 142 | empty · 976 | empty · 1353 | — | — | — | — |
| animesub | pass · 64 | pass · 798 | pass · 671 | pass · 2576 | — | empty · 1619 | — |
| animeworld | pass · 99 | pass · 1011 | pass · 708 | pass · 756 | pass · 1307 | pass · 2516 | — |
| autoEmbed | pass · 91 | pass · 256 | pass · 283 | pass · 78 | — | pass · 12349 | — |
| castle | pass · 135 | pass · 6142 | pass · 881 | pass · 333 | — | pass · 537 | — |
| disneyPlus | HTTP 504 · 25046 | — | HTTP 504 · 25014 | — | — | — | 25 s operation deadline |
| drive | pass · 54 | pass · 1682 | pass · 734 | pass · 840 | — | empty · 1813 | — |
| dvdplay | pass · 45 | pass · 514 | HTTP 502 · 8 | pass · 371 | — | empty · 3368 | Bundle disables search; Upstream 403 |
| gokuHD | pass · 72 | HTTP 502 · 10683 | HTTP 502 · 12358 | — | — | — | Upstream timeout; Upstream 403 |
| hdhub4u | pass · 46 | pass · 604 | pass · 154 | pass · 1060 | — | pass · 3803 | — |
| hdmovieslife | pass · 44 | pass · 839 | empty · 929 | pass · 334 | — | pass · 18830 | — |
| hiAnime | pass · 114 | empty · 37 | empty · 38 | — | — | — | Invalid URL |
| hotstar | HTTP 504 · 25043 | — | HTTP 504 · 25011 | — | — | — | 25 s operation deadline |
| kickAssAnime | pass · 40 | pass · 904 | pass · 805 | pass · 4099 | — | pass · 3639 | — |
| kissKh | pass · 109 | pass · 525 | pass · 465 | pass · 358 | — | empty · 905 | — |
| kmMovies | pass · 133 | pass · 346 | pass · 899 | pass · 397 | — | empty · 7369 | TLS hostname mismatch |
| luxMovies | pass · 56 | pass · 605 | empty · 614 | pass · 265 | pass · 1177 | pass · 3767 | — |
| marvel | HTTP 504 · 25140 | — | HTTP 504 · 25008 | — | — | — | 25 s operation deadline |
| movieBoxWeb | pass · 151 | pass · 759 | pass · 395 | pass · 180 | pass · 23 | pass · 2090 | — |
| movielinkdb | pass · 174 | pass · 2000 | pass · 2703 | pass · 2374 | — | pass · 12564 | — |
| movies4u | pass · 148 | HTTP 502 · 12072 | HTTP 502 · 10502 | — | — | — | Bundle lost underlying error; Upstream timeout |
| moviesda | pass · 64 | pass · 642 | empty · 1183 | pass · 873 | — | pass · 2889 | — |
| movieswood | pass · 155 | HTTP 502 · 629 | HTTP 502 · 22 | — | — | — | Empty catalog page; Bundle disables search |
| moviezwap | pass · 53 | pass · 903 | pass · 847 | pass · 925 | pass · 651 | pass · 266 | — |
| multi | pass · 65 | pass · 825 | pass · 973 | pass · 614 | empty · 588 | pass · 4042 | — |
| mxplayer | pass · 58 | pass · 2134 | pass · 1976 | HTTP 404 · 1034 | — | — | Title unavailable |
| netflix | HTTP 504 · 25059 | — | HTTP 504 · 25007 | — | — | — | 25 s operation deadline |
| pixar | HTTP 504 · 25045 | — | HTTP 504 · 25014 | — | — | — | 25 s operation deadline |
| primeVideo | HTTP 504 · 25157 | — | HTTP 504 · 25016 | — | — | — | 25 s operation deadline |
| showbox | pass · 111 | pass · 2183 | pass · 2735 | pass · 1686 | pass · 265 | HTTP 502 · 256 | Upstream 404 |
| starWars | HTTP 504 · 25043 | — | HTTP 504 · 25018 | — | — | — | 25 s operation deadline |
| torrentio | pass · 129 | pass · 226 | pass · 262 | pass · 53 | — | empty · 371 | — |
| uhd | pass · 63 | HTTP 502 · 12092 | HTTP 502 · 10478 | — | — | — | Bundle lost underlying error; Upstream timeout |
| uniquestream | pass · 47 | empty · 12025 | empty · 10298 | — | — | — | Upstream timeout |
| vega | pass · 424 | pass · 493 | pass · 703 | pass · 329 | — | pass · 7356 | — |
| zeefliz | pass · 141 | HTTP 502 · 80 | HTTP 502 · 77 | — | — | — | Invalid URL |
| disneyMirror | HTTP 404 · 1 | — | HTTP 404 · 1 | — | — | — | Provider is unavailable |
| netflixMirror | HTTP 404 · 1 | — | HTTP 404 · 1 | — | — | — | Provider is unavailable |
| primeMirror | HTTP 404 · 1 | — | HTTP 404 · 1 | — | — | — | Provider is unavailable |
| youtube | HTTP 404 · 1 | — | HTTP 404 · 1 | — | — | — | Provider is unavailable |
| moviesApi | HTTP 404 · 1 | — | HTTP 404 · 1 | — | — | — | Provider is unavailable |

## Live media sample

The stream operation returned sources for 16 registered providers. The run sampled 40 candidates, and 35 returned a successful media response. 17 had a 206 response with Content-Range. ffprobe reported tracks for 29 candidates. Counts below are per candidate and may overlap across streams and mirrors.

| Container evidence | Range or playlist signature | ffprobe tracks identified | Video and audio codec incidence |
| --- | ---: | ---: | --- |
| HLS | 17 | 16 | aac 11, h264 13, png 3 |
| Matroska / EBML | 10 | 9 | aac 7, eac3 2, h264 7, hevc 2, png 2 |
| ISO BMFF / MP4 | 8 | 4 | aac 4, h264 4 |

4KHDHub returned two MKV samples with HEVC and E-AC-3. The sampled HLS manifests usually exposed H.264 and AAC, though three ffprobe results exposed only PNG tracks. Moviezwap labeled a Matroska file as MP4, and Vega labeled an MP4 file as MKV. The Vega MP4 gateway response was HTTP 200 despite the Range header. Codec detection should use measured media evidence where available. AC-3 was included in the browser capability test and was absent from the measured upstream tracks.

## Fix plan after Phase 0 approval

1. **Phase 1.** Vendor the approved Android revision's bundles and registry, plus the playback reference files. Move documentation and remove the app tree from feat/website. Verify the website install, typecheck, lint and production build. GitHub Pages currently serves the separately published demo and requires the browser extension. Remove the demo source as requested. Decide whether to keep the extension source for maintaining the existing GitHub Pages deployment.
2. **Phase 2.** Run the vendored bundles and the configured API fallback side by side. First make provider failures observable and fix runtime state and request scheduling. Reproduce each candidate WAF failure and classify those that actually require verification. Implement the requested initial provider installation separately from catalog health. Include the three app mirror IDs.
3. **Phase 3.** Verify ordered, playable sources through the media gateway before starting playback. Use linkList for quality and episode selection, with resume, next episode and codec-aware fallback. Preserve range and playlist handling.
4. **Phases 4 and 5.** Use the verified screenshots to address overflow, player controls, and alignment. Implement the required YouTube layout alongside Provider Based and Movie Based. Complete the before-and-after captures, tests, the provider re-run, and playback proof for at least ten titles.

## Re-running the baseline

Run npm ci and npm run build from web, then npm run start with --hostname 127.0.0.1 --port 3187. Set K45_SMOKE_SITE_URL for media measurement against that server and set K45_SMOKE_FFPROBE to a local ffprobe executable to record track codecs. Use the same reference key for the route runner and local server. The default local key is generated in web on first use. K45_SMOKE_QUERY overrides Batman. Additional provider IDs after the output filename narrow the run.

~~~sh
node --conditions=react-server --import tsx scripts/provider-smoke/baseline.mts
node --conditions=react-server --import tsx scripts/provider-smoke/run.mts ../docs/web-phase-0/provider-smoke.json
node scripts/provider-smoke/screenshots.mjs ../docs/web-phase-0 PATH_TO_PLAYWRIGHT_INSTALL PATH_TO_CHROME
node scripts/provider-smoke/ui-observations.mjs ../docs/web-phase-0/ui-observations.json PATH_TO_PLAYWRIGHT_INSTALL PATH_TO_CHROME
~~~

The last two commands use Playwright installed separately from the application. K45_SMOKE_WIDTHS optionally selects a comma-separated subset for a screenshot rerun. The diagnostic process observes provider exception messages, upstream status and console activity and strips URLs from error evidence. When a bundle catches an upstream error and returns an empty array, the report includes the observed status and recorded diagnostics where available.
