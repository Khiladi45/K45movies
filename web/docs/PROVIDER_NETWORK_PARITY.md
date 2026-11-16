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
