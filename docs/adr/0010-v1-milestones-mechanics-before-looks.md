# ADR-0010: v1 milestones: install path first, mechanics before looks

- **Status:** Accepted
- **Date:** 2026-10-26

## Context

v1 is a complete, faithful Classic mode (ADR-0002), installable on Android (ADR-0001), with the neon look (ADR-0004) and audio (ADR-0008). Most of the work is AI-assisted and expected to take hours, not weeks, so the order should cut risk and rework rather than keep anyone motivated.

## Decision

Build v1 in this order. Each milestone ends with something checkable on the phone or in tests.

| # | Milestone | Done when |
|---|---|---|
| **M0** | Skeleton and install path | Vite + TypeScript + PWA shell is deployed over HTTPS and installed on the owner's Android phone. It runs fullscreen, landscape-locked and offline, showing an empty board. |
| **M1** | Simulation | The pure rules engine implements `docs/classic-rules.md` (steps, atoms and atom collisions, wall halves and slots, fills, coverage, lives, timer, scoring). It passes headless unit tests, including the spec's worked bonus example. |
| **M2** | Playable, plain-looking | Flat placeholder rendering (PixiJS) with swipe (ADR-0003) and mouse input. One level is playable on the phone. |
| **M3** | Complete game loop | Levels, HUD, pause/auto-pause, game over, scored and continue runs, local high scores, settings (ADR-0007). Feature-complete Classic, still plain-looking. |
| **M4** | Neon look | Glow, trails, wall-state effects, fill sweeps, particles (ADR-0004), with performance checked on the phone. |
| **M5** | Audio | Synth sound effects per game event, a music loop, separate switches, audio unlock (ADR-0008). |
| **M6** | Polish and v1 release | Device tuning (swipe threshold, effect strength), "rotate your device" screen, app icon and splash, final pass. |

## Consequences

- The install path, the riskiest outside dependency, is proven before any game code relies on it.
- Mechanics are verified against the spec before visuals are layered on, so effects don't get redone.
- Until M4 the game looks plain. That's accepted.
- Milestones M4 and M5 only touch the renderer and the shell (ADR-0005), not the simulation.
