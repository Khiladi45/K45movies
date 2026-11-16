# Phase 4 · Responsive design and verification

Initial captures were taken on 15 November 2026 in Chromium on Windows. Lighthouse was rerun on 16 November. The redesign keeps the K45movies logo, dark theme and selectable accent. Home has a compact provider picker with health, an artwork-led feature, and consistent card rails. Detail uses a poster and backdrop hero, one quality selector, Watch Now, and a responsive episode grid. Search, Watchlist, Providers and Settings share the page container, spacing and states. The mobile Player puts settings below the video and keeps the controls available to touch and keyboard.

## Screenshot gallery

Home, Detail, Player and Settings use the Phase 0 before images. Search, Watchlist and Providers use supplemental captures from before the Phase 4 redesign, at 1440 and 390 px. The after captures use live catalog and movie artwork. The Watchlist was seeded with live TMDB results. The responsive harness replayed one live Vega metadata and sources response across widths and played media through the website gateway.

| View | Before | After |
| --- | --- | --- |
| Home | [1440](web-phase-0/home-1440.png) · [1024](web-phase-0/home-1024.png) · [390](web-phase-0/home-390.png) | [1920](web-phase-4/after/home-1920.jpg) · [1440](web-phase-4/after/home-1440.jpg) · [1280](web-phase-4/after/home-1280.jpg) · [1024](web-phase-4/after/home-1024.jpg) · [768](web-phase-4/after/home-768.jpg) · [390](web-phase-4/after/home-390.jpg) |
| Detail | [1440](web-phase-0/detail-1440.png) · [1024](web-phase-0/detail-1024.png) · [390](web-phase-0/detail-390.png) | [1920](web-phase-4/after/detail-1920.jpg) · [1440](web-phase-4/after/detail-1440.jpg) · [1280](web-phase-4/after/detail-1280.jpg) · [1024](web-phase-4/after/detail-1024.jpg) · [768](web-phase-4/after/detail-768.jpg) · [390](web-phase-4/after/detail-390.jpg) |
| Search | [1440](web-phase-4/before/search-1440.png) · [390](web-phase-4/before/search-390.png) | [1920](web-phase-4/after/search-1920.jpg) · [1440](web-phase-4/after/search-1440.jpg) · [1280](web-phase-4/after/search-1280.jpg) · [1024](web-phase-4/after/search-1024.jpg) · [768](web-phase-4/after/search-768.jpg) · [390](web-phase-4/after/search-390.jpg) |
| Watchlist | [1440](web-phase-4/before/watchlist-1440.png) · [390](web-phase-4/before/watchlist-390.png) | [1920](web-phase-4/after/watchlist-1920.jpg) · [1440](web-phase-4/after/watchlist-1440.jpg) · [1280](web-phase-4/after/watchlist-1280.jpg) · [1024](web-phase-4/after/watchlist-1024.jpg) · [768](web-phase-4/after/watchlist-768.jpg) · [390](web-phase-4/after/watchlist-390.jpg) |
| Providers | [1440](web-phase-4/before/providers-1440.png) · [390](web-phase-4/before/providers-390.png) | [1920](web-phase-4/after/providers-1920.jpg) · [1440](web-phase-4/after/providers-1440.jpg) · [1280](web-phase-4/after/providers-1280.jpg) · [1024](web-phase-4/after/providers-1024.jpg) · [768](web-phase-4/after/providers-768.jpg) · [390](web-phase-4/after/providers-390.jpg) |
| Settings | [1440](web-phase-0/settings-1440.png) · [1024](web-phase-0/settings-1024.png) · [390](web-phase-0/settings-390.png) | [1920](web-phase-4/after/settings-1920.jpg) · [1440](web-phase-4/after/settings-1440.jpg) · [1280](web-phase-4/after/settings-1280.jpg) · [1024](web-phase-4/after/settings-1024.jpg) · [768](web-phase-4/after/settings-768.jpg) · [390](web-phase-4/after/settings-390.jpg) |
| Player | [1440](web-phase-0/player-1440.png) · [1024](web-phase-0/player-1024.png) · [390](web-phase-0/player-390.png) | [1920](web-phase-4/after/player-1920.jpg) · [1440](web-phase-4/after/player-1440.jpg) · [1280](web-phase-4/after/player-1280.jpg) · [1024](web-phase-4/after/player-1024.jpg) · [768](web-phase-4/after/player-768.jpg) · [390](web-phase-4/after/player-390.jpg) |

Additional captures show the layout choices and an episode grid.

| View | 1440 px | 390 px |
| --- | --- | --- |
| Movie Based Home | [1440](web-phase-4/after/movie-home-1440.jpg) | [390](web-phase-4/after/movie-home-390.jpg) |
| YouTube Home | [1440](web-phase-4/after/youtube-home-1440.jpg) | [390](web-phase-4/after/youtube-home-390.jpg) |
| Episode grid | [1440](web-phase-4/after/episodes-1440.jpg) | [390](web-phase-4/after/episodes-390.jpg) |
| YouTube video | — | [390](web-phase-4/after/youtube-video-390.jpg) |

Provider Based and Movie Based retain their catalog paths. YouTube uses the vendored provider for categories, search and video metadata, with the official embed player and a YouTube link for video-owner playback restrictions. The browser check opened the embed for a live result. [YouTube embed documentation](https://developers.google.com/youtube/player_parameters)

## Responsive and accessibility checks

Chromium 157.0.8103.51 measured 57 view states across the six widths. Every document matched its viewport width.

| Width | Views measured | Axe scans | Violations |
| ---: | ---: | ---: | ---: |
| 1920 | 9 | — | — |
| 1440 | 10 | 9 | 0 |
| 1280 | 9 | — | — |
| 1024 | 9 | — | — |
| 768 | 9 | — | — |
| 390 | 11 | 9 | 0 |

The 390 px detail document now measures 390 px, down from 564 px. After the player controls reached their auto-hide state, a pointer click opened Playback settings. A separate Tab and Enter check opened the same panel. Axe ran 18 checks against WCAG 2.0 and 2.1 A/AA rules at 1440 and 390 px.

## Lighthouse

Lighthouse desktop navigation audits ran against the local production server. The Player is an overlay, so it used a Lighthouse snapshot after opening playback. The snapshot reports accessibility and best practices. These are lab results with live upstream responses.

| View | Performance | Accessibility | Best practices | SEO | CLS |
| --- | ---: | ---: | ---: | ---: | ---: |
| Home | 96 | 100 | 100 | 100 | 0.018 |
| Detail | 95 | 100 | 100 | 100 | 0.011 |
| Search | 99 | 100 | 96 | 100 | 0.000 |
| Watchlist | 100 | 100 | 100 | 100 | 0.005 |
| Providers | 100 | 100 | 100 | 100 | 0.000 |
| Settings | 100 | 100 | 100 | 100 | 0.000 |
| Player | — | 100 | 100 | — | — |

Lighthouse flagged Search · errors in console. A separate Playwright visit to Movie Based Search rendered results without a console error.

[Responsive and axe results](web-phase-4/after/results.json) · [Lighthouse results](web-phase-4/lighthouse.json)

## HLS and mirror carry-overs

All five HLS samples recovered on retest. The Android mirror audit found no OTP workflow to port. The website reports the upstream requirement when the player endpoint returns it. [HLS classification and network evidence](WEB_HLS_FOLLOW_UP.md) · [Android mirror audit](WEB_MIRROR_VERIFICATION.md)

## Reproduction

Run from web against a local production server. Set K45_SMOKE_SITE_URL if it uses a different origin. The audit dependency root contains Playwright, axe-core's Playwright adapter, and Lighthouse.

~~~sh
node scripts/provider-smoke/design-audit.mjs docs/web-phase-4/after AUDIT_INSTALL_ROOT CHROME_EXE
node scripts/provider-smoke/design-lighthouse.mjs docs/web-phase-4/lighthouse.json AUDIT_INSTALL_ROOT CHROME_EXE
node --conditions=react-server --import tsx scripts/provider-smoke/hls-proxy-checks.mts
~~~
