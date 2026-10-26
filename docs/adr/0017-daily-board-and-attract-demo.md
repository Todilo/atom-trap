# ADR-0017: Daily board from the date, and an attract-mode demo

- **Status:** Accepted
- **Date:** 2026-10-26

## Context

A Daily mode gives players a reason to come back each day and to compare results. Classic varies only its seed, so with layouts and rule tweaks (ADR-0014) a day's board can look different. The game has no server: there are no accounts and no shared leaderboard.

The original JezzBall played a demo when idle. The puzzle-tuning bot (ADR-0015) can already play the game.

## Decision

- **The board comes from the date.** The player's local date gives a seed. The seed picks a layout (or none) and 3–5 atoms. The board plays like a puzzle: untimed, three lives, as few walls as possible. Day 1 is 26 October 2026, and a new board arrives at local midnight.
- **Par comes from the bot, on the device.** The expert and casual bots play the day's board 30 times each, in small slices so the page stays responsive. The bot and its seeds are fixed, so every device gets the same par. The par is cached for the day.
- **One scored try a day.** Starting it uses it up, and leaving halfway counts as a try that didn't clear, so a bad board can't be retried. Later games that day are practice and change nothing.
- **Streak and share.** The streak counts days in a row with a try, and stays alive until the day after a missed one. Share uses the system share sheet, or the clipboard, with a short text: the day number, the stars, walls against par, and the streak.
- **The demo, as an attract mode.** The game opens on the demo: the bot plays a Classic board, sometimes on a layout, full-screen, with the logo and "Tap to play". Any tap, click or key brings up the menu without starting anything, and the title screen returns to the demo after 20 seconds without input. A first try showed the demo *behind* the title menu, but the mode cards covered almost all of it. The demo is silent, uses a lighter bot so it never stutters, and is off when the device asks for reduced motion (the game then opens on the menu).

## Consequences

- Daily needs no server. Comparing results is social: people share their text, Wordle-style.
- Changing the bot, the layouts or the board recipe changes past and future boards and pars. That's acceptable while Daily is new, but the recipe should then be treated as fixed.
- A device with its clock set wrong gets a different day's board.
