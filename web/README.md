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

TanStack Query handles catalog data, cancellation, retry and cache freshness. Zustand persists local profiles, provider selections, preferences, search history and layout-specific watchlists in localStorage. Provider Based supports category browsing, title details and source selection. Movie Based searches TMDB and matches titles and episodes to installed providers. Source selection currently displays the resolved servers. The dedicated player is a later phase.

Provider results depend on upstream availability and supported requests. Live Vega browsing, title details and source resolution were verified. Interactive challenges that rely on the Android WebView require a supported upstream alternative.

Run `npm run lint`, `npm run build`, and `npm run typecheck` to verify the app.
