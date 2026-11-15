# Phase 4 HLS follow-up

Re-ran the five fragment-failure samples from the Phase 3 matrix at 15 November 2026. The baseline used the Phase 3 proxy, and the retest used the corrected proxy. Selection matched the original provider, group and server in all five final reruns.

| Provider and title | Classification | Before | After |
| --- | --- | --- | --- |
| Anikoto · Solo Leveling Season 2: Arise from the Shadow | Content-type handling | The segment origin returned 200 with text/html and MPEG-TS sync bytes at 0, 188 and 376. The media route returned 502. The same origin returned 403 when the provider context headers were removed. | The same provider headers returned a 200 video/mp2t proxy response. Playback advanced without a fragment error. |
| AutoEmbed · Heart of the Beast | Proxy playlist rewriting | The nested Cinejoy playlist returned 200 application/octet-stream with an EXTM3U prefix. It bypassed rewriting. The browser resolved its relative MP4 and JPEG segment paths as unsigned proxy tokens and got 400. | The nested playlist and fragments were proxied successfully. Playback advanced. |
| AutoEmbed · Resident Evil | Proxy playlist rewriting | Same extensionless Cinejoy playlist and unsigned segment paths. | Playback advanced. |
| 1flex · Resident Evil | Proxy playlist rewriting | Same extensionless Cinejoy playlist and unsigned segment paths. | Playback advanced. |
| 1flex · Heart of the Beast | Proxy playlist rewriting | Same extensionless Cinejoy playlist and unsigned segment paths. | Playback advanced. |

The proxy now marks nested playlist tokens at the parent, including rendition URIs, and marks segments and initialization parts separately. When an HLS segment is labeled HTML, it checks for binary MPEG-TS sync bytes or an MP4 box before accepting it. An HTML body remains rejected. The range response, keys, and cross-origin cookie restrictions are preserved. The controlled checks cover relative variant and key URIs, extensionless nested playlists, EXT-X-MAP byte ranges, forwarded Referer, stripping cross-origin credentials, and preserving the original segment bytes.

The failures had observable upstream HTTP responses and proxy URL handling. The retest advanced in hls.js with the same client options used in the baseline. No client configuration change was needed. The Anikoto startup sometimes recovered through a subsequent fragment in the old proxy. The retest removed the reproducible 502 for the mislabeled segment.

[Before network evidence](web-phase-4/hls-before.json) · [After network evidence](web-phase-4/hls-after.json) · [Proxy fixture](web-phase-4/hls-fixture.json)
