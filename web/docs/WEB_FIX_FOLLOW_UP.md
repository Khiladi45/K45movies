# Website follow-up requirements

Recorded at Phase 1 approval on 15 November 2026. The original observations and evidence are in the [Phase 0 findings](WEB_FIX_FINDINGS.md).

## Phase 2 · Provider failures

Classify every failing provider before changing its behavior. Start with the seven catalog failures, seven posts failures, and sixteen search failures. Use the recorded status, timing, bundle error, and operation to compare these categories.

- Dead upstream that also fails in the app. Use Android bundle behavior and the API repository's URL checker as references.
- Website server-only failure. Check the 12-second request limit, User-Agent, server IP or TLS, port rules, rate limit, and invalid-URL handling.
- A reproducible provider or integration bug.

Fix server-only failures and reproducible bugs first. Implement a WAF solver only for providers shown to require interactive verification. Check and report how the search failures affect Movie Based search and provider matching.

## Phase 3 · Browser playback

Test real HLS, MKV, HEVC, and E-AC-3 samples in a browser. Report actual playback for each sample alongside the container and codec evidence. Include Vega's MP4 as the baseline.

## Phase 4 · Responsive and pointer bugs

Fix the 390 px detail view expanding to 564 px. Reproduce the Playback settings pointer failure and verify pointer and keyboard activation at 390 px after the fix.

## Phase 5 · Dependency audit

Address the seven moderate npm audit findings from Phase 0 or document why each remaining finding still applies.
