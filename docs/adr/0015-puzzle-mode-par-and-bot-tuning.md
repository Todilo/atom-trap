# ADR-0015: Puzzle mode scored against par, with pars tuned by a bot

- **Status:** Accepted
- **Date:** 2026-10-26

## Context

Puzzle mode is a set of hand-made boards (ADR-0014) with a fixed seed each. The first version had a hard **wall budget**: run out of walls before clearing the board and you fail. That makes every number critical. A budget set too tight makes a puzzle unbeatable, and finding the right numbers needs a lot of playtesting.

The puzzles aren't exact puzzles either. The atoms start the same way, but the player's timing changes everything after the first wall.

## Decision

- **Par, like golf, instead of a budget.** There's no wall limit; losing all three lives is the only way to fail. Any clear earns one star. Clearing within the two-star count earns two, and clearing at par or under earns three. Progress stores the fewest walls per puzzle, keyed by puzzle id, and the stars are worked out from that, so changing a par re-rates past results.
- **A bot sets the first pars.** `npm run tune-puzzles` plays every puzzle hundreds of times with the headless simulation (`src/game/bot.ts`). The bot tries spots by playing each one forward on a copy of the game, which no human can do, so its best results are out of reach. Instead, three stars sit at the *expert* bot's typical result and two stars at the *casual* bot's.
- **Real play refines them.** Dev builds log every puzzle attempt; `atomTrap.puzzleLog()` in the console shows them next to the pars.
- Puzzles are ordered by the bot's difficulty results and unlock one at a time.

## Consequences

- A wrong par only makes stars easier or harder. It never blocks a player.
- Adding a puzzle means picking a layout, atoms and seed, running the tuner and pasting its pars.
- The bot also makes other features cheap, such as a demo behind the title screen and par for generated boards.
