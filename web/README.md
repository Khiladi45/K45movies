# K45movies web

This desktop-first Next.js app lives in `web/`. Use Node.js 24 and run the following from that directory.

```sh
npm ci
npm run dev
```

Copy `.env.example` to `.env.local` and set `TMDB_API_KEY` to a TMDB API key or read access token to enable Movie Based. `NEXT_PUBLIC_TMDB_KEY` is available as a fallback for a key intended to be public. The browser uses same-origin handlers for both catalogs.

- `K45MOVIES_API_BASE_URL` points to the trusted provider release containing `manifest.json` and `bundled/`. The default pins an upstream commit. Provider bundles are trusted application code. The VM adapts their mobile runtime and is not a security boundary for arbitrary code.
- `K45_REFERENCE_SECRET` should be a shared random secret of at least 32 characters in a deployment. Local development generates an ignored key file for stable title links. Keep this key stable for saved title links.
- `K45_TRUSTED_CLIENT_IP_HEADER` can identify clients behind ingress that overwrites the named header. Otherwise each API uses a shared, per-process rate budget. Apply a shared ingress limit for scaled deployments.

TanStack Query handles catalog data, cancellation, retry and cache freshness. Zustand persists local profiles, provider selections, preferences, search history and layout-specific watchlists in localStorage. Provider Based supports category browsing, title details and source selection. Movie Based searches TMDB and matches titles and episodes to installed providers. Choose a source to open the custom player. HLS uses hls.js with MSE where available. MP4 uses native HTML video. Short-lived encrypted media links keep upstream headers and URLs server-side. The media handler forwards byte ranges and rewrites nested HLS references through the same-origin gateway. Continue Watching resolves a fresh source from the saved title and episode before restoring position.

Provider results depend on upstream availability and supported requests. Live Vega browsing, title details and source resolution were verified. Interactive challenges that rely on the Android WebView require a supported upstream alternative.

Run `npm run lint`, `npm run build`, and `npm run typecheck` to verify the app.

## Player verification

The production build was exercised in headless Chrome 157 on Windows at 1440 × 900 with 150 ms latency, 420 KB/s download and 70 KB/s upload via Chrome network throttling. The fixtures were a 180-second, 51.8 MB, 480p H.264/AAC MP4 with fast-start and byte ranges, and a 32-second HLS stream with 180p and 360p variants and two-second segments. The browser test used a local fixture origin. A separate live Vega check exercised the same-origin media gateway.

| Scenario | Observed time |
| --- | ---: |
| Start the MP4 after the selected server returned 404 | 1.72 s |
| Seek to 120 s in the MP4 and resume playback | 0.63 s |
| Switch to the HLS episode and start playback | 1.88 s |

The last sample showed 68 rendered HLS frames with zero dropped, six HLS segment requests and two waiting events after the resume page loaded. The smoke test also verified manual quality selection, external subtitles, speed, in-place episode selection, controls lock, mini-player and resume after reopening Home. The live Vega gateway returned a 206 byte-range response from two large-file sources and rejected a tampered playback link. Browser decoding, native audio tracks and OS picture-in-picture vary by browser and codec. PiP, live HLS delivery and long-run memory were outside this measured smoke test.
Settings provides the dark theme accent picker, local profiles, layout and language selection, playback defaults, subtitle styling and provider diagnostics. Playback and accent preferences are stored in localStorage and shared by Settings and the player. Background playback respects the site preference when browser visibility changes. Actual background execution depends on browser and OS media policy. Diagnostics checks registered providers through the same catalog and media APIs used by the screens.