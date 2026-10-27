# ADR-0019: Achievements as badges with progress, not unlocks

- **Status:** Accepted
- **Date:** 2026-10-27

## Context

Arcade's design (ADR-0018) planned "missions" that would unlock atom styles and themes. By the time they were built, all twelve atom styles and five themes were already free to everyone. Locking them behind goals would take away something players have.

## Decision

- **Achievements are badges.** There are 22, in five groups:
  - **All modes:** walls placed.
  - **Classic:** level reached, best score, and Atom trap: wall an atom in so tightly it can't move, i.e. all four diagonal cells filled (atoms only move diagonally, so it's stuck for good). Classic has no capture rule, so this only detects it.
  - **Arcade:** captures, Hat trick, Clean sweep, chain, board reached.
  - **Puzzle:** solved, stars, three stars on one.
  - **Daily:** played, streak, three stars.
- **Every achievement shows its progress** (e.g. "37 / 100") on the Achievements page, reached from the title screen. An unlocked one shows its date.
- **A notice slides in when one unlocks during play**, with a short chime, one at a time.
- **Achievements earned before they existed unlock quietly** when the game starts, so updating doesn't bring a flood of notices.
- **The game keeps lifetime stats for them:** walls placed, atoms captured, the most captures on one board, clean sweeps, the best chain, the furthest Arcade board, the furthest Classic level and the best Classic score. Puzzle and Daily achievements read the progress those modes already keep. The definitions are data (`src/game/achievements.ts`).

## Consequences

- Nothing in the game is locked. Rewards can be added later as new cosmetics that achievements unlock.
- A new achievement is one entry in the list, plus a stat if it needs one the game doesn't count yet.
- The stats double as personal records. A records page could show them without new tracking.
