# K45movies on GitHub Pages

The site reads the live provider registry from K45movies-api and uses the K45movies Browser Bridge extension for provider catalog, search, metadata, episodes and source resolution. Both run without a hosted K45movies API.

1. Open https://khiladi45.github.io/K45movies/ in Chrome or Edge.
2. Extract the Browser Bridge ZIP linked from Providers and Settings.
3. Open the extensions manager, enable Developer mode and use **Load unpacked** on the extracted folder.
4. Reload the site, open Providers, and install a provider. When the site requests access to another provider domain, use the extension icon to approve it, then retry the operation.
5. For Movie Based, save a TMDB v3 API key in Settings. It stays in localStorage and is sent directly to TMDB when you browse or search. Use the same browser for your saved settings and watchlist.

The extension bundles a pinned revision of provider code. The website fetches the current manifest, so new provider entries may require a newer extension build. Source availability varies by provider, browser codecs and media server policy.

The deployment branch is `gh-pages`. Its root contains these source assets plus the generated Browser Bridge ZIP and the pinned hls.js build. Build the extension with `npm run build:extension` from `web/`.
