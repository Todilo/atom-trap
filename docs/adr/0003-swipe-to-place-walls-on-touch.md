# ADR-0003: Swipe to place walls on touch, original mouse controls on desktop

- **Status:** Accepted
- **Date:** 2026-10-26

## Context

The original game used left-click to start a wall and right-click to switch orientation, with a hover cursor showing the next wall's orientation. Phones have no right-click and no hover, and a finger covers the target. JezzBall is about timing, so placing a wall has to be one quick action.

## Decision

- **Touch:** the player touches the board and swipes. The wall's **origin** is where the touch started, not where it ended. Its **orientation** comes from the swipe's main axis: mostly horizontal makes a horizontal wall, mostly vertical a vertical one. The wall starts as soon as the swipe passes a small **swipe threshold** (about 15–20 px, to be tuned). A touch that is released before the threshold does nothing.
- **Mouse:** same as the original. Left-click starts a wall at the cursor, right-click switches the current orientation, and the cursor shows that orientation.
- Both input methods produce the same game command, *place wall (origin, orientation)*. The simulation doesn't know which input made it.

## Consequences

- Touch play never needs an on-screen button, so the whole screen can show the board.
- The threshold and the "which axis wins" rule (e.g. diagonal swipes) need tuning on a real phone.
- Whether to show a preview line during the swipe is still open.
- Keyboard and gamepad controls aren't covered here. They would also produce the same command.
