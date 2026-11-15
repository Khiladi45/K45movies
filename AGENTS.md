# K45movies website

This branch contains the Next.js website. Work in web/ on feat/website. The Android app lives on main. Keep website commits on feat/website and preserve branch history.

Use Node 24. Run npm ci, npm run typecheck, npm run lint, npm test, and npm run build from web/. Local setup and environment variables are documented in web/README.md.

Provider bundles and Android playback references are pinned under web/vendor/android/. See web/docs/ANDROID_VENDOR.md for the source revision. Keep generated upstream bundles intact when porting website behavior. Provider calls and media traffic go through the Next.js server. Preserve public-destination checks, byte ranges, and HLS playlist rewriting. The website has no downloads feature.

Follow the approved phases in web/docs/WEB_FIX_FINDINGS.md and the requirements in web/docs/WEB_FIX_FOLLOW_UP.md. Commit and push to feat/website, then stop for approval at each phase boundary.
