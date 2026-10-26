# Backlog

Open items picked up along the way, with the milestone they belong to (ADR-0010).

## Done

| Item | Milestone | Notes |
|---|---|---|
| Board didn't fit in a normal browser tab | M1 | Sizing now uses dynamic viewport units and the stage's layout size. |
| "Rotate your device" when auto-rotate is off | M6 | In portrait, the game is drawn turned 90° (ADR-0013). |
| GitHub Actions on deprecated Node 20 | M6 | Actions bumped to current majors, build on Node 24. |
| Music loop too short and repetitive | M5 | 32-bar song in four sections. |
| Wall-break sound too harsh | M5 | Softer shatter. |
| Atoms looked like they collided too early | M5 | Two-phase atom update plus a contact animation and full-size atoms. |
| Quick wins: haptics, Slow speed, first-play hint, names on high scores | after v1 | Vibration on touch devices (switchable), Speed switch on the title screen (half points, marked "slow" in the table), an animated hint that holds the first level until the first wall, and name entry on a new high score. |
| UI redesign around game modes | after v1 | Mode-select title screen, chip HUD, Settings page, dialogs, high scores per mode (ADR-0014). |
| Atom styles | after v1 | Twelve styles in Settings under Theme, previewed by the game's own painter (`src/render/atomPainter.ts`). |
| Updates reach phones | after v1 | Ask before reloading; check on resume, on the title screen and hourly; version and manual check in Settings (ADR-0016). |
| Board layouts and levels as data | after v1 | Filled starting cells, rule tweaks, fixed seeds (ADR-0014). |
| Puzzle mode | after v1 | Twelve boards scored against par, pars from a tuning bot, ordered by difficulty (ADR-0015). |
| Smooth wall growth | after v1 | The tip glides between steps; the rules still grow one cell per step. |
| Puzzles in order of difficulty | after v1 | Reordered from the tuning bot's results; progress is saved by puzzle id. |
| Attract-mode demo | after v1 | The game opens on the bot playing a board full-screen, "Tap to play" brings up the menu, and an idle title returns to it (ADR-0017). |
| Daily Challenge | after v1 | One board a day from the date, par from the bot on the device, one scored try, streak and share (ADR-0017). |
| Arcade core loop | after v1 | Capture atoms in small pockets, one run clock, chains up to ×8, floating points and implosions; own high scores (ADR-0018). A first version with random power-up tiles felt flat and was replaced. |

## Ideas for after v1

| Idea | Notes |
|---|---|
| Pick the portrait rotation direction from the device sensors | Today it's always clockwise (ADR-0013). |
| Arcade: held power-ups | Dropped by captures and big catches, one slot, used when you choose: Freeze, Laser, Bomb, Slow-mo (ADR-0018). |
| Arcade: missions | Goals that unlock atom styles and themes. |
| Arcade: new atoms | Heavy, Fast, Splitter and Ghost, one introduced per level (ADR-0018). |
| Tune Arcade | Pocket size, capture points, chain window and steps, and clock times are first choices. |
| Tune puzzle pars from real play | Dev builds log attempts (`atomTrap.puzzleLog()`); adjust pars once there's enough play. |
| Reduce motion setting | Calmer trails and flashes; atom styles like Spark ball and Firefly swarm are the busiest. |
| Zen mode | Dropped: with no timer and no lives there was nothing to win (ADR-0014). |
| Play Store release | Wrap the PWA with Capacitor (ADR-0001). |
