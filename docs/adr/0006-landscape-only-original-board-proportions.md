# ADR-0006: Landscape only, with the original board proportions

- **Status:** Accepted
- **Date:** 2026-10-26

## Context

The board's shape is part of the gameplay balance: atom travel distances, wall growth times, and so how the 75% target and the timer feel. Phones can be held upright or sideways. A board that changes shape per device would make Classic mode play differently on each one, which goes against ADR-0002.

## Decision

- Classic mode uses a **fixed board** in the original game's proportions, measured in **cells** (measured from the original: **28 × 20 cells**, see `docs/classic-rules.md` §1. The original's cells are 16 × 12 px, not square, and ADR-0009 keeps that shape: ≈ 1.87:1).
- The game runs in **landscape only**. The PWA manifest sets the landscape orientation. When the phone is held upright, the shell shows a "rotate your device" screen and pauses the game.
- The board is scaled uniformly to fit the screen. The leftover space (letterbox areas) is used for the HUD (level, lives, coverage, timer, score), not for board space.

## Consequences

- Every device plays exactly the same board, so scores and difficulty are comparable.
- The simulation works only in cell/board units. Pixels exist only in the renderer and in input mapping.
- On very wide phones (20:9 and wider), the side space is generous and suits a side HUD.
- A portrait or adaptive board can still come later as a separate mode with its own ruleset.
