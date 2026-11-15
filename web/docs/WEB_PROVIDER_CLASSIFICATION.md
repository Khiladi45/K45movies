# Phase 2 provider failure classification

Recorded before provider behavior changes on 15 November 2026. Website baseline is 4e2f100. Android bundles are from a77aa81. URL checks use the API checker's current urls.json at 02f2b0e, a desktop User-Agent, a 10-second deadline and redirect observation, through the guarded website transport. The checker tests origin reachability and redirects. It cannot establish that an operation, media endpoint or Android WebView works.

The Android comparison loads the pinned bundle exports with the app's Pixel 7 headers and an in-process key-value store. It uses the website's guarded Axios transport in Node and records unsupported Android WebView calls. No Android device or emulator was connected when checked with ADB. Working direct bundle paths are useful comparison points. Device parity and dead-upstream classifications require additional evidence.

Categories are **A** for dead upstream including in the app, **B** for website server-only failure, and **C** for a reproducible bundle or integration bug. A provisional category identifies the next test. **Inconclusive** indicates that the data cannot yet distinguish the categories. Empty title-specific results are recorded as such because a single query or source may legitimately return nothing.

| Provider | Affected operation | Category | Evidence and remaining check |
| --- | --- | --- | --- |
| 1tamilblasters | Posts, search | B provisional | Baseline connection resets. URL checker returned 200 and the vendored comparison passed both. Runtime, bundle version, and upstream timing changed together. |
| 1tamilmv | Search | B provisional | Baseline reset. URL checker returned 200 and the vendored comparison passed search. |
| Joya9tv | Posts, search | Inconclusive A/B | Website operations reached approximately 12 s. Vendored probe also failed and URL checker timed out at 10 s. No device comparison or successful extended request. |
| animesalt | Posts, search | C provisional | Both website operations were empty. The vendored comparison returned items for both, and URL checker got 200. |
| animesub | Stream | C provisional | Website returned no sources. The vendored comparison returned sources. Check whether the selected title and server still match on repeat. |
| disneyPlus | Catalog, search | B confirmed for deadline, root cause open | Website 504 at 25 s. The standalone remote bundle has a longer session loop. Android routes catalog/posts through its combined WebView bundle. No evidence that extending the cap recovers the session. |
| drive | Stream | Inconclusive | Website and vendored probes returned no source for different posts. URL checker got 200. |
| dvdplay | Search, stream | C confirmed for search; stream inconclusive | Both bundles intentionally throw an unsupported-search error. Website stream was empty after an upstream 403. The vendored comparison found a source on a different post. |
| gokuHD | Posts, search | Inconclusive A/B | URL checker timed out. Vendored search saw upstream 403, followed by a timeout. A 403 alone does not identify an interactive challenge. |
| hdmovieslife | Search | Inconclusive | Both bundles produced no Batman results, with catalog and posts available. URL checker returned 200. |
| hiAnime | Posts, search | C confirmed | Invalid URL reproduced in the website and vendored comparison. Its bundle obtains its origin from the URL registry, where its entry is absent. |
| hotstar | Catalog, search | B confirmed for deadline, root cause open | Same 25 s deadline and Android catalog routing as disneyPlus. |
| kissKh | Stream | C provisional | Website stream was empty. The vendored comparison returned sources for the same post title and URL checker returned 200. |
| kmMovies | Stream | Inconclusive A/B | Same post failed in both probes with TLS hostname mismatch at a stream host, while the catalog origin returned 200. A TLS override would bypass certificate validation without proving app parity. |
| luxMovies | Search | Inconclusive | Both bundles returned no Batman results while catalog, posts and sampled playback resolution succeeded. |
| marvel | Catalog, search | B confirmed for deadline, root cause open | Same 25 s deadline and Android catalog routing as disneyPlus. |
| movies4u | Posts, search | Inconclusive A/B | URL checker timed out and the vendored probe repeated connection or request timeouts. |
| moviesda | Search | Inconclusive | Both bundles returned no Batman results, while catalog and posts worked and URL checker returned 200. |
| movieswood | Posts, search | C confirmed for search, C provisional for posts | Search is deliberately unavailable in both bundles. Vendored posts recovered and URL checker returned 200. |
| multi | Episodes | Inconclusive | Both probes returned an empty list on the same movie, which also returned direct playable source records. |
| mxplayer | Metadata | C reproduced in bundle | Both probes failed to return usable Ki & Ka metadata. URL checker showed the origin redirected to Prime Video. |
| netflix | Catalog, search | B confirmed for deadline, root cause open | Same 25 s deadline and Android catalog routing as disneyPlus. |
| pixar | Catalog, search | B confirmed for deadline, root cause open | Same 25 s deadline and Android catalog routing as disneyPlus. |
| primeVideo | Catalog, search | B confirmed for deadline, root cause open | Same 25 s deadline and Android catalog routing as disneyPlus. |
| showbox | Stream | A candidate, app unverified | Sampled source endpoints returned upstream 404 in both probes on different titles. URL checker saw a connection reset at the catalog origin and search returned results. This does not establish a whole-provider outage. |
| starWars | Catalog, search | B confirmed for deadline, root cause open | Same 25 s deadline and Android catalog routing as disneyPlus. |
| torrentio | Stream | C provisional | Website returned no eligible source. Vendored raw bundle returned source records. Raw records need checking against web playback eligibility before counting this as a regression. |
| uhd | Posts, search | Inconclusive A/B | URL checker and the vendored probe repeated timeouts. |
| uniquestream | Posts, search | Inconclusive A/B | Both probes produced empty results after connection or request timeouts. |
| zeefliz | Posts, search | C confirmed | Both probes reproduced invalid URL errors. The bundle's provider origin is absent from the URL registry. |
| disneyMirror | Lookup | C confirmed | Vendored app bundle returns catalog and search results. Website baseline omitted the ID. |
| netflixMirror | Lookup | C confirmed | Vendored app bundle returns catalog and search results. Website baseline omitted the ID. |
| primeMirror | Lookup | C confirmed | Vendored app bundle returns catalog and search results. Website baseline omitted the ID. |
| youtube | Lookup | Intentional scope difference | Filtered at lookup by the current website. The vendored bundle returned catalog, posts and search. YouTube layout is scheduled for Phase 4. |
| moviesApi | Lookup | Intentional scope difference | Aggregator helper without a standalone app registry entry. |

The 12-second limit appears in repeated failed requests. Hosts also timed out independently in the 10-second URL check, so a higher limit has no demonstrated recovery. The seven legacy operations meet the 25-second deadline, but the Android catalog uses a different entry point and a longer server cap has no demonstrated recovery. No failures were tied to the 500 ms bundle deadline, non-default port rule, body cap, request-count cap or 24-execution cap. Leave these limits in place pending evidence. There is no confirmed interactive verification case from these runs.

[Phase 0 operation traces](web-phase-0/provider-smoke.json) · [Vendored-bundle comparison and URL checks](web-phase-2/android-comparison.json) · [API URL checker source](https://github.com/Khiladi45/K45movies-api/blob/02f2b0e96ea822cc68b2d18609418501534283ca/.github/scripts/url-checker.js)
