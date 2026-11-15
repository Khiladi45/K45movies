# Mirror playback verification at a77aa81

The vendored disneyMirror, netflixMirror, and primeMirror bundles call their player endpoint with a static request profile and an empty Usertoken header. All three require response status ok before reading video_link. None branches on otp, reads or writes kvStore for this flow, calls openWebView, or acquires a verification cookie. The provider registry routes them as ordinary local bundles. The Android provider context exposes a general WebView verification helper, but none of these three bundles invokes it.

I inspected the three vendored bundles, Android providerApi and providerContext, the Android provider registry and WebView helper, and searched the Android UI for the three IDs and OTP handlers. The only mirror-specific app entries outside the bundles were registry mappings. This is a source audit. No Android device playback was measured.

The same three bundles received HTTP 200 with application status otp in the Phase 3 probe. The payload did not identify a browser completion URL or supported verification exchange. The bundled app supplies no equivalent workflow to port. The website reports the provider's verification requirement when the user starts playback and in provider health. The observed video_link field was not used as a verification page or a media source.

[Phase 3 response capture](web-phase-3/mirror-auth.json) · [Website structured errors](web-phase-3/mirror-verification.json) · [Android snapshot](ANDROID_VENDOR.md)
