# Classic mode: rules spec

The rules for **Classic mode** (ADR-0002): what the simulation must do and the numbers its ruleset uses. Terms are defined in [CONTEXT.md](../CONTEXT.md).

Researched 2026-10-26 in three passes:

1. Web sources.
2. The original game (Windows 3.x JezzBall by Dima Pavlovsky, 1992) running in the Internet Archive's emulator, plus its help file `JEZZBALL.HLP`.
3. A disassembly of the original `JEZZBALL.EXE`, a 16-bit Windows program written in Turbo Pascal for Windows. Its rules and numbers were read straight from the code. Notes on how: [original-binary-notes.md](original-binary-notes.md).

Every rule has a **confidence tag**:

| Tag | Meaning |
|---|---|
| **[confirmed]** | Read from the original's code, stated in its help file, or measured in the original. Implement as written. |
| **[reported]** | Web sources only. Implement as written, but treat it as unverified. |
| **[chosen]** | The original doesn't define it, or we deliberately differ. This is our own value. |

---

## 1. Board

| Rule | Value | Confidence |
|---|---|---|
| Shape | Fixed rectangle, landscape (ADR-0006) | [confirmed] |
| Grid size | **28 × 20 cells** (28 columns, 20 rows) | [confirmed]: code (playfield 1..30 × 1..22 including a border ring, coverage divides by 560), pixel measurement, and the help file's scoring example (70 points per column = 20 × 3.5, 98 per row = 28 × 3.5) |
| Cell shape | **4:3 (16 × 12 px in the original)**, so the board is ≈ 1.87:1. Kept as in the original (ADR-0009). | [confirmed] measurement, kept by decision |
| Discrete grid | Everything lives on the grid. An atom occupies one cell and moves exactly one cell diagonally per **step**. A wall grows one cell per step. The renderer may interpolate between steps for smooth motion. | [confirmed] (code) |

## 2. Speed and steps

| Rule | Value | Confidence |
|---|---|---|
| Speed settings | **Fast** (the default) and **Slow** | [confirmed] (help file + code) |
| Step length | Fast: **one step every 100 ms** (a 50 ms Windows timer, with moving and checking on alternate ticks). Slow: one step every 200 ms (100 ms timer). | [confirmed] (code) |
| Resulting speeds | Fast: atoms and wall halves both move **10 cells/second**. Slow: 5 cells/second. Atoms and walls always move at the same rate. | [confirmed] (code) |
| Slow-speed scoring | Every point award (capture points and the level bonus) is **halved** on Slow | [confirmed] (code + help file) |
| Classic in the remake | Fast only. Slow could come back as an easy option. | [chosen] |

## 3. Atoms

| Rule | Value | Confidence |
|---|---|---|
| Atom count | Level 1 has **2** atoms, and each level clear adds 1 | [confirmed] (code) |
| Cap | **50 atoms**: the count only goes up while it is below 50, so level 49 onwards has 50. Levels never end. | [confirmed] (code) |
| Movement | Diagonal only (±1, ±1 cells per step). Reflects off board edges, walls and removed cells. | [confirmed] (code) |
| Atom–atom collisions | **Atoms collide.** Each grid cell records which atom is in it, and a cell with an atom counts as blocked. When an atom's next cell (sideways, vertically or diagonally) holds another atom, the other atom **takes over the mover's direction** on that axis, and the mover **bounces** as if it hit a wall. One atom per cell, so atoms never overlap. | [confirmed] (code). It matches the tips guide's report of atoms wedging against each other. |
| Starting positions | Random, random diagonal direction (seeded, ADR-0005) | [chosen]: the original's exact placement rule wasn't traced |
| Spin animation | Each atom cycles through 11 animation frames | [confirmed] (code). Visual only. |

## 4. Walls

The original calls the wall-placing tool the **wallbuilder**.

| Rule | Value | Confidence |
|---|---|---|
| Orientation | Right-click switches vertical/horizontal. Each level starts on **vertical**. | [confirmed] (help file + code) |
| Click timing | A click is queued and applied on the next step | [confirmed] (code) |
| Two halves, two slots | A wall is two independent **halves**. Half A starts on the clicked cell and grows left (or up). Half B starts on the next cell right (or down) and grows right (or down). There is exactly **one slot per half**. | [confirmed] (code) |
| Starting a half | Each half starts only if its slot is free **and** its start cell is open. So a click next to a wall gives a one-sided wall. A click while half A is still growing starts only half B. You can never have more than one A-half and one B-half growing. | [confirmed] (code) |
| Growth | Each step, a half moves into the next cell. If that cell is outside the board or already removed, the half **completes**. | [confirmed] (code) |
| Completing | The half's cells become removed cells. Then empty regions are filled (§5). | [confirmed] (code) |
| Breaking | If an atom is in any of the **8 cells around** a growing wall cell (diagonals included), that half breaks. Its cells become open again, and the player loses **1 life**. The other half carries on. | [confirmed] (code + help file: "a partial wall is left behind but the cost is one chamber life") |

## 5. Filling and coverage

| Rule | Value | Confidence |
|---|---|---|
| When to fill | Each time a wall half completes | [confirmed] (code) |
| Fill | Every region with no atoms is removed | [confirmed] (code + help file) |
| Coverage ("area cleared") | Removed cells (wall cells included) ÷ 560, kept as an exact fraction (no rounding) | [confirmed] (code) |
| Level clear | Coverage **≥ 75%** *and* no wall half still growing | [confirmed] (code) |

## 6. Lives

| Rule | Value | Confidence |
|---|---|---|
| Lives per level | Each level starts with **lives = atom count** (2 at level 1, 8 at level 7). Lives don't carry over. | [confirmed] (code). This settles the help file's off-by-one level 7 example: the code gives 8. |
| Losing a life | Only by breaking a wall half | [confirmed] (code) |
| Game over | Lives reach 0, or the timer runs out | [confirmed] (code + help file) |

## 7. Level timer

| Rule | Value | Confidence |
|---|---|---|
| Starting time | **1000 + 250 × atoms** units: 1500 at level 1, 1750 at level 2 … 13 500 from level 49 on | [confirmed] (code) |
| Tick rate | **10 units per second** at both speeds (one unit per step on Fast, two per step on Slow). Level 1 is 150 seconds. | [confirmed] (code) |
| Warning | A warning sound plays when 200 units (20 s) are left | [confirmed] (code) |
| Time-out | **Game over** (lives are set to 0). The game does not just take a life. | [confirmed] (code + help file) |
| Pause | The timer stops while paused or minimised | [confirmed] (help file) |

## 8. Scoring

Let **k = atoms + 5** (7 at level 1). All points below are for Fast. Halve them on Slow.

| Rule | Value | Confidence |
|---|---|---|
| Capture points | **k points per removed cell**, awarded when cells are removed (wall cells and filled regions alike). Level 1: 7 per cell (3.5 on Slow, matching the help file). | [confirmed] (code + help file) |
| Level bonus | Awarded only on a level clear with lives left | [confirmed] (code) |
| Coverage bonus, tier 1 | **50 × k × (coverage% − 80)** if coverage is above 80% | [confirmed] (code) |
| Coverage bonus, tier 2 | **100 × k × (coverage% − 90)** if coverage is above 90%, added on top of tier 1 | [confirmed] (code) |
| Lives bonus | **250 × k × lives left** | [confirmed] (code). The help file doesn't mention it. |
| Time bonus | **1 point per timer unit left** (not scaled by k) | [confirmed] (code). The help file doesn't mention it. |
| Coverage % in bonuses | Exact percentage, with fractions (e.g. 83.4) | [confirmed] (code) |

Worked example, level 1 on Fast, cleared at 85% with 2 lives and 900 units left: tier 1 = 50 × 7 × 5 = 1750, lives = 250 × 7 × 2 = 3500, time = 900, so the bonus is **6150**.

## 9. Controls in the original (for reference)

F2 starts a new game, F3 pauses or resumes, and the menu has a Demo game and a High Scores list. Speed is chosen from Options → Slow / Fast. The ADRs keep pause and the high-score table (ADR-0007, ADR-0008). A demo/attract mode is a possible extra.

## 10. Not in the original (excluded from Classic)

- Power-ups, special atoms (e.g. a clone site's "crazy ball"), extra-life pickups.

These are possible later modes (ADR-0002).

---

## Implementation choices (M1)

Details the original's code doesn't pin down clearly, decided in `src/sim/simulation.ts`:

- **Step order:** apply a queued click, grow each wall half, decide every atom's bounce on the same positions, then move all atoms (the original's two phases), check breaks, tick the timer, check level clear. If two atoms aim at the same cell, the first in order takes it and the other waits a step.
- **Collision look:** collisions resolve between neighbouring cells, as in the original. The renderer draws atoms a full cell high and animates each atom–atom bounce so the two bodies visibly touch.
- **A half blocked by an atom or by another growing half** waits that step instead of completing.
- **Regions that still hold a growing half are never filled**: the half has nothing to anchor to yet. They're checked again when it completes.

## Still open

1. **Atom starting placement.** Not traced in the code. Random placement (one atom per cell) is close enough.

A visual check at a high level wasn't possible: the original's level-skip cheat (Ctrl+Shift+F12, which sets coverage to 100%) doesn't get through the browser emulator.

## Sources

- **The original game**: `JEZZBALL.EXE` (disassembled) and its help file `JEZZBALL.HLP` (topics: Overview, Playing the Game, Rules of the Game, Scoring, Strategy and Hints), from [Internet Archive: JezzBall (win3_JezzBall)](https://archive.org/details/win3_JezzBall).
- [Wikipedia: JezzBall](https://en.wikipedia.org/wiki/JezzBall): cap of 50 atoms from level 49, infinite levels.
- [My Personal Jezzball Tips (mind-temple.com)](https://www.mind-temple.com/jezz/tips.htm): atoms bouncing off each other (now confirmed in code).
