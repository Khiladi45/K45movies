# Phase 5 proof and hardening

Verified on 16 November 2026 on the Windows production build of `feat/website`. The local provider requests originated from the PC network. The public GitHub Pages site returned HTTP 404 for the provider API. The datacenter comparison is pending deployment. [Deployment instructions](DEPLOY.md)

## Playback and reliability

- Playwright on Chrome 157 opened a Provider Based title and a Movie Based title, chose 1080p, recovered from a failed first server, switched to 720p at the same position, and played episode 2. The Movie Based run loaded the title and episode data for Stranger Things from live TMDB using the server's local configuration. Both runs used deterministic provider responses and generated media to make failures and switches repeatable. [Provider Based](web-phase-5/e2e-provider.json) · [Movie Based](web-phase-5/e2e-movie.json)
- In Movie Based, a slow provider remained pending and another returned a structured error while the working provider played. Leaving the title aborted the slow browser request with `net::ERR_ABORTED`. The server cache now retains a shared request while another caller is waiting and aborts it when its last caller disconnects.
- A controlled server stress test made 3,000 distinct cache requests in five waves. The oldest key was evicted. Post-GC heap samples stayed between 29.28 and 30.05 MB and ArrayBuffer memory stayed at 4.61 MB. This covers bounded cache behavior in one process over the test window. Sustained production RSS and bandwidth remain deployment checks. [Server test output](web-phase-5/server-checks.txt)

Chrome played these synthetic 1080p H.264/AAC files over HTTP with 80 ms latency and 8 Mbps downstream. HLS used the application's hls.js version. Startup and seek include the first 0.2 seconds of media progression. The 24-second seek target was outside the buffered range in both cases. The frame sample covers five seconds after the seek. [Throttled playback data](web-phase-5/playback-throttled.json)

| Format | Startup | Unbuffered seek | Dropped / total frames |
| --- | ---: | ---: | ---: |
| MP4 | 691 ms | 452 ms | 0 / 151 |
| HLS | 1,246 ms | 1,594 ms | 0 / 150 |

Earlier live samples established video startup for 10 distinct titles across 12 providers, and all five HLS fragment failures advanced after the playlist/content-type fixes. HEVC/E-AC-3 samples still depend on browser support. One Chromium run advanced video without decoded audio and Firefox did not decode the tested HEVC samples. Optional FFmpeg copies the video codec, so it cannot add HEVC decoding to a browser. [Live playback matrix](WEB_STREAMING_PARITY.md#live-browser-playback-matrix) · [HLS follow-up](WEB_HLS_FOLLOW_UP.md)

## Search

The Provider Based Search Lighthouse failure at 96 came from a real DVDPlay HTTP 422. The vendored DVDPlay and MoviesWood bundles expressly reject search. Search now lists those capabilities without sending the known unsupported request. Both remain available in the catalog and Provider Diagnostics can still call the search endpoint directly. The isolated production audit reached 100 for best practices in Provider Based and Movie Based Search with zero captured console errors. Live provider failures outside the audit set still surface in Search. [Before](web-phase-5/lighthouse-before.json) · [After](web-phase-5/search-after.json)

## Security and checks

- Source API tests cover invalid quality, malformed references, and cross-provider signed references. Existing stream and episode tests cover filtering, ranking, codec fallback, probes, season matching, quality switches, and episode navigation.
- Private destination tests cover direct IPv4/IPv6 URLs, redirect target revalidation, mixed public/private answers, empty answers, and public-to-private DNS changes across independent lookups. Source inspection confirmed the connection lookup hands the validated addresses directly to the socket. The tests use controlled DNS inputs.
- Encrypted media tokens successfully decoded while valid and returned HTTP 410 at expiry. The expiry check now includes the exact deadline. The client asset scan checked 30 production public files, four rendered pages and the TMDB title API response for the configured TMDB key and local reference signing key. Neither appeared. TMDB now reads the server-only `TMDB_API_KEY` setting. [Client scan](web-phase-5/client-secrets.json)
- Clean `npm ci`, typecheck, lint, production build, 15 test entries (including the child suite of five server tests), and both Playwright flows passed. `npm audit` reported zero vulnerabilities. The seven previous moderate findings traced to the same `minimatch` advisory. A scoped lockfile override updates that dependency under `@typescript-eslint/typescript-estree`. [Advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249)

## Provider smoke and remaining limits

The HTTP smoke covered 47 IDs, including YouTube and the deliberately unavailable internal `moviesApi` ID. Each non-empty sources result includes at least one server-side verified source. Browser startup still depends on the individual source. [Full local trace](web-phase-5/local-smoke.json)

| Operation | Local pass | Local fail | Local empty | Local skipped | Datacenter |
| --- | ---: | ---: | ---: | ---: | --- |
| Catalog | 39 | 8 | 0 | 0 | Pending |
| Posts | 32 | 3 | 4 | 8 | Pending |
| Search | 29 | 14 | 4 | 0 | Pending |
| Metadata | 33 | 2 | 0 | 12 | Pending |
| Episodes | 7 | 0 | 1 | 39 | Pending |
| Verified sources | 19 | 6 | 8 | 14 | Pending |

HiAnime and ZeeFliz returned invalid upstream URLs for posts/search. Movies4u returned an invalid URL at stream resolution. LuxMovies returned upstream HTTP 403. Showbox search reset and the sampled stream endpoint returned upstream HTTP 404. The 1TamilMV and MX Player sample titles reported unavailable metadata. Eight sampled providers produced no verified source. DVDPlay and MoviesWood still return their documented HTTP 422 for direct search requests. YouTube plays through its embedded player and rejects direct Sources API resolution by design. These results describe the sampled network and titles. The two local reruns also differed on which sources resolved.

The seven deadline providers remain registered. Their latest timings and status are in the [deadline table](WEB_PROVIDER_PARITY.md#seven-operation-deadline-providers). Disney, Netflix and Prime Mirror each returned HTTP 200 with `otp` and display **Needs verification**. The request comparison found identical explicit bundle headers and three additional website transport headers. Native Android transport and device/IP reputation could not be verified. No provider was classified as dead in Android on the basis of the local website run. [Mirror request comparison](WEB_MIRROR_VERIFICATION.md#phase-5-request-comparison) · [Earlier provider classifications](WEB_PROVIDER_CLASSIFICATION.md)

## Reproduce

Run these commands from `web/` with the production server running on port 3200. Set `K45_SMOKE_SITE_URL` if it listens elsewhere. Browser runs use separately installed Playwright and Lighthouse with Puppeteer plus a local Chrome executable. Set `K45_FFMPEG_PATH` to a full FFmpeg build for the two fixture scripts.

```sh
npm ci
npm run lint
npm test
npm run build
npm run typecheck
npm audit
node --import tsx scripts/provider-smoke/run.mts local-smoke.json --url http://127.0.0.1:3200
node --conditions=react-server --import tsx scripts/provider-smoke/mirror-request-audit.mts mirror-requests.json
node --env-file=.env.local scripts/provider-smoke/client-secrets.mjs
node scripts/provider-smoke/playback-e2e.mjs provider.json PLAYWRIGHT_ROOT CHROME_EXE provider
node scripts/provider-smoke/playback-e2e.mjs movie.json PLAYWRIGHT_ROOT CHROME_EXE movie
node scripts/provider-smoke/playback-throttled.mjs throttled.json PLAYWRIGHT_ROOT CHROME_EXE
node scripts/provider-smoke/design-lighthouse.mjs lighthouse.json LIGHTHOUSE_ROOT CHROME_EXE
```
