# ADR-0008: Synthwave sound effects and one looping ambient music track

- **Status:** Accepted
- **Date:** 2026-10-26

## Context

The original had a few simple beeps and no music. The neon visual direction (ADR-0004) calls for a matching sound. Phone players often play muted or with their own music. Mobile browsers block audio until the user interacts with the page.

## Decision

- **Sound effects:** synthwave-style, one per game event from the simulation (ADR-0005), e.g. wall growing (a rising hum while active), wall completed, wall half broken, region filled, life lost, level cleared, game over, timer running low.
- **Music:** one looping ambient/synthwave track, mixed low under the effects. It must be CC0/royalty-free or generated, with its license recorded in the repo.
- **Settings:** separate on/off switches for music and for sound effects, stored locally. They take effect immediately and persist.
- **Audio unlock:** the audio context starts on the player's first tap or click (e.g. on the title screen).
- **Pausing:** when the app goes to the background or the tab is hidden, the game pauses and all audio stops. It resumes paused, waiting for the player.

## Consequences

- Audio lives entirely in the shell and reacts to game events. The simulation stays silent and testable.
- *Implementation (M5):* both the music and the effects are **synthesised at runtime** with the Web Audio API (`src/shell/audio.ts`). That's the "generated" option: there's no audio file to license, download or cache, and it works offline.
- Adaptive music (layers that react to coverage and time) is possible later on top of the same events, but is out of scope for v1.
