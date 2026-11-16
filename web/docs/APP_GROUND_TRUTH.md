# Android provider ground truth

Reference commit `a77aa81c9ae068e747d3c8b7b40809e895db0188`. The device results are pending. Per the owner's instruction, every entry in the Android registry is provisionally marked **assumed works**. This is an acceptance baseline and does not count as a measured Android run.

The 39 vendored registry IDs come from the pinned Android branch. The seven additional website IDs in the Android combined catalog bundle have Android catalog integration and are tracked separately in the comparison. The internal `moviesApi` helper has no standalone registry entry. [Android provenance](ANDROID_VENDOR.md) · [Per-provider comparison](PROVIDER_NETWORK_PARITY.md)

When device results arrive, record the Android build and network, provider ID, operation, exact test title and episode or quality for playback, result, and any error. An Android catalog pass and a playback pass are separate results. A test title shared with the website smoke can be reproduced with `K45_SMOKE_QUERY`.
