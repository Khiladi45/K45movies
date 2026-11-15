# Phase 3 · Streaming and quality parity

Measured 15 November 2026 on Windows using the Android reference at a77aa81.

## Stream selection and player

The Sources API normalizes media URLs and quality labels, excludes download-only and legacy embed-download streams, and takes the preferred quality per server before considering other qualities. It probes up to 12 candidates in 6.5 seconds, with no more than four probes in flight. Non-adaptive streams get HEAD and a bounded byte-range check. HLS and DASH get a manifest check. Only verified sources are returned, with observed container, upstream status, and available codec hints.

The detail page offers one title or season picker when there are multiple groups. Watch Now plays the first entry in the selected group. Individual episodes open playback directly. The player has separate Quality and Servers panels. Title qualities are season-filtered and switch in place with resume. The HLS control offers Auto and available renditions. Server fallback keeps playback position, decoder fallback tries safer same-season qualities, and next episode follows the Android numbering rules.

The media gateway continues forwarding byte ranges and approved headers and rewriting HLS playlists to same-origin links. Its guarded upstream transport also protects the probes. Playwright verified the full fixture flow, including recovery from an HTTP 410 between probing and playback. All fourteen unit tests passed. Five of those cover the added stream and episode behavior. [Playwright run](web-phase-3/playback-e2e.json)

## Live browser playback matrix

Headless Chromium and Firefox loaded live provider streams through the updated Sources API and media gateway using native video or the application's hls.js version. A pass requires decoded video and at least 0.5 seconds of playback within 13 seconds. This check covers startup. FFprobe measurements appear when bounded inspection succeeded.

10 distinct titles advanced in at least one browser across 12 providers. Duplicate titles do not add to the title count. Browser versions were Chromium 157.0.8103.51 and Firefox 159.0. Video advanced for the 4KHDHub HEVC/E-AC-3 samples in Chromium. The Chromium decoder reported zero decoded audio bytes in the later focused run. Firefox did not decode video from those samples.

| Provider | Title | Container | Measured codecs | Chromium | Firefox |
| --- | --- | --- | --- | --- | --- |
| vega | The Beast | MP4 | H.264 + AAC | Plays | Plays |
| vega | The Beast | MKV | H.264 + AAC | Plays | Plays |
| 4khdhub | The Beast (2026) | MKV | HEVC + E-AC-3 | Plays | MediaError 3 |
| 4khdhub | The Beast (2026) | MKV | HEVC + E-AC-3 | Plays | Timed out |
| hdhub4u | The Great Indian Kapil Show | MKV | H.264 + AAC | Plays | Plays |
| anikoto | Solo Leveling Season 2: Arise from the Shadow | HLS | H.264 + AAC | fragLoadError | fragLoadError |
| anikoto | One Piece | HLS | Unidentified | Plays | Plays |
| animeworld | Arifureta: From Commonplace to World's Strongest | HLS | Unidentified | Plays | Plays |
| castle | Jailer 2 | HLS | H.264 + AAC | Plays | Plays |
| autoEmbed | Heart of the Beast | HLS | Unidentified | fragLoadError | fragLoadError |
| autoEmbed | Resident Evil | HLS | Unidentified | fragLoadError | fragLoadError |
| movieBoxWeb | Lucifer [Hindi] S1-S6 | MP4 | Unidentified | Plays | Plays |
| 1flex | Resident Evil | HLS | Unidentified | fragLoadError | fragLoadError |
| 1flex | Heart of the Beast | HLS | Unidentified | fragLoadError | fragLoadError |
| kickAssAnime | Bungo Stray Dogs 5 | HLS | AAC + H.264 | Plays | Plays |
| movielinkdb | Bachelor Point | MP4 | Unidentified | Plays | Plays |
| luxMovies | The Great Indian Kapil Show | MKV | H.264 + AAC | Plays | MediaError 3 |
| moviezwap | Money Heist Telugu Dubbed Season (01 to 05) | MKV | H.264 + AAC | Plays | Plays |
| movieswood | DNK | MKV | H.264 + AAC | Plays | Plays |

The sampled entries from 1TamilBlasters, HDMoviesLife, and KmMovies returned no healthy streams. The HLS fragment failures happened after the manifest passed its probe. [Browser evidence](web-phase-3/browser-playback.json) · [HTTP smoke mode evidence](web-phase-3/http-smoke.json)

## FFmpeg compatibility

Set K45_FFMPEG_PATH to a full FFmpeg executable to enable an optional alternative for verified MKV sources. It copies the video codec and converts the first audio track to stereo AAC in fragmented MP4. The conversion is sequential. The original media route continues supporting byte ranges. The server runs at most two conversions per process. It fetches the input through the guarded media transport and gives FFmpeg only pipe access.

The compatibility output played in Chromium and Firefox for the tested HDHub4u and LuxMovies H.264 samples. It restored playback in Firefox for the LuxMovies sample. The two tested 4KHDHub HEVC conversions did not decode within 13 seconds in either browser. The converter copies HEVC, so it cannot add HEVC support to a browser.

The three local runs processed a 30-second synthetic H.264/E-AC-3 MKV in 1.76–1.83 seconds of wall time and used 1.77–1.84 CPU-seconds each on an Intel i7-10875H. That is approximately 6% of one core at real-time input pace on this fixture. Live costs vary with audio, I/O, and hardware. [CPU benchmark](web-phase-3/ffmpeg-benchmark.json) · [Live conversion attempts](web-phase-3/compatibility-playback.json)

## Mirror verification and provider deadlines

Disney Mirror, Netflix Mirror, and Prime Mirror returned episodes in the Phase 2 series checks. In Phase 3, all three player endpoints returned HTTP 200, a video_link field, and application status otp. The vendored bundle requires status ok and returned zero records before the website applied source filters. The payload did not identify a missing cookie or header. The link was not verified as media. The Sources API now reports the one-time verification requirement and records the upstream HTTP status. [Player response diagnostics](web-phase-3/mirror-auth.json) · [Structured Sources API results](web-phase-3/mirror-verification.json)

The seven legacy provider IDs remain registered. Their individual before-and-after timings are in the provider report for Android follow-up. [Seven deadline providers](WEB_PROVIDER_PARITY.md#seven-operation-deadline-providers)

## Reproduction

Run from web. Start the production server on a local port and set K45_SMOKE_SITE_URL to its origin for browser tests. Set K45_SMOKE_FFPROBE to a local ffprobe for codec inspection. Set K45_FFMPEG_PATH for the fixture and benchmark, and start the server with that variable plus set K45_PLAYBACK_COMPAT=1 for the live conversion checks. The matrix uses a separately installed Playwright package with Chromium or Chrome and Playwright Firefox.

~~~sh
node scripts/provider-smoke/playback-e2e.mjs docs/web-phase-3/playback-e2e.json PLAYWRIGHT_INSTALL_ROOT CHROME_EXE
node scripts/provider-smoke/playback-matrix.mjs docs/web-phase-3/browser-playback.json PLAYWRIGHT_INSTALL_ROOT CHROME_EXE
node --conditions=react-server --import tsx scripts/provider-smoke/ffmpeg-benchmark.mts docs/web-phase-3/ffmpeg-benchmark.json
node --import tsx scripts/provider-smoke/run.mts deployed-smoke.json --url https://your-site.example
~~~

The deployed smoke mode runs every operation through the site's HTTP API and records external timings and structured errors. Omit the URL flag and add the react-server condition to observe the local provider runtime directly.
