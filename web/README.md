# K45movies web

This desktop-first Next.js app lives in `web/`. Use Node.js 24 and run the following from that directory.

```sh
npm ci
npm run dev
```

Copy `.env.example` to `.env.local` and set `TMDB_API_KEY` to a TMDB API key or read access token to enable Movie Based. The browser uses same-origin handlers for both catalogs.

- The vendored Android registry and bundles supply the default provider code. `K45MOVIES_API_BASE_URL` configures the trusted API manifest and fallback bundles. `K45_PROVIDER_SOURCE=api` selects the API-only comparison mode. Treat both bundle sources as trusted application code. The VM adapts the provider runtime.
- `K45_REFERENCE_SECRET` should be a shared random secret of at least 32 characters in a deployment. Local development generates an ignored key file for stable title links. Keep this key stable for saved title links.
- `K45_TRUSTED_CLIENT_IP_HEADER` identifies clients behind ingress that overwrites the named header. The provider API gives each trusted IP or signed anonymous client 360 requests per minute. The anonymous fallback also has a shared 2,400-request ceiling. The limits are per process. Use shared ingress limits for multi-instance deployments.
- Set both `K45_KV_REST_URL` and `K45_KV_REST_TOKEN` for an [HTTPS Redis REST adapter](https://upstash.com/docs/redis/features/restapi). By default, provider state lives in process-global memory. Both implementations scope keys by provider and expire them after 24 hours.

TanStack Query handles catalog data, cancellation, retry and cache freshness. Zustand persists local profiles, provider selections, preferences, search history and layout-specific watchlists in localStorage. Provider Based supports category browsing, title details and source selection. Movie Based searches TMDB and matches titles and episodes to installed providers. Choose a title quality or episode and start playback with Watch Now. The server probes sources before the player loads. Quality and server switching happen inside the player. HLS uses hls.js with MSE where available. MP4 uses native HTML video. Short-lived encrypted media links keep upstream headers and URLs server-side. The media handler forwards byte ranges and rewrites nested HLS references through the same-origin gateway. Continue Watching resolves a fresh source from the saved title and episode before restoring position.

Provider settings initialize all listed providers in a new profile and let users uninstall them. Catalog checks are independent of activation. Diagnostics show observed operation failures and upstream status where available. See the [provider measurements](docs/WEB_PROVIDER_PARITY.md) and [browser playback matrix](docs/WEB_STREAMING_PARITY.md). Set K45_FFMPEG_PATH to enable optional sequential MKV compatibility playback in fragmented MP4 with AAC audio.

Run `npm test`, `npm run lint`, `npm run build`, and `npm run typecheck` to verify the app. The tests cover local persistence, provider title and episode matching, media event cleanup, server probes, resume and subtitle parsing.

## Player verification

The production build was exercised in headless Chrome 157 on Windows at 1440 × 900 with 150 ms latency, 420 KB/s download and 70 KB/s upload via Chrome network throttling. The fixtures were a 180-second, 51.8 MB, 480p H.264/AAC MP4 with fast-start and byte ranges, and a 32-second HLS stream with 180p and 360p variants and two-second segments. The browser test used a local fixture origin. A separate live Vega check exercised the same-origin media gateway.

| Scenario | Observed time |
| --- | ---: |
| Start the MP4 after the selected server returned 404 | 1.72 s |
| Seek to 120 s in the MP4 and resume playback | 0.63 s |
| Switch to the HLS episode and start playback | 1.88 s |

The last sample showed 68 rendered HLS frames with zero dropped, six HLS segment requests and two waiting events after the resume page loaded. The smoke test also verified manual quality selection, external subtitles, speed, in-place episode selection, controls lock, mini-player and resume after reopening Home. The live Vega gateway returned a 206 byte-range response from two large-file sources and rejected a tampered playback link. Browser decoding, native audio tracks and OS picture-in-picture vary by browser and codec. PiP, live HLS delivery and long-run memory were outside this measured smoke test.

## Settings

Settings provides the dark theme accent picker, local profiles, layout and language selection, playback defaults, subtitle styling and provider diagnostics. Playback and accent preferences are stored in localStorage and shared by Settings and the player. Background playback respects the site preference when browser visibility changes. Actual background execution depends on browser and OS media policy. Diagnostics checks registered providers through the same catalog and media APIs used by the screens.
## Accessibility and performance

A local production-build audit of Provider Based Home with live Vega data scored 94 for performance and 100 each for accessibility, best practices and SEO in Lighthouse 13.6 desktop. Largest Contentful Paint was 1.6 s, Total Blocking Time was 0 ms and Cumulative Layout Shift was 0. These are lab measurements and upstream response times vary.

An axe-core scan at 1440 and 390 px found zero WCAG A/AA violations across Home, Settings, Appearance, Playback preferences, Provider diagnostics, Providers, Watchlist, Search and the open search dialog. Chrome smoke tests also covered keyboard search, deep links and in-site Back. Live Movie Based verification requires a TMDB credential.