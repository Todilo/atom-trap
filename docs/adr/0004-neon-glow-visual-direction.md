# ADR-0004: Neon / glow minimal visual direction

- **Status:** Accepted
- **Date:** 2026-10-26

## Context

"Updated graphics" is the main reason for the remake. JezzBall's screen holds only a few kinds of objects: board, atoms, growing walls, completed walls and filled areas. Every one of them is gameplay information. The game has to run smoothly on mid-range Android phones as a PWA (ADR-0001).

## Decision

The game uses a **neon / glow minimal** style:

- A dark board, so glowing elements stand out (and OLED screens save battery).
- **Atoms** are glowing orbs with short motion trails.
- **Growing walls** are bright beams with a clearly visible growing tip. While a wall half is vulnerable, it looks distinct from a completed wall (e.g. flickering or crackling).
- **Completed walls** settle into a steady, calmer glow.
- **Filled areas** sweep in with a pulse and stay as a dim, textured surface that is clearly "closed".
- Breaking a wall half or losing a life gets a strong, short effect (flash, shatter particles).

The style keeps gameplay readable: no decoration that could be mistaken for an atom or a wall, and color is never the only signal for a game state.

## Consequences

- The renderer must support additive blending, blur/bloom-style glow and particles cheaply on mobile GPUs. This drives the rendering-stack decision.
- The palette and effect strength should be tuned on a real phone, in daylight as well as in the dark.
- Original-style art could still come later as an alternative skin, as long as rendering stays separate from the simulation.
