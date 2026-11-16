# Mirror playback verification at a77aa81

The vendored disneyMirror, netflixMirror, and primeMirror bundles call their player endpoint with a static request profile and an empty Usertoken header. All three require response status ok before reading video_link. None branches on otp, reads or writes kvStore for this flow, calls openWebView, or acquires a verification cookie. The provider registry routes them as ordinary local bundles. The Android provider context exposes a general WebView verification helper, but none of these three bundles invokes it.

I inspected the three vendored bundles, Android providerApi and providerContext, the Android provider registry and WebView helper, and searched the Android UI for the three IDs and OTP handlers. The only mirror-specific app entries outside the bundles were registry mappings. This is a source audit. No Android device playback was measured.

The same three bundles received HTTP 200 with application status otp in the Phase 3 probe. The payload did not identify a browser completion URL or supported verification exchange. The bundled app supplies no equivalent workflow to port. The website reports the provider's verification requirement when the user starts playback and in provider health. The observed video_link field was not used as a verification page or a media source.

[Phase 3 response capture](web-phase-3/mirror-auth.json) · [Website structured errors](web-phase-3/mirror-verification.json) · [Android snapshot](ANDROID_VENDOR.md)

## Phase 5 request comparison

For each provider, I called the real website Sources resolver and captured its outbound Undici request. I passed the same public title ID and resolved endpoint into the a77aa81 bundle and captured what it handed to Axios before native transport. The resolver response was replayed for the Android source comparison. No Android device was available to capture what its native transport sends.

| Provider | Player URL on both sides | Website response |
| --- | --- | --- |
| disneyMirror | `https://tv.imgcdn.kim/newtv/player.php?id=1271721229` | HTTP 200, `otp` |
| netflixMirror | `https://tv.imgcdn.kim/newtv/player.php?id=80244455` | HTTP 200, `otp` |
| primeMirror | `https://tv.imgcdn.kim/newtv/player.php?id=0OWK03MO2F6JPCMHYRQWJMDPUY` | HTTP 200, `otp` |

All three used GET and supplied the same `Accept`, `Cache-Control`, `Expires`, `Pragma`, `User-Agent`, empty `Usertoken`, and `X-Requested-With`. The UA is the bundle's Windows Firefox 136 / OS.GatuNewTV v1.0 string. Both captures omit Cookie, Referer, and Origin. Undici additionally sent `Accept-Encoding: br, gzip, deflate, zstd`, `Accept-Language: *`, and `Sec-Fetch-Mode: cors`.

The website status is **Needs verification** and the player explains the one-time verification requirement. Android playback and device/IP reputation remain unverified. The additional transport headers establish a request-profile difference against the bundle trace. They do not identify what caused the `otp` response.

[Exact application request and website transport capture](web-phase-5/mirror-requests.json)
