# ADR-0005: TypeScript + Vite, a pure simulation, and PixiJS for rendering

- **Status:** Accepted
- **Date:** 2026-10-26

## Context

The game must run smoothly as a PWA on mid-range Android phones (ADR-0001), reproduce the original rules exactly and testably (ADR-0002), and render neon glow, trails and particles (ADR-0004). Canvas 2D blur and shadow effects are too slow on mobile. General game frameworks bring physics engines that don't fit JezzBall's exact grid collisions.

## Decision

- **Language/build:** TypeScript, built with Vite. PWA manifest and service worker via `vite-plugin-pwa`.
- **Simulation:** our own pure TypeScript module, with no DOM, rendering or timer dependencies. It advances in **fixed ticks**, takes commands (e.g. *place wall*, ADR-0003) as input, and exposes read-only state and **game events** (wall completed, wall half broken, region filled, level cleared, …) as output. It is deterministic given a seed and a command sequence.
- **Renderer:** PixiJS (WebGL) draws the simulation state, interpolating between ticks, and turns game events into effects. It never changes simulation state.
- **Shell:** a thin layer that owns the game loop, input handling, audio, screens/menus and storage, and wires the three together.

## Consequences

- Rules can be unit-tested and replayed headlessly. A "Classic matches the original" test suite is possible.
- Rendering skins can be swapped without touching game logic.
- Frame rate and tick rate are independent, so the game plays the same on 60 Hz and 120 Hz screens.
- We write the collision, wall and fill logic ourselves. That is deliberate, but it is the main implementation risk.
- PixiJS is a dependency to keep updated. Its filters (glow/bloom) must be checked for performance on a real phone early.
