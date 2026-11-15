# Phase 2 · Provider engine parity

Measured 15 November 2026 using the pinned Android reference at a77aa81 and the provider API fallback at fce60ad. The website registry now lists 45 providers. It loads 38 vendored bundles and seven fallback API bundles. The Android registry's 39th entry is YouTube, whose website layout is scheduled for Phase 4. The API manifest supplies names and icons when available. The website continues to list the vendored entries if the fallback manifest cannot load.

## Provider smoke

Each column counts the providers with a usable result at that stage. The run uses one sample title per provider. An empty response, a failed operation, and a skipped operation are tracked separately in the evidence. Resolved source records do not establish browser playback.

| Operation | Pass before | Pass after | Fail before | Fail after |
| --- | ---: | ---: | ---: | ---: |
| Catalog | 35 | 38 | 7 | 7 |
| Posts | 25 | 27 | 7 | 7 |
| Search | 20 | 23 | 16 | 18 |
| Metadata | 24 | 29 | 1 | 1 |
| Episodes | 5 | 5 | 0 | 0 |
| Stream resolution | 16 | 20 | 1 | 1 |

Posts recovered in the full run for 1TamilBlasters and MoviesWood. KmMovies returned a source for the same title while another candidate still showed a TLS hostname mismatch. Search pass count among the original 42 stayed at 20. The three new mirrors account for the additional search passes. HiAnime and UniqueStream now report live invalid-URL or timeout errors where the baseline returned empty results.

[Pre-change classification](WEB_PROVIDER_CLASSIFICATION.md) · [Before traces](web-phase-0/provider-smoke.json) · [After traces](web-phase-2/provider-smoke-after.json)

### Per-provider results

Read each cell as before → after. P means populated response, E means empty response, F means failed HTTP operation, and — means skipped or inapplicable. A stage can move from skipped to pass when an earlier prerequisite recovers.

| Provider | Catalog | Posts | Search | Meta | Episodes | Stream |
| --- | --- | --- | --- | --- | --- | --- |
| 1flex | P → P | P → P | P → P | P → P | — → — | P → P |
| 1tamilblasters | P → P | F → P | F → F | — → P | — → — | — → P |
| 1tamilmv | P → P | P → P | F → F | P → P | — → — | — → P |
| 4khdhub | P → P | P → P | P → P | P → P | — → — | P → P |
| Joya9tv | P → P | F → F | F → F | — → — | — → — | — → — |
| anikoto | P → P | P → P | P → P | P → P | — → — | P → P |
| animesalt | P → P | E → E | E → E | — → — | — → — | — → — |
| animesub | P → P | P → P | P → P | P → P | — → — | E → E |
| animeworld | P → P | P → P | P → P | P → P | P → P | P → P |
| autoEmbed | P → P | P → P | P → P | P → P | — → — | P → P |
| castle | P → P | P → P | P → P | P → P | — → — | P → P |
| disneyPlus | F → F | — → — | F → F | — → — | — → — | — → — |
| drive | P → P | P → P | P → P | P → P | — → — | E → E |
| dvdplay | P → P | P → P | F → F | P → P | — → — | E → E |
| gokuHD | P → P | F → F | F → F | — → — | — → — | — → — |
| hdhub4u | P → P | P → P | P → P | P → P | — → — | P → P |
| hdmovieslife | P → P | P → P | E → E | P → P | — → — | P → P |
| hiAnime | P → P | E → F | E → F | — → — | — → — | — → — |
| hotstar | F → F | — → — | F → F | — → — | — → — | — → — |
| kickAssAnime | P → P | P → P | P → P | P → P | — → — | P → P |
| kissKh | P → P | P → P | P → P | P → P | — → — | E → E |
| kmMovies | P → P | P → P | P → P | P → P | — → — | E → P |
| luxMovies | P → P | P → P | E → E | P → P | P → P | P → P |
| marvel | F → F | — → — | F → F | — → — | — → — | — → — |
| movieBoxWeb | P → P | P → P | P → P | P → P | P → P | P → P |
| movielinkdb | P → P | P → P | P → P | P → P | — → — | P → P |
| movies4u | P → P | F → F | F → F | — → — | — → — | — → — |
| moviesda | P → P | P → P | E → E | P → P | — → — | P → P |
| movieswood | P → P | F → P | F → F | — → P | — → — | — → P |
| moviezwap | P → P | P → P | P → P | P → P | P → P | P → P |
| multi | P → P | P → P | P → P | P → P | E → E | P → P |
| mxplayer | P → P | P → P | P → P | F → F | — → — | — → — |
| netflix | F → F | — → — | F → F | — → — | — → — | — → — |
| pixar | F → F | — → — | F → F | — → — | — → — | — → — |
| primeVideo | F → F | — → — | F → F | — → — | — → — | — → — |
| showbox | P → P | P → P | P → P | P → P | P → P | F → F |
| starWars | F → F | — → — | F → F | — → — | — → — | — → — |
| torrentio | P → P | P → P | P → P | P → P | — → — | E → E |
| uhd | P → P | F → F | F → F | — → — | — → — | — → — |
| uniquestream | P → P | E → F | E → F | — → — | — → — | — → — |
| vega | P → P | P → P | P → P | P → P | — → — | P → P |
| zeefliz | P → P | F → F | F → F | — → — | — → — | — → — |
| disneyMirror | F → P | — → E | F → P | — → P | — → — | — → E |
| netflixMirror | F → P | — → E | F → P | — → P | — → — | — → E |
| primeMirror | F → P | — → E | F → P | — → P | — → — | — → E |
| youtube | F → F | — → — | F → F | — → — | — → — | — → — |
| moviesApi | F → F | — → — | F → F | — → — | — → — | — → — |

### Remaining causes and limits

| Provider(s) | Evidence |
| --- | --- |
| disneyPlus, hotstar, marvel, netflix, pixar, primeVideo, starWars | The remote-only bundles still hit the 25 s operation deadline. Android routes catalog and posts through its combined WebView bundle. No Android device was connected for a like-for-like verification, and no longer server timeout was shown to return a session. |
| Joya9tv, movies4u, uhd, uniquestream | Repeated connect or request timeouts on both the website and reference probes. Relevant origin checks also timed out where a URL was registered. A server-only cause and a device outage are both still possible. |
| gokuHD | Catalog operations timed out. Search recorded an upstream HTTP 403 along with a timeout. The sampled code never called the interactive browser hook. |
| 1tamilblasters, 1tamilmv | Search still reset in the default full run. A second run with API bundles and the same website runtime returned results for both. Bundle choice and transient upstream behavior both remain possible contributors. |
| hiAnime, zeefliz | Their required URL-registry entries are missing (consumet and zeefliz respectively). The pinned app bundle, API fallback, and website default reproduced invalid URLs. A verified replacement origin is required before changing those paths. |
| dvdplay, movieswood | Their bundles explicitly reject search with “Search is unavailable. Browse the categories.” Catalog and posts can succeed independently. DVDPlay's sampled stream returned no records. |
| animesalt | The first Android-bundle probe found posts and search results. The later reference probe, the default website run, and the API fallback all returned empty. This is an intermittent result without a confirmed runtime cause. |
| animesub, kissKh, torrentio | The focused Android-bundle probe returned 35, one, and 218 raw records respectively, and zero carried HTTP(S) links. The website's current browser source ingestion returned no eligible sources for the same titles. This comparison covers bundle output and excludes Android playback. |
| disneyMirror, netflixMirror, primeMirror | The vendored comparison and website returned catalog, search, and metadata for the sample. First-category posts were empty. The same three sampled player endpoints returned HTTP 200 with a video_link field and an application status other than ok. The unchanged bundle returned no streams. Targeted Andor, Stranger Things, and Fallout checks returned episode lists but still no streams. |
| drive, hdmovieslife, luxMovies, moviesda, multi | The sample gave an empty stream, title-specific search, or episode result. Some matched the reference probe. Evidence is insufficient to attribute them to an upstream outage. |
| mxplayer | The sampled title had no metadata in either runtime. Its origin now redirects to Prime Video in the URL check. |
| showbox | Stream resolution returned upstream HTTP 404 in both probes. Catalog and search can still return results. |

There were zero live interactive WebView calls in the full before and after runs. The UI reports **Needs verification** when a bundle actually invokes the interactive hook and cannot complete the operation. The badge and reason were verified with a controlled browser fixture. No solver was added. A live upstream 403 remains a reported HTTP failure until evidence ties it to interactive verification.

The global 12 s request limit, 25 s operation limit, 500 ms initialization timeout, 24 active executions, 70-hop budget, 8 MiB response limit, port rule, and public-IP checks remain in force. The request adapter honors the bundle's own shorter Axios timeout and redirect options. The timed-out hosts did not show a recovery that justified increasing a global limit.

[Focused Android-bundle stream diagnostics](web-phase-2/android-playback-comparison.json) · [API-bundle comparison](web-phase-2/api-fallback-comparison.json) · [Browser diagnostics and health evidence](web-phase-2/provider-ui.json) · [Mirror series samples](web-phase-2/mirror-series.json)

## Movie Based

Live TMDB search for Batman returned 20 results both before and after. The website uses TMDB for discovery and provider search to match sources after opening a title. The test used the actual website route and Movie Based matcher for **The Batman (2022)**.

| Matching outcome | Before | After |
| --- | ---: | ---: |
| Provider returned source choices | 13 | 16 |
| Provider searched without a match | 14 | 13 |
| Provider errored during matching | 15 | 16 |

All three additional matches came from the mirrors. A match is a selectable link group. Three subsequent mirror stream-resolution samples returned no sources. Search failures remained visible during provider matching and did not stop TMDB discovery or other providers. The four-request queue peak was verified under controlled concurrency, including cancellation of a queued request.

[Before matching](web-phase-2/movie-before.json) · [After matching](web-phase-2/movie-after.json) · [Runtime checks](web-phase-2/runtime-checks.json)

## Verification and reproduction

- Compared the IDs shared by the Android and pinned API registries. All 36 shared bundle files differ at the byte level. The targeted API-only comparison ran the same website adapter as the default run and measured behavioral differences without changing the vendored source files.
- Verified startup installation and persisted uninstall in a fresh Chrome fixture, then reproduced DVDPlay's real structured search error on the diagnostics page. Existing profiles keep their saved provider selections.
- Verified in-process TTL storage, provider key isolation, Redis REST command format using a fixture, cache coalescing across callers, per-client 429 isolation, queue cancellation, and representative rejected destinations. Live Redis was outside the run.
- Verified production build, TypeScript, lint, and all nine application tests. No Android device was connected, so the evidence distinguishes measured website behavior and the pinned bundle's Node comparison from Android device parity.

Run these commands from web. For API-only comparison, set K45_PROVIDER_SOURCE=api in the process environment. For the Movie Based check, start the website on a local port with TMDB_API_KEY in the ignored .env.local and point K45_SMOKE_SITE_URL at it.

~~~sh
node --conditions=react-server --import tsx scripts/provider-smoke/run.mts docs/web-phase-2/provider-smoke-after.json
node --conditions=react-server --import tsx scripts/provider-smoke/phase2-checks.mts
node --import tsx scripts/provider-smoke/movie-matching.mts docs/web-phase-2/movie-after.json
node scripts/provider-smoke/provider-ui.mjs docs/web-phase-2/provider-ui.json PLAYWRIGHT_INSTALL_ROOT CHROME_EXE
~~~

For the Android-bundle comparison, use a sibling K45movies-api checkout with API commit 02f2b0e available. An optional list of provider IDs narrows the run. The original Phase 0 baseline assertions target the Phase 0 website commit.

~~~sh
node --conditions=react-server --import tsx scripts/provider-smoke/compare-android.mts docs/web-phase-2/android-comparison.json
~~~
