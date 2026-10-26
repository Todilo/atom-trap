# ADR-0009: Keep the original's wide cell shape (16:12)

- **Status:** Accepted
- **Date:** 2026-10-26

## Context

The original board is 28 × 20 cells, and each cell is 16 × 12 px. That makes the board 448 × 240 px, about 1.87:1. Square cells would make the same grid 7:5 (1.4:1).

In the original, atoms move one cell diagonally per step (`docs/classic-rules.md` §1–2), so the cell's shape decides what the motion looks like. With 16:12 cells, atoms travel at about 37° rather than 45°. Horizontal distances also look longer on screen than vertical ones, which is why the original's hint says to build vertical walls first.

Landscape phones are 16:9 to 20:9 (1.78–2.22:1), so a 1.87:1 board fills them well.

## Decision

The board keeps the original's look: **cells are 4:3 (16 × 12), and the whole board is 28 × 20 cells at ≈ 1.87:1**.

- The simulation still works purely in cells (ADR-0005, ADR-0006), so the cell shape exists only in the renderer and in input mapping (screen point → cell).
- The renderer scales the board uniformly to fit the screen and keeps the 1.87:1 ratio. Leftover space goes to the HUD (ADR-0006).

## Consequences

- Atom angles and the relative feel of horizontal and vertical walls match the original.
- On 16:9–20:9 phones the board fills almost the whole screen. Only thin side bars are left, so the HUD layout has to fit there (or overlay the top edge lightly).
- Glow, trails and particles are drawn in screen space, so round atoms stay round. Only positions use the 4:3 cell grid.
- A future mode with square cells would only need a different renderer/input setting, not simulation changes.
