# ADR-0016: Ask before switching to a new version, and check for one on resume

- **Status:** Accepted
- **Date:** 2026-10-26

## Context

The game is a PWA (ADR-0001) hosted on GitHub Pages (ADR-0011). Its service worker keeps an offline copy, so a new deploy reaches a device only after that copy notices it. At first the game used auto-update: it switched to a new version and reloaded by itself, which could happen in the middle of a game.

After switching to asking first, a phone could still miss updates for a long time. The browser only checks when the page loads. A phone keeps the game open for days, switching back to it doesn't reload it, and GitHub Pages lets the update-check file be cached for up to 10 minutes after a deploy. Chrome on Android has no hard refresh.

## Decision

- **Ask first.** When a new version has downloaded, a "Reload / Later" bar appears. It only shows on the title and game-over screens, so it never interrupts a game.
- **Check often.** The game checks for a new version when it opens, when it comes back to the foreground, when the title screen shows, and hourly. The automatic checks run at most once a minute.
- **A manual check.** Settings shows the running version (commit and date, stamped by the deploy workflow) and a "Check for updates" button that turns into "Reload to update".

## Consequences

- Nobody loses a game to an update, and an update reaches a phone within minutes of opening or returning to the game.
- The first switch from auto-update to this scheme still needed a reload by hand (closing the tab and reopening it).
- Testing updates needs a production build served locally (`preview` in `.claude/launch.json`). The dev server has no offline copy.
