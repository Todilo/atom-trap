# Atom Trap: Domain Glossary

*Atom Trap* is our neon remake of JezzBall (1992); see ADR-0012.

Shared vocabulary for the game. Use these terms in code, docs and conversation. Terms marked *(original)* follow the 1992 Windows Entertainment Pack game. Their exact values may change as we make decisions (see `docs/adr/`).

## Core terms

**Board:** The rectangular playing field. At the start of a level it is entirely open.

**Cell:** The unit of the board grid. The simulation measures board size, wall positions and fills in cells, never in pixels. Classic mode uses the original 28 × 20 grid in landscape (see ADR-0006), with 4:3 cells as in the original, giving a ≈ 1.87:1 board (see ADR-0009).

**HUD:** The on-screen status: level, lives, coverage, timer and score. It sits outside the board, in the leftover screen space.

**Atom collision:** When an atom moves into a cell holding another atom, the other atom takes over its direction and the mover bounces. Atoms never share a cell. *(original, read from its code)*

**Atom:** A ball that bounces around the open area of the board at constant speed, reflecting off board edges, filled areas and finished walls. *(original)*

**Wall:** What the player builds to divide the board. It starts at a point the player chooses and grows in two opposite directions at once. Each direction is a **wall half**. *(original)*

**Wall half:** One of the two growing segments of a wall. A wall half either **completes** (reaches a board edge or a filled area and becomes solid) or **breaks** (an atom touches it while it is still growing). Breaking costs a life. *(original)*

**Orientation:** Whether the next wall grows horizontally or vertically. The player switches it (right-click in the original). *(original)*

**Region:** A connected open area of the board, bounded by edges, completed walls and filled areas.

**Fill / filled area:** When a completed wall leaves a region with no atoms inside, that region is filled and permanently closed off. *(original)*

**Coverage:** The percentage of the board that is filled.

**Target coverage:** The coverage needed to clear a level. It is 75% in the original. *(original)*

**Lives:** How many wall halves the player can lose before the game ends. In the original, a level starts with as many lives as atoms. *(original)*

**Level:** One board to clear. In the original, levels aren't designed: level *n* has *n + 1* atoms and *n + 1* lives, capped at 50 atoms from level 49 on, and levels never end. Difficulty comes only from the atom count. Lives reset at the start of each level. *(original)*

**Level timer:** The countdown for reaching target coverage. Running out of time **ends the game** (see `docs/classic-rules.md` §7). It starts at 1000 + 250 × atoms units and counts 10 units per second. *(original)*

**Wallbuilder:** The original's name for the wall-placing cursor/tool. In this project it is just the origin plus orientation of the next wall. *(original)*

**Wall break:** When an atom touches a growing wall half, that half is removed and a life is lost. The other half keeps growing. *(original, partly reported)*

**Confidence tag:** How certain a rule in `docs/classic-rules.md` is: [confirmed], [reported] or [chosen].

**Capture points:** Points for each cell removed (filled or walled), more per cell when more atoms are in play. *(original)*

**Bonus:** Points awarded on clearing a level with lives left, made of four parts: coverage above 80% (tier 1), coverage above 90% (tier 2), lives left, and time left. Formulas are in `docs/classic-rules.md` §8. *(original, read from its code)*

**Step:** One unit of game movement. In a step, every atom moves one cell diagonally and every growing wall half grows one cell. The original runs a step every 100 ms on Fast. *(original)*

**Wall half slot:** The original has exactly one slot for each wall half (A: left/up, B: right/down). A half can only start when its slot is free. *(original)*

## Input

**Place wall (command):** The single game command every input produces: a wall origin plus an orientation. The simulation only sees this command (see ADR-0003).

**Origin:** The point a wall starts growing from. On touch it is where the finger first touched. On mouse it is the cursor position.

**Swipe threshold:** The minimum swipe distance before a touch counts as placing a wall. Shorter touches are ignored.

## Runs and progress

**Run:** One play-through from a starting level until game over (or quitting).

**Scored run:** A run that starts at level 1. Only scored runs can enter the high-score table (see ADR-0007).

**Continue run:** A run that starts at the highest level reached, with the score reset. It is clearly marked as unscored and never enters the high-score table.

**Highest level reached:** The highest level the player has started in any run. It sets where a continue run begins.

**High-score table:** The locally stored list of best scores from scored runs.

**Game over:** The end of a run, when the player has no lives left.

## Modes and rules

**Mode:** A way to play, defined by how it produces a ruleset for each level. Modes don't change the core mechanics (atoms, walls, fills) unless an ADR says otherwise.

**Classic mode:** The faithful reproduction of the original game's rules and progression. This is the v1 target (see ADR-0002).

**Ruleset:** The data that defines one level for the simulation: atom count, atom speed, starting lives, target coverage, time limit and scoring parameters. A mode generates the ruleset. The simulation only reads it.

## Architecture

**Simulation:** The pure, deterministic game logic. It takes commands, advances in ticks and emits game events. It has no rendering, DOM or real-time dependencies (see ADR-0005).

**Tick:** One fixed time step of the simulation. Tick rate is independent of frame rate.

**Game event:** Something the simulation reports happened during a tick (e.g. wall completed, wall half broken, region filled, life lost, level cleared). The renderer and audio react to events. They never change state.

**Renderer:** Draws simulation state with PixiJS and plays visual effects for game events.

**Shell:** The surrounding app: game loop, input to commands, audio, screens/menus, storage.

## Audio

**Sound effect (SFX):** A short sound played in response to a game event (see ADR-0008).

**Music track:** The single looping ambient background track. It can be switched off separately from SFX.

**Audio unlock:** Starting audio on the player's first tap or click, because mobile browsers block sound before that.

## Platform terms

**PWA:** The installable web build of the game (see ADR-0001).
