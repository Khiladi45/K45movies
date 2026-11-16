# Android and website provider parity

Measured on 16 November 2026 with `npm run build` and `npm run start` from `web/`. The old GitHub Pages demo was outside the test. The Android results remain provisional under the owner's stated baseline. [Android ground truth](APP_GROUND_TRUTH.md) · [Next.js deployment guide](DEPLOY.md)

## Provider matrix

Results appear in the order **catalog / posts / search / metadata / episodes / verified sources**. `P` means the operation produced a usable result, `E` means an empty response, `F` means a failed operation, and `–` means the operation was skipped. P for sources means at least one passed the server probe for the sampled title. That does not establish browser decoding. YouTube uses a separate embedded player. All rows used the query Batman, the first available category, and the smoke-selected title. Compare title names in the evidence before attributing a different source result to a network change.

| Provider | Android | PC home | PC hotspot | Deployed host | Classification and evidence |
| --- | --- | --- | --- | --- | --- |
| 1flex | Assumed works | P / P / P / P / – / P | P / P / P / P / – / P | Pending | Sample passed its applicable checks. |
| 1tamilblasters | Assumed works | P / P / P / P / – / E | P / P / P / P / – / E | Pending | Other. The sampled stream produced no eligible result. Home stream empty; Hotspot stream empty. |
| 1tamilmv | Assumed works | P / P / P / F / – / – | P / P / P / F / – / – | Pending | Other. The sampled title returned no usable metadata. Home meta 404; Hotspot meta 404. |
| 4khdhub | Assumed works | P / P / P / P / – / P | P / P / P / P / – / E | Pending | Other. See the individual operation result. Hotspot stream empty. |
| Joya9tv | Assumed works | P / P / P / P / – / E | P / F / F / – / – / – | Pending | Other. See the individual operation result. Home stream empty; Hotspot posts 504, search 504. |
| anikoto | Assumed works | P / P / P / P / – / P | P / P / P / P / – / P | Pending | Sample passed its applicable checks. |
| animesalt | Assumed works | P / E / E / – / – / – | P / P / P / P / F / – | Pending | Other. Empty posts or search; no sample for playback. Home posts empty, search empty; Hotspot episodes 404. |
| animesub | Assumed works | P / P / P / P / – / E | P / P / P / P / – / E | Pending | Other. Sample yielded no verified stream. An earlier run recorded an upstream connect timeout. Home stream empty; Hotspot stream empty. |
| animeworld | Assumed works | P / P / P / P / P / P | P / P / P / P / P / P | Pending | Sample passed its applicable checks. |
| autoEmbed | Assumed works | P / P / P / P / – / P | P / P / P / P / – / P | Pending | Sample passed its applicable checks. |
| castle | Assumed works | P / P / P / P / – / P | P / P / P / P / – / P | Pending | Sample passed its applicable checks. |
| disneyPlus | Combined catalog; device pending | F / – / F / – / – / – | F / – / F / – / – / – | Pending | Runtime. Standalone website session differs from Android catalog; root cause open. Home catalog 504, search 504; Hotspot catalog 504, search 504. |
| drive | Assumed works | P / P / P / P / – / E | P / P / P / P / – / E | Pending | Other. Sample yielded no verified stream. Home stream empty; Hotspot stream empty. |
| dvdplay | Assumed works | P / P / F / P / – / E | P / P / F / P / – / P | Pending | Runtime. Search is intentionally unsupported. Sample stream separately yielded no verified media. Home search 422, stream empty; Hotspot search 422. |
| gokuHD | Assumed works | P / F / F / – / – / – | P / F / F / – / – / – | Pending | Other. Home posts timed out and search saw HTTP 403; earlier home run verified a source. Home posts 504, search 403; Hotspot posts 504, search 403. |
| hdhub4u | Assumed works | P / P / P / P / – / P | P / P / P / P / – / P | Pending | Sample passed its applicable checks. |
| hdmovieslife | Assumed works | P / P / E / P / – / P | P / P / E / P / – / P | Pending | Other. Search was empty in at least one run. Home search empty; Hotspot search empty. |
| hiAnime | Assumed works | P / F / F / – / – / – | P / F / F / – / – / – | Pending | Runtime. Required origin absent from the URL registry. Invalid URL before the target request. Home posts 502, search 502; Hotspot posts 502, search 502. |
| hotstar | Combined catalog; device pending | F / – / F / – / – / – | F / – / F / – / – / – | Pending | Runtime. Standalone website session differs from Android catalog; root cause open. Home catalog 504, search 504; Hotspot catalog 504, search 504. |
| kickAssAnime | Assumed works | P / P / P / P / – / P | P / P / P / P / – / P | Pending | Sample passed its applicable checks. |
| kissKh | Assumed works | P / P / P / P / – / P | P / P / P / P / – / P | Pending | Sample passed its applicable checks. |
| kmMovies | Assumed works | P / P / P / P / – / E | P / P / P / P / – / E | Pending | Other. Sample stream empty. Earlier tests found a TLS hostname mismatch on a source host. Home stream empty; Hotspot stream empty. |
| luxMovies | Assumed works | P / F / F / – / – / – | P / F / F / – / – / – | Pending | Other. Home posts and search saw upstream HTTP 403. The cause of the denial is unverified. Home posts 403, search 403; Hotspot posts 403, search 403. |
| marvel | Combined catalog; device pending | F / – / F / – / – / – | F / – / F / – / – / – | Pending | Runtime. Standalone website session differs from Android catalog; root cause open. Home catalog 504, search 504; Hotspot catalog 504, search 504. |
| movieBoxWeb | Assumed works | P / P / P / P / P / P | P / P / P / P / P / P | Pending | Sample passed its applicable checks. |
| movielinkdb | Assumed works | P / P / P / P / – / P | P / P / P / P / – / P | Pending | Sample passed its applicable checks. |
| movies4u | Assumed works | P / F / F / – / – / – | P / F / F / – / – / – | Pending | Other. Home posts/search timed out; separate stream sample reported invalid URL. Home posts 504, search 504; Hotspot posts 504, search 504. |
| moviesda | Assumed works | P / P / E / P / – / P | P / P / E / P / – / P | Pending | Other. Search returned no Batman match in at least one run. Home search empty; Hotspot search empty. |
| movieswood | Assumed works | P / P / F / P / – / P | P / P / F / P / – / P | Pending | Runtime. Search is intentionally unsupported. Home search 422; Hotspot search 422. |
| moviezwap | Assumed works | P / P / P / P / P / P | P / P / P / P / P / P | Pending | Sample passed its applicable checks. |
| multi | Assumed works | P / P / P / P / E / P | P / P / P / P / E / P | Pending | Other. Sample returned an empty episode list; the direct sources fallback could still work. Home episodes empty; Hotspot episodes empty. |
| mxplayer | Assumed works | P / P / P / F / – / – | P / P / P / F / – / – | Pending | Other. Sample lacked usable title metadata. Origin redirected in earlier tests. Home meta 404; Hotspot meta 404. |
| netflix | Combined catalog; device pending | F / – / F / – / – / – | F / – / F / – / – / – | Pending | Runtime. Standalone website session differs from Android catalog; root cause open. Home catalog 504, search 504; Hotspot catalog 504, search 504. |
| pixar | Combined catalog; device pending | F / – / F / – / – / – | F / – / F / – / – / – | Pending | Runtime. Standalone website session differs from Android catalog; root cause open. Home catalog 504, search 504; Hotspot catalog 504, search 504. |
| primeVideo | Combined catalog; device pending | F / – / F / – / – / – | F / – / F / – / – / – | Pending | Runtime. Standalone website session differs from Android catalog; root cause open. Home catalog 504, search 504; Hotspot catalog 504, search 504. |
| showbox | Assumed works | P / P / F / P / P / F | P / P / P / P / P / F | Pending | Other. Search reset and a sampled media endpoint returned upstream HTTP 404. Home search 502, stream 404; Hotspot stream 404. |
| starWars | Combined catalog; device pending | F / – / F / – / – / – | F / – / F / – / – / – | Pending | Runtime. Standalone website session differs from Android catalog; root cause open. Home catalog 504, search 504; Hotspot catalog 504, search 504. |
| torrentio | Assumed works | P / P / P / P / – / E | P / P / P / P / – / E | Pending | Other. Prior Android-bundle probe returned non-HTTP stream records; browser verification remains empty. Home stream empty; Hotspot stream empty. |
| uhd | Assumed works | P / F / F / – / – / – | P / F / F / – / – / – | Pending | Other. Home posts/search timed out in the final run; the earlier home run verified a source. Home posts 504, search 504; Hotspot posts 504, search 504. |
| uniquestream | Assumed works | P / F / F / – / – / – | P / F / F / – / – / – | Pending | Other. Home posts/search timed out in the final run; the earlier home run verified a source. Home posts 504, search 504; Hotspot posts 504, search 504. |
| vega | Assumed works | P / P / P / P / P / P | P / P / P / P / P / P | Pending | Sample passed its applicable checks. |
| zeefliz | Assumed works | P / F / F / – / – / – | P / F / F / – / – / – | Pending | Runtime. Required origin absent from the URL registry. Invalid URL before the target request. Home posts 502, search 502; Hotspot posts 502, search 502. |
| disneyMirror | Assumed works | P / E / P / P / – / F | P / E / P / P / – / F | Pending | Other. Catalog/search worked; player returned HTTP 200 with verification required. Home posts empty, stream 200; Hotspot posts empty, stream 200. |
| netflixMirror | Assumed works | P / E / P / P / – / F | P / E / P / P / – / F | Pending | Other. Catalog/search worked; player returned HTTP 200 with verification required. Home posts empty, stream 200; Hotspot posts empty, stream 200. |
| primeMirror | Assumed works | P / E / P / P / – / F | P / E / P / P / – / F | Pending | Other. Catalog/search worked; player returned HTTP 200 with verification required. Home posts empty, stream 200; Hotspot posts empty, stream 200. |
| youtube | Assumed works | P / P / P / P / – / F | P / P / P / P / – / F | Pending | Intentional. Embedded YouTube playback uses a different route from Sources. Home stream 422; Hotspot stream 422. |
| moviesApi | Internal helper | F / – / F / – / – / – | F / – / F / – / – / – | Pending | Intentional. Internal helper, no standalone provider entry. Home catalog 404, search 404; Hotspot catalog 404, search 404. |

The home and hotspot runs returned usable catalogs for 39 and 39 of 47 IDs, and verified sources for 17 and 17 IDs respectively.

On the same sampled title and server, 4KHDHub's Attack on Titan, CF Worker 1080p returned HTTP 206 MKV on home and HTTP 403 HTML on the hotspot. DVDPlay's same Ranabaali title returned no eligible candidate on home and a verified HTTP 206 HEVC/E-AC-3 MKV on the hotspot. These are directional observations from a single pair of runs. Neither identifies an ISP block or IP reputation cause, and verified E-AC-3 media can still be incompatible with a browser.

## Network experiments

The first home-network launch of the old Next.js build lost its local listener mid-run. Its subsequent fetch errors were excluded. A fresh process completed the baseline. The updated production build completed the home and hotspot comparisons shown above. [Old build on home network](provider-network-parity/website-before.json) · [Updated build on home network](provider-network-parity/website-home.json) · [Updated build on hotspot](provider-network-parity/website-hotspot.json)

The instrumented in-process run uses the website provider route and guarded transport. It records each failing or empty operation, elapsed time, upstream origins, status counts, and the first failing Undici request when an HTTP or transport failure event exists. The public URL origin and a target fingerprint identify the request without publishing credential-bearing paths, query parameters, or headers. Header names and selected safe values are included. Some empty results had only successful HTTP requests. Others failed before a valid request could be created, while several session operations exhausted the allotted time. An abort event in a bounded probe can reflect cancellation. The focused hotspot trace repeated the seven legacy providers and eight other failures. [Home operation trace](provider-network-parity/upstream-first-failures.json) · [Focused hotspot operation trace](provider-network-parity/upstream-hotspot-focused.json)

System DNS, Cloudflare DNS-over-HTTPS, and Google DNS-over-HTTPS were compared for 27 hosts from those operations. On the home run all three resolvers returned public addresses for each host. Five hosts had different public address sets. Differences alone do not identify ISP interference or SNI blocking. The hostname and IP comparisons are recorded for both networks. [Home DNS](provider-network-parity/dns.json) · [Hotspot DNS](provider-network-parity/dns-hotspot.json) · [Cloudflare DNS JSON docs](https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/dns-json/) · [Google Public DNS JSON docs](https://developers.google.com/speed/public-dns/docs/doh/json)

Standard Undici and curl made anonymous HEAD requests to nine sampled HTTPS origins with the Android Pixel 7 User-Agent and redirects disabled. All nine initial statuses matched, including LuxMovies' sampled origin returning 403 in both clients and Showbox's sampled media origin returning 404. These were origin health checks. The comparison does not isolate fingerprint effects on the failing provider path. The exact credential-bearing replays, raw Android transport capture, browser TLS impersonation, and deployed-host tests are outstanding. No evidence justified adding DoH routing, TLS impersonation, or outbound proxy support. The existing destination and redirect validation stayed in place. [Ordinary-client HEAD evidence](provider-network-parity/origin-head.json) · [Earlier mirror request capture](WEB_MIRROR_VERIFICATION.md#phase-5-request-comparison)

The Android app routes the seven legacy catalog adapters through its combined catalog bundle before falling back to other provider execution. The website loads their standalone API bundles. The website recorded session timeouts across both networks where applicable. That is a confirmed runtime difference. The precise cause of the upstream session behavior and Android device outcomes remain open. [Previous deadline timings](WEB_PROVIDER_PARITY.md#seven-operation-deadline-providers)

## Fixes and verification

- The stream verifier now checks the ranged response when HEAD advertises HTML. The regression fixture returned valid MP4 via ranged GET. The filter still rejects an HTML body and invalid HLS manifest. The production smoke counts varied between runs, so the fixture is the evidence for the specific fix.
- Watch Now reports provider, operation, stage, and each completed server check with its status, content type and reason. The player records decoder/container errors, browser media error codes, and HLS network details when available. The UI distinguishes upstream verification from a server that was actually tried. A failed catalog no longer leaves Home's hero skeleton in place.
- Typecheck, lint, the production build, 16 unit-test entries, and the Provider Based and Movie Based Playwright flows passed. The Provider Based run explicitly checks a 410 server and an invalid HTML response in both Watch Now and Provider Diagnostics, plus the normal play/switch/resume/next flow. [Provider Based](provider-network-parity/playback-provider.json) · [Movie Based](provider-network-parity/playback-movie.json)

## Reproduce

From `web/` with the production server running.

```sh
node --import tsx scripts/provider-smoke/run.mts website-home.json --url http://127.0.0.1:3200
node --conditions=react-server --import tsx scripts/provider-smoke/run.mts upstream.json
node scripts/provider-smoke/compare-dns.mjs upstream.json dns.json
node --import tsx scripts/provider-smoke/run.mts deployment.json --url https://your-nextjs-origin.example
```

## DNS parity proof, 16 November 2026

The historical home and hotspot files contain exactly two hosts with a non-empty system IPv4 set disjoint from both public DoH IPv4 sets. Testing only whether an address was public missed this difference.

| Host | Historical system IPv4 | Cloudflare and Google IPv4 | Historical IPv4 replay | Fresh IPv4 replay |
| --- | --- | --- | --- | --- |
| anime.uniquestream.net | 13.127.247.216 | 104.26.8.81, 104.26.9.81, 172.67.74.13 | Timed out at 4.5 s | HTTP 200 for all three |
| bzzhr.co | 125.21.240.67 | 104.18.2.146, 104.18.3.146 | TLS hostname verification failed | HTTP 403 for both |

The fresh system lookup matched both DoH resolvers for these hosts on the test connection. For all 27 captured origins the script resolved system, Cloudflare and Google answers, then used anonymous HTTPS HEAD with the original hostname as SNI and Host, verified the certificate, pinned each public address, and left redirects unfollowed. All 27 hosts returned an HTTP response on at least one answer. None of the 49 tested fresh IPv6 addresses returned HTTP on this connection. The HEAD result is an origin test. It cannot establish that a title or signed media URL works. The historical Anime UniqueStream result is consistent with an unreachable alternate endpoint. The prior bzzhr.co answer cannot serve this hostname over authenticated TLS, while the current address serves a separate HTTP access denial.

[Address and TLS evidence](provider-network-parity/doh-origin-check.json) · [System DNS production run](provider-network-parity/doh-system-before.json) · [DoH production run](provider-network-parity/doh-enabled-before-runtime-changes.json)

| Operation | System DNS usable | DoH usable |
| --- | ---: | ---: |
| catalog | 39 | 39 |
| posts | 33 | 32 |
| search | 29 | 29 |
| meta | 34 | 33 |
| episodes | 8 | 7 |
| stream | 21 | 22 |

| Provider | System DNS | DoH first |
| --- | --- | --- |
| 1flex | P / P / P / P / – / P | P / P / P / P / – / P |
| 1tamilblasters | P / P / P / P / – / E | P / P / P / P / – / E |
| 1tamilmv | P / P / P / F / – / – | P / P / P / F / – / – |
| 4khdhub | P / P / P / P / – / E | P / P / P / P / – / P |
| Joya9tv | P / P / P / P / – / P | P / P / P / P / – / E |
| anikoto | P / P / P / P / – / P | P / P / P / P / – / P |
| animesalt | P / E / E / – / – / – | P / E / E / – / – / – |
| animesub | P / P / P / P / – / E | P / P / P / P / – / E |
| animeworld | P / P / P / P / P / P | P / P / P / P / P / P |
| autoEmbed | P / P / P / P / – / P | P / P / P / P / – / P |
| castle | P / P / P / P / – / P | P / P / P / P / – / P |
| disneyPlus | F / – / F / – / – / – | F / – / F / – / – / – |
| drive | P / P / P / P / – / E | P / P / P / P / – / E |
| dvdplay | P / P / F / P / – / E | P / P / F / P / – / P |
| gokuHD | P / P / P / P / P / P | P / P / P / P / P / P |
| hdhub4u | P / P / P / P / – / P | P / P / P / P / – / P |
| hdmovieslife | P / P / E / P / – / P | P / P / E / P / – / P |
| hiAnime | P / F / F / – / – / – | P / F / F / – / – / – |
| hotstar | F / – / F / – / – / – | F / – / F / – / – / – |
| kickAssAnime | P / P / P / P / – / P | P / P / P / P / – / P |
| kissKh | P / P / P / P / – / P | P / P / P / P / – / P |
| kmMovies | P / P / P / P / – / E | P / P / P / P / – / E |
| luxMovies | P / P / E / P / P / P | P / P / E / P / P / P |
| marvel | F / – / F / – / – / – | F / – / F / – / – / – |
| movieBoxWeb | P / P / P / P / P / P | P / P / P / P / P / P |
| movielinkdb | P / P / P / P / – / P | P / P / P / P / – / P |
| movies4u | P / P / P / P / – / F | P / P / P / P / – / F |
| moviesda | P / P / E / P / – / P | P / P / E / P / – / P |
| movieswood | P / P / F / P / – / P | P / P / F / P / – / P |
| moviezwap | P / P / P / P / P / P | P / P / P / P / P / P |
| multi | P / P / P / P / E / P | P / P / P / P / E / P |
| mxplayer | P / P / P / F / – / – | P / P / P / F / – / – |
| netflix | F / – / F / – / – / – | F / – / F / – / – / – |
| pixar | F / – / F / – / – / – | F / – / F / – / – / – |
| primeVideo | F / – / F / – / – / – | F / – / F / – / – / – |
| showbox | P / P / F / P / P / F | P / F / F / – / – / – |
| starWars | F / – / F / – / – / – | F / – / F / – / – / – |

### Runtime reference and remaining gaps

The pinned Android network factory uses Cloudflare, Google, then system DNS, sorts IPv4 first, and configures 30-second connect, read, and write timeouts. The factory configures a React Native cookie-jar container. The React Native networking module attaches its WebView-backed cookie handler and flushes cookies through Android CookieManager. In contrast, the earlier web runtime used system lookup, a 12-second upstream request deadline, a 25-second operation deadline, and an operation-local cookie jar. [Android network factory](https://github.com/Khiladi45/K45movies/blob/a77aa81/native-src/android/com/vega/K45DohOkHttpFactory.kt)

At the reviewed Vega Desktop revision, the resolver allows Cloudflare, Google, Quad9 and AdGuard, includes NAT64 handling, and uses Chrome137 emulation. Its cookie jar is scoped by provider author and its queue allows three active operations and 32 waiting. Its optional relay applies destination checks. The web implementation uses its own TypeScript and Node transports. [Vega networking source](https://github.com/vega-org/vega-desktop/blob/b1a7c6881e9f1cb6a933f1929f0336c797366cc6/src-tauri/src/doh_client.rs) · [Vega networking documentation](https://github.com/vega-org/vega-desktop/blob/b1a7c6881e9f1cb6a933f1929f0336c797366cc6/docs/platform-networking.md)

On the seven legacy IDs, Android's `SandboxManager.hasBundledCatalog` selects `cncHome` specifically for `catalog` and `getPosts`. It executes the combined exports in its WebView sandbox with a 75-second budget and has a distinct path for other methods. The web runtime executes standalone API bundles with its Node Axios adapter. The combined catalog requires an upstream-verified session before parsing provider and studio trays. Reproducing the sandbox alone cannot establish that the upstream will issue a session to a web server. No supported server-side credential or verification flow was available in the reviewed material. [Android sandbox routing](https://github.com/Khiladi45/K45movies/blob/a77aa81/src/services/SandboxManager.ts)

The final web runtime adds a 30-second upstream budget, a 75-second provider-operation ceiling, a per-client queue with three active and 32 waiting, and visible status for slow catalog and playback requests. Shorter bundle timeouts still apply. Provider cookie jars are isolated by provider, honor cookie domain/path and expiration, and stay separate from bundle KV. Redis snapshot persistence is optional. The memory and Redis protocol fixtures both pass. Live multi-instance cookie synchronization has not been measured.

HTTP 403 by itself does not classify a TLS fingerprint block. Exact browser-TLS emulation against blocked providers and automated WAF verification were outside these tests. The UI retains the verified mirror OTP reason. The browser compatibility outcome is separate from source verification.
| torrentio | P / P / P / P / – / E | P / P / P / P / – / E |
| uhd | P / P / P / P / – / P | P / P / P / P / – / P |
| uniquestream | P / P / E / P / P / P | P / P / E / P / P / P |
| vega | P / P / P / P / P / P | P / P / P / P / P / P |
| zeefliz | P / F / F / – / – / – | P / F / F / – / – / – |
| disneyMirror | P / E / P / P / – / F | P / E / P / P / – / F |
| netflixMirror | P / E / P / P / – / F | P / E / P / P / – / F |
| primeMirror | P / E / P / P / – / F | P / E / P / P / – / F |
| youtube | P / P / P / P / – / F | P / P / P / P / – / F |
| moviesApi | F / – / F / – / – / – | F / – / F / – / – / – |

### Final Priority 1 production smoke

The same PC ran the final build with DoH, the longer provider budget, the three-operation client queue, and provider session persistence enabled. The Android-device and deployed-host columns from the earlier matrix still await independent measurements. The six-letter order remains catalog / posts / search / metadata / episodes / verified sources.

| Operation | System DNS baseline | Final production build |
| --- | ---: | ---: |
| catalog | 39 | 46 |
| posts | 33 | 40 |
| search | 29 | 37 |
| meta | 34 | 41 |
| episodes | 8 | 11 |
| stream | 21 | 29 |

| Provider | Baseline | Final | Observed cause or limitation |
| --- | --- | --- | --- |
| 1flex | P / P / P / P / – / P | P / P / P / P / – / P | Applicable sample checks passed. |
| 1tamilblasters | P / P / P / P / – / E | P / P / P / P / – / E | Sample stream had no verified source. |
| 1tamilmv | P / P / P / F / – / – | P / P / P / F / – / – | meta returned no usable title metadata. |
| 4khdhub | P / P / P / P / – / E | P / P / P / P / – / P | Applicable sample checks passed. |
| Joya9tv | P / P / P / P / – / P | P / P / P / P / – / E | No verified source for this title in the final run. The earlier system run found a source. |
| anikoto | P / P / P / P / – / P | P / P / P / P / – / P | Applicable sample checks passed. |
| animesalt | P / E / E / – / – / – | P / E / E / – / – / – | Empty catalog contents and search for the sampled category/query. |
| animesub | P / P / P / P / – / E | P / P / P / P / – / E | No verified source for the sample. |
| animeworld | P / P / P / P / P / P | P / P / P / P / P / P | Applicable sample checks passed. |
| autoEmbed | P / P / P / P / – / P | P / P / P / P / – / P | Applicable sample checks passed. |
| castle | P / P / P / P / – / P | P / P / P / P / – / P | Applicable sample checks passed. |
| disneyPlus | F / – / F / – / – / – | P / P / P / P / P / P | Old provider deadline. Final catalog took 38847 ms. |
| drive | P / P / P / P / – / E | P / P / P / P / – / E | No verified source for the sampled title. |
| dvdplay | P / P / F / P / – / E | P / P / F / P / – / P | Provider bundle does not support search. |
| gokuHD | P / P / P / P / P / P | P / P / P / P / P / P | Applicable sample checks passed. |
| hdhub4u | P / P / P / P / – / P | P / P / P / P / – / P | Applicable sample checks passed. |
| hdmovieslife | P / P / E / P / – / P | P / P / E / P / – / P | Empty Batman search, with usable catalog, posts and sources. |
| hiAnime | P / F / F / – / – / – | P / F / F / – / – / – | posts used an invalid URL before the target request. search used an invalid URL before the target request. |
| hotstar | F / – / F / – / – / – | P / P / P / P / – / P | Old provider deadline. Final catalog took 39922 ms. |
| kickAssAnime | P / P / P / P / – / P | P / P / P / P / – / P | Applicable sample checks passed. |
| kissKh | P / P / P / P / – / P | P / P / P / P / – / P | Applicable sample checks passed. |
| kmMovies | P / P / P / P / – / E | P / P / P / P / – / E | No verified source. The historical bzzhr.co system answer failed TLS, and current DNS produced an authenticated HTTP 403 on the origin. |
| luxMovies | P / P / E / P / P / P | P / P / E / P / P / P | search was empty for the sample. |
| marvel | F / – / F / – / – / – | P / P / P / P / – / P | Old provider deadline. Final catalog took 37809 ms. |
| movieBoxWeb | P / P / P / P / P / P | P / P / P / P / P / P | Applicable sample checks passed. |
| movielinkdb | P / P / P / P / – / P | P / P / P / P / – / P | Applicable sample checks passed. |
| movies4u | P / P / P / P / – / F | P / P / P / P / – / F | stream used an invalid URL before the target request. |
| moviesda | P / P / E / P / – / P | P / P / E / P / – / P | search was empty for the sample. |
| movieswood | P / P / F / P / – / P | P / P / F / P / – / P | Provider bundle does not support search. |
| moviezwap | P / P / P / P / P / P | P / P / P / P / P / P | Applicable sample checks passed. |
| multi | P / P / P / P / E / P | P / P / P / P / E / P | An episodes response was empty. The sampled direct-source fallback passed. |
| mxplayer | P / P / P / F / – / – | P / P / P / F / – / – | meta returned no usable title metadata. |
| netflix | F / – / F / – / – / – | P / P / P / P / P / P | Old provider deadline. Final catalog took 37905 ms. |
| pixar | F / – / F / – / – / – | P / P / P / P / – / P | Old provider deadline. Final catalog took 38258 ms. |
| primeVideo | F / – / F / – / – / – | P / P / P / P / – / P | Old provider deadline. Final catalog took 38508 ms. |
| showbox | P / P / F / P / P / F | P / P / P / P / P / F | stream endpoint returned upstream HTTP 404. |
| starWars | F / – / F / – / – / – | P / P / P / P / P / P | Old provider deadline. Final catalog took 38701 ms. |
| torrentio | P / P / P / P / – / E | P / P / P / P / – / E | No eligible HTTP/HTTPS source. The earlier reference run found non-HTTP records. |
| uhd | P / P / P / P / – / P | P / P / P / P / – / P | Applicable sample checks passed. |
| uniquestream | P / P / E / P / P / P | P / P / E / P / P / P | search was empty for the sample. |
| vega | P / P / P / P / P / P | P / P / P / P / P / P | Applicable sample checks passed. |
| zeefliz | P / F / F / – / – / – | P / F / F / – / – / – | posts used an invalid URL before the target request. search used an invalid URL before the target request. |
| disneyMirror | P / E / P / P / – / F | P / E / P / P / – / F | posts was empty for the sample. Upstream requires one-time verification. |
| netflixMirror | P / E / P / P / – / F | P / E / P / P / – / F | posts was empty for the sample. Upstream requires one-time verification. |
| primeMirror | P / E / P / P / – / F | P / E / P / P / – / F | posts was empty for the sample. Upstream requires one-time verification. |
| youtube | P / P / P / P / – / F | P / P / P / P / – / F | Embedded playback uses a separate route. Direct Sources is intentionally unsupported. |
| moviesApi | F / – / F / – / – / – | F / – / F / – / – / – | Internal helper. The manifest excludes it. |

All seven legacy providers passed catalogs and verified sources. Their final first catalog calls took 37.8–39.9 seconds, past the previous 25-second cap. DoH alone left all seven failing. The production result demonstrates recovery with the runtime changes combined. It does not isolate the impact of cookie persistence from the longer runtime budget.

All seven also started live HLS playback in both Chromium and Firefox. Each sample required decoded video and at least 0.5 seconds of playback. The playback run includes Disney Mickey Mouse Clubhouse, Valiant One, Captain America: The First Avenger, Squid Game, Inside Out 2, Deewane Huye Paagal and Star Wars: The Bad Batch. This establishes sample playback and leaves coverage of other titles and networks open. [Live legacy playback](provider-network-parity/priority-one-live-legacy.json)

[Final HTTP smoke](provider-network-parity/priority-one-final.json) · [Provider Based Playwright](provider-network-parity/priority-one-e2e-provider.json) · [Movie Based Playwright](provider-network-parity/priority-one-e2e-movie.json) · [Queue, cookie and security tests](provider-network-parity/priority-one-server-tests.txt)

## Priority 1b · Registry, session and title coverage

The scanner inspected all 39 vendored bundles against K45movies-api revision 895578addb410981a042f7ce908867b4dc5d494d. Twenty-six use urls.json. The only missing literal/resolved lookup keys are `consumet` (HiAnime) and `zeefliz` (ZeeFliz). The app now reports “No upstream address is published for this provider yet” from the live registry, without inventing fallback addresses. Castle retains its bundle-defined fallback. [Registry scan](provider-network-parity/registry-keys.json)

| Legacy provider | Cold with DoH | Warm catalog | Warm session, uncached catalog |
| --- | ---: | ---: | ---: |
| disneyPlus | 38550 ms | 0 ms | 310 ms |
| hotstar | 38650 ms | 0 ms | 343 ms |
| marvel | 38502 ms | 0 ms | 302 ms |
| netflix | 37429 ms | 0 ms | 354 ms |
| pixar | 37802 ms | 0 ms | 304 ms |
| primeVideo | 39324 ms | 0 ms | 653 ms |
| starWars | 40631 ms | 0 ms | 617 ms |

Each cold session produced 17 requests. Most were serial session checks. Each HTTP response was usually a few hundred milliseconds, and the gaps between polls accounted for most of the 37–41 seconds. For a fresh Netflix process, the 25-second ceiling cut off the session after 11 requests, while the 75-second budget completed in 37.43 s using DoH and 37.87 s with system DNS. A warm session made the full uncached catalog request in 354 ms with DoH or 285 ms with system DNS. The immediate cache repeat rounded to 0 ms in process. These runs separate the timeout and DNS controls for Netflix and the warm session from the catalog cache for all seven. They did not test a live Redis service or a cross-machine warm session. Catalogs are fresh for 15 minutes, served stale while one background request refreshes them for up to 24 hours, and eligible for optional Redis-backed persistence. [Timing traces](provider-network-parity/1b-legacy-timings.json)

| Provider | Published categories sampled | Title search | Verified sources |
| --- | ---: | --- | --- |
| 1tamilblasters | 3 | pass / pass / pass | empty / fail / empty |
| animesub | 3 | pass / pass / pass | empty / empty / empty |
| drive | 3 | pass / pass / pass | empty / pass / fail |
| Joya9tv | 2 | pass / pass | empty / pass |
| kmMovies | 3 | pass / pass / pass | empty / empty / pass |
| hdmovieslife | 3 | pass / pass / pass | pass / pass / pass |
| moviesda | 3 | empty / empty / empty | pass / pass / pass |
| luxMovies | 3 | pass / pass / pass | pass / pass / pass |
| uniquestream | 3 | empty / empty / empty | pass / empty / pass |
| animesalt | 0 | – | – |

The sample used distinct titles from different categories where categories yielded posts. Joya9tv supplied two distinct categories and an additional search returned results. Animesalt returned no posts in three attempted categories and no results for three alternative search queries, so no titles could be inspected there. Individual titles, timings and upstream/probe errors are in the trace. [Real-title samples](provider-network-parity/1b-category-titles.json)

A provider receives a healthy status only after a source probe has passed. Torrent-only responses identify the browser limitation without exposing magnet links. The mirror OTP classification continues to display Needs verification. A normal authenticated TLS probe previously established HTTP 403 at bzzhr.co, but the response did not establish a fingerprint cause. No third-party TLS impersonation feature was added.
