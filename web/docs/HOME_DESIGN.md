# Home redesign

All three Home layouts share the hero and rail components while using their existing provider, TMDB, and YouTube data. The hero uses the current artwork where available, gradient scrims, a 500 ms image crossfade and 600 ms content fade. Featured rotation waits when the hero is hovered, focused, off-screen, during scrolling, or when the tab is hidden. A pause button and individual slide controls are available. Reduced motion disables auto-rotation and animation.

Play uses the existing title and player routes. Provider Based starts the first available entry, Movie Based starts the selected movie or the first episode of a series with a matched provider, and YouTube opens the embedded player. More Info navigates to the same title without requesting playback.

Rails use snap points, edge fades, desktop arrows, a 220 ms card transform, artwork fade-in, and reserved card dimensions. They prefetch the detail route on mouse hover or keyboard focus. Lower rails defer rendering with `content-visibility:auto`. The page fades in on Home entry and catalog-layout changes. TMDB artwork uses separate responsive poster and backdrop sizes. Artwork palettes use a small sample when the host allows cross-origin image access and fall back to the theme accent otherwise.

## Screenshots

The before and after captures used the same repeatable fixture made from live Vega, TMDB, and YouTube responses. The initial YouTube Trending response was empty in the fixture, so the screenshot test selected the populated Music topic in both builds. The captures use reduced motion to hold the same initial slide. Desktop viewport height was 960 px. Mobile height was 844 px.

| Home layout | Width | Before | After |
| --- | ---: | --- | --- |
| Provider Based | 1920 px | [Before](home-design/before/provider-1920.png) | [After](home-design/after/provider-1920.png) |
| Provider Based | 1440 px | [Before](home-design/before/provider-1440.png) | [After](home-design/after/provider-1440.png) |
| Provider Based | 1024 px | [Before](home-design/before/provider-1024.png) | [After](home-design/after/provider-1024.png) |
| Provider Based | 390 px | [Before](home-design/before/provider-390.png) | [After](home-design/after/provider-390.png) |
| Movie Based | 1920 px | [Before](home-design/before/movie-1920.png) | [After](home-design/after/movie-1920.png) |
| Movie Based | 1440 px | [Before](home-design/before/movie-1440.png) | [After](home-design/after/movie-1440.png) |
| Movie Based | 1024 px | [Before](home-design/before/movie-1024.png) | [After](home-design/after/movie-1024.png) |
| Movie Based | 390 px | [Before](home-design/before/movie-390.png) | [After](home-design/after/movie-390.png) |
| YouTube | 1920 px | [Before](home-design/before/youtube-1920.png) | [After](home-design/after/youtube-1920.png) |
| YouTube | 1440 px | [Before](home-design/before/youtube-1440.png) | [After](home-design/after/youtube-1440.png) |
| YouTube | 1024 px | [Before](home-design/before/youtube-1024.png) | [After](home-design/after/youtube-1024.png) |
| YouTube | 390 px | [Before](home-design/before/youtube-390.png) | [After](home-design/after/youtube-390.png) |

## Verification

The Playwright Home audit recorded zero axe WCAG A/AA violations and zero horizontal overflow in each of the 12 final views. Provider Based and Movie Based browser tests verified Home Play end to end using controlled streams and also exercised the detailed player, fallback, quality switch, and next episode. [Before browser audit](home-design/before/audit.json) · [After browser audit](home-design/after/audit.json) · [Provider Based playback](home-design/playback-provider.json) · [Movie Based playback](home-design/playback-movie.json)

Lighthouse CLS was **0.000** in all six runs using the fixture and Chrome.

| Home layout | Width | CLS | LCP | Lighthouse accessibility |
| --- | ---: | ---: | ---: | ---: |
| Provider Based | 1440 px | 0.000 | 1021 ms | 100 |
| Provider Based | 390 px | 0.000 | 789 ms | 100 |
| Movie Based | 1440 px | 0.000 | 623 ms | 100 |
| Movie Based | 390 px | 0.000 | 728 ms | 100 |
| YouTube | 1440 px | 0.000 | 874 ms | 100 |
| YouTube | 390 px | 0.000 | 783 ms | 100 |

[Lighthouse output](home-design/lighthouse.json)

The Chrome traces recorded one automatic title change and one arrow-driven rail scroll for each layout. The final run waited for both hero animations to finish before starting the separate scroll interaction. Chrome reported zero Long Animation Frames at the 50 ms threshold during either interaction in all three layouts. In the initial Provider Based run, scrolling started during the hero crossfade and Chrome reported one 55.8 ms frame with zero blocking duration. The YouTube Play test verified that the selected video opened an autoplay-enabled embed using a controlled response. [Final trace summary](home-design/traces/trace-summary.json) · [Provider Based trace](home-design/traces/provider.trace.json.gz) · [Movie Based trace](home-design/traces/movie.trace.json.gz) · [YouTube trace](home-design/traces/youtube.trace.json.gz) · [Initial overlap run](home-design/traces/initial-overlap-summary.json)

## Reproduce

Run the scripts from `web/` with the Next.js production build at `http://127.0.0.1:3200`. The audit script writes a fixture if the specified file is absent. Use the same fixture on the before and after branches. Dependencies refer to the directory containing the separately installed Playwright, axe, Lighthouse and Puppeteer packages.

```sh
node scripts/provider-smoke/home-audit.mjs docs/home-design/after DEPENDENCIES CHROME FIXTURE.json after
node scripts/provider-smoke/home-lighthouse.mjs docs/home-design/lighthouse.json DEPENDENCIES CHROME FIXTURE.json
node scripts/provider-smoke/home-performance.mjs docs/home-design/traces DEPENDENCIES CHROME FIXTURE.json
```
