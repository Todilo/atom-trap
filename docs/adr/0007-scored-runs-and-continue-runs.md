# ADR-0007: Scored runs from level 1, plus unscored "continue" runs

- **Status:** Accepted
- **Date:** 2026-10-26

## Context

In the original, game over meant starting over at level 1. That keeps the high-score chase meaningful but is frustrating on a phone, where sessions are short and replaying many easy levels is tedious.

## Decision

- A **scored run** always starts at level 1. Only scored runs can enter the **high-score table**.
- The game stores the **highest level reached** across all runs.
- After game over (and from the main menu), the player can start a **continue run** at the highest level reached. A continue run starts with a score of 0, shows a clear "unscored" marker, and never enters the high-score table.
- Lives at the start of any level follow the ruleset (ADR-0002). Continuing does not give extra lives beyond what Classic would give at that level.
- Progress (highest level reached, high-score table) is stored locally through the storage adapter (ADR-0001).

## Consequences

- High scores are directly comparable to the original game's.
- Players can practise late levels without replaying early ones.
- No accounts or online leaderboards are needed. Online leaderboards would need their own ADR.
- Clearing site data or uninstalling the PWA loses progress. That's acceptable for v1.
