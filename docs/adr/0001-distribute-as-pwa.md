# ADR-0001: Distribute as an installable PWA, wrap with Capacitor later if needed

- **Status:** Accepted
- **Date:** 2026-10-26

## Context

The game is a JezzBall remake built with web technology. The owner wants to install it on an Android phone. There are three ways to get there:

1. A Progressive Web App, installed from Chrome ("Add to Home screen" / "Install app").
2. A Capacitor-wrapped APK, installed by hand.
3. A Capacitor-wrapped app published on the Google Play Store.

## Decision

Ship the game as an installable **PWA** first, with a web app manifest, a service worker for offline play, fullscreen display and a home-screen icon.

Keep the game code free of browser-only assumptions that would block a later Capacitor wrap. That means no reliance on browser chrome or URL routing for core flow, and storage goes through one small adapter.

## Consequences

- No app store account, signing or review is needed. A deploy to static hosting is a release.
- The game must be served over HTTPS, have a valid manifest and work offline to be installable.
- Play Store distribution stays possible later by wrapping the same build with Capacitor. Doing so would get its own ADR.
- Android-only features (Play Games, native haptics beyond the Vibration API) are out of scope until that wrap happens.
