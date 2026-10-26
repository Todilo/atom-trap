# ADR-0018: Arcade mode as time-attack atom hunting

- **Status:** Accepted (core loop built; held power-ups, missions and new atoms planned)
- **Date:** 2026-10-26

## Context

Arcade was the last placeholder mode (ADR-0014). It should be exciting and worth replaying, without changing Classic. The player has one verb, which is placing walls, and no avatar.

A first version added combos, a big-catch bonus and power-up tiles that appeared at random and were captured by sealing them off, on top of Classic's levels. In play it felt like Classic with sprinkles:

- it added rewards but no new decisions;
- its effects were numbers in a label;
- the pressure didn't build;
- there was nothing to come back for.

## Decision

Arcade makes the game's name literal: **you trap the atoms themselves**, against one clock, in chains.

- **Capture.** Sealing an atom into a pocket of at most 20 cells (about 5 × 4) captures it: the pocket fills, the atom is gone for the rest of the board, and it scores 1,000 points (before speed and chain) and adds 5 seconds. Capturing the last atom also clears the board. It's a direct goal with risk, because walls have to go close to atoms. The size came from the bot: at 12 cells even a strong player rarely caught one.
- **One run clock.** A run starts with 90 seconds. Each board's time left carries over, plus 15 seconds for the clear and 1 second for each percent above the target. Time left is not also paid out as points. The next board starts after a 1.5-second banner. The run ends when the time or the lives run out.
- **Chain.** A fill or capture within 6 seconds of the last one extends the chain, and points are multiplied by ×1, ×2, ×3, … up to ×8. The window only runs down while the player is choosing the next wall, not while one is growing. A broken wall drops the chain one step. The HUD shows it as a big multiplier with a draining bar, and each step up plays a higher note.
- **A gentler climb than Classic.** One more atom every two boards (2, 2, 3, 3, … up to 12), and two more lives than atoms on each board.
  - In bot runs, a strong player's typical run went from board 14 to board 34.
  - A weaker player, who used to lose the first board, typically reached board 3.
  - The weaker player was losing on lives, never on time. A longer starting clock changed nothing; extra lives did.
- **Big catch.** A single fill of at least 15% of the board scores double.
- **Feedback.** Points rise from where cells filled, a capture implodes into a closing ring with sparks and a small screen shake, and a board clear flashes.
- Arcade plays at Fast, with its own high scores and highest level. The rules are data on the ruleset (`captureSize`, `capturePoints`, `captureTime`, `chainWindow`, `chainMultipliers`, `bigCatchShare`), and Classic's values switch them all off.

**Planned next**, once the core loop is confirmed fun:

- **Held power-ups:** dropped by captures and big catches into one slot, used when the player chooses: Freeze, Laser (the next wall is instant and unbreakable), Bomb and Slow-mo. They replace the first version's random tiles.
- **Missions** that unlock atom styles and themes.
- **New atoms**, one per level:
  - **Heavy:** half speed, an easy capture.
  - **Fast:** two cells a step.
  - **Splitter:** multiplies unless caught early.
  - **Ghost:** fades from view.

## Consequences

- Arcade plays differently from Classic: you hunt atoms instead of fencing off space, and a run is a few tense minutes.
- The numbers (pocket size, points, chain window and steps, clock times) are first choices, to tune by playing. The bot plays Arcade too, but doesn't hunt captures.
- Captured atoms stay in the simulation's atom list, marked captured, so the renderer and atom indices stay stable.
