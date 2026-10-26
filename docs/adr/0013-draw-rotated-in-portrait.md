# ADR-0013: In portrait, draw the game turned 90° instead of asking to rotate

- **Status:** Accepted. Supersedes the "rotate your device" screen in ADR-0006.
- **Date:** 2026-10-26

## Context

ADR-0006 makes the game landscape-only and showed a "rotate your device" screen in portrait. A web page can't turn the phone's screen itself: the manifest's orientation and the Screen Orientation lock only apply to the installed app or fullscreen. In a browser tab on a phone with **auto-rotate off**, the page stays portrait whatever the player does, so the prompt could never be satisfied.

## Decision

- When the viewport is portrait, the whole game (HUD, board and screens, all inside `#stage`) is drawn **turned 90° clockwise** with a CSS transform. Holding the phone sideways (top to the left) then shows it upright.
- Layout uses the stage's own (unrotated) size, so the board, HUD and renderer don't know about the rotation.
- Pointer input is mapped back through the rotation (`toLocal` in `src/game/input.ts`), so swipes and taps land on the right cells with the right orientation. DOM buttons need no mapping: the browser hit-tests transformed elements itself.
- The "rotate your device" screen is removed.

## Consequences

- The game is playable in any browser tab, auto-rotate on or off. With auto-rotate on, turning the phone switches to the normal unrotated landscape layout.
- The rotation is always clockwise. Holding the phone the other way round (top to the right) shows the game upside down. Picking the direction from device-orientation sensors is a possible later refinement.
- Phone safe-area insets are applied in the unrotated frame, so a notch can overlap the HUD edge in rotated mode. That's acceptable for a fallback.
