# ADR-0020: Publish on Google Play as a Capacitor app, built on GitHub Actions

- **Status:** Accepted
- **Date:** 2026-10-27

## Context

ADR-0001 shipped the game as a PWA and kept a Capacitor wrap open for later. The owner now wants it on Google Play. There are two ways to get a web game there:

1. **Capacitor:** the built game is packaged inside a native Android app.
2. **Trusted Web Activity (TWA):** a thin Chrome shell that opens the website. Google must verify the site through a file at the domain root, which a GitHub Pages project site (`todilo.github.io/atom-trap`) can't serve without a separate user-site repo or a custom domain.

This machine has no Java or Android SDK.

## Decision

- **Wrap with Capacitor.** App ID `com.todilo.atomtrapneon` (permanent once uploaded), name "Atom Trap: Neon". The game plays offline from the first launch, and the store reviews exactly the build players get.
- **One codebase, two builds.** `npm run build:app` (`vite build --mode app`) builds into `dist-app/` with relative paths and no service worker: `virtual:pwa-register` is aliased to a stub (`src/shell/noServiceWorker.ts`), so the update bar never shows and Settings says updates come from Google Play. `IN_APP` (`src/shell/platform.ts`) marks the few differences in code. The install button needs no change: a WebView never offers installing.
- **Native behaviour:**
  - Landscape (`sensorLandscape`) and full screen, with the system bars hidden until a swipe from an edge (`MainActivity`).
  - Android's back button pauses a game, otherwise presses the screen's own way back; on the menu it closes the app (`src/shell/native.ts`, `@capacitor/app`).
  - Vibration permission for haptics.
  - Icons and the launch screen use the game's own art and dark background (`npm run icons` also writes the Android icons).
- **Builds run on GitHub Actions** (`.github/workflows/android.yml`), from the Actions tab or a `v*` tag. Each run makes:
  - a release app bundle (`.aab`) for Play, signed with the upload key from repository secrets (unsigned without them);
  - a debug APK to install by hand.

  The run number is the `versionCode`, so every upload is higher than the last.
- **Play App Signing:** Google keeps the app signing key; we keep only an upload key, which Google can reset if it's lost.
- **Store material lives in `store/`:** listing text, screenshots and the feature graphic, made by `npm run store-capture` from the running game. The privacy policy is `public/privacy.html`, served at https://todilo.github.io/atom-trap/privacy.html.

## Consequences

- Every update to the app goes through a store upload and review. The web version still updates on every push.
- The `android/` project is in the repo. Web changes reach it with `npm run android` (build, then `cap sync`), which CI runs too.
- Links to the website's pages (privacy, licenses) open in the phone's browser from the app.
- Play Games, purchases and ads are all out of scope; the listing says there are none.
