# ADR-0002: Faithful Classic mode as the core, rules expressed as data

- **Status:** Accepted
- **Date:** 2026-10-26

## Context

The remake promises updated graphics. Gameplay could be copied exactly, extended or reimagined. A faithful version gives a clear, checkable goal: it should play like JezzBall. The owner also wants room for new modes later.

## Decision

- The first playable target is **Classic mode**, which reproduces the original rules: level *n* has *n + 1* atoms and *n + 1* lives, 75% target coverage, a level timer, and level bonuses for coverage above 80% and 90%, lives left and time left (full spec: `docs/classic-rules.md`).
- Gameplay rules live in a **ruleset**: plain data (atom count, atom speed, lives, target coverage, time limit, scoring) produced per level by a mode. The simulation reads the ruleset and has no hardcoded Classic numbers.
- Extra modes (new atom types, power-ups, a relaxed mode without a timer, etc.) are allowed later but are **not** part of the first version. Each gets its own ADR when it is picked up.

## Consequences

- "Done" for v1 is measurable: Classic mode matches the original's behavior and numbers.
- Where the original's exact values are unknown (atom speed, timer formula, scoring formula), we research them or choose them and record the choice. We don't guess silently.
- A new mode mostly means a new ruleset generator. Mechanics that the ruleset can't express (e.g. power-ups) will need simulation changes, handled when they come up.
