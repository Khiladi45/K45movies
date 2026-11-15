# Android reference for the website

Vendored on 15 November 2026 from GitHub main at a77aa81c9ae068e747d3c8b7b40809e895db0188. The files retain their Android source paths under the vendor directory. [Upstream commit](https://github.com/Khiladi45/K45movies/commit/a77aa81c9ae068e747d3c8b7b40809e895db0188)

- [Provider bundles](../vendor/android/src/providers/bundles) contains all 39 bundles from that revision.
- [Provider registry](../vendor/android/src/providers/registry.js) lists the provider IDs and their module sets. Its [type declaration](../vendor/android/src/providers/registry.d.ts) is included.
- [Stream selection](../vendor/android/src/lib/streams.ts), [episode helpers](../vendor/android/src/lib/episodes.ts), and [player switching](../vendor/android/src/lib/playerSwitch.ts) are references for the browser implementation.

The snapshot is copied byte for byte. The web provider runtime still uses its existing API source until Phase 2. The playback references retain Android imports and are outside the Next.js typecheck and lint source sets. The repository's AGPL license applies.
