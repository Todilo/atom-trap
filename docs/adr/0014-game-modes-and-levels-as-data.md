# ADR-0014: Game modes beside Classic, and levels described as data

- **Status:** Accepted
- **Date:** 2026-10-26

## Context

ADR-0002 made Classic the core and allowed more modes later. A first batch of "modern" modes was planned (Daily, Arcade, a relaxed mode), and the menu, HUD and high scores were all built around Classic alone. A relaxed "Zen" mode (no timer, no lives) was considered and dropped: with nothing to win or lose, it gave little reason to play.

Classic varies only the random seed between games, so on its own it can't make boards that feel different from day to day or puzzle to puzzle.

## Decision

- **Modes are a list** (`src/game/modes.ts`): name, blurb, rules, and whether the mode is playable yet. The title screen shows a card per mode, and the high scores page has a tab per mode. Placeholders show "Soon".
- **Board layouts** (`src/sim/layouts.ts`) are cells that start filled, drawn as 28 × 20 text maps (`#` filled, `.` open). The simulation takes them as an option. Coverage is measured over the cells the player can clear, so a layout gives no free points. An atom-free pocket is filled before play.
- **A level is a description** (`src/sim/levels.ts`): a Classic level's numbers, optional rule tweaks (atoms, lives, time, target, speed, wall limit), an optional layout and a seed. The same description always gives the same starting board. Classic is the description with no tweaks and no layout.
- The ruleset gains **untimed levels** (time limit 0) and an optional **wall limit**.

## Consequences

- Puzzle (ADR-0015) and Daily are built from descriptions, with no special cases in the simulation.
- Classic is unchanged: it goes through the same path with nothing added.
- Mechanics a description can't express (new atom types, power-ups for Arcade) still need simulation work, as ADR-0002 expected.
