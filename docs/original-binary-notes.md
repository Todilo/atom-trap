# Notes: reading the original JEZZBALL.EXE

How the [confirmed] (code) rules in [classic-rules.md](classic-rules.md) were read, so they can be re-checked later. These are facts about how the game works. **No original code, graphics or sounds go into the remake.**

## Source files

`win3_JezzBall.zip` from [Internet Archive: JezzBall (win3_JezzBall)](https://archive.org/details/win3_JezzBall) contains:

- `JEZZBALL.EXE`: 49 664 bytes, dated 1992-09-07
- `JEZZBALL.HLP`
- WAV files
- `WEP4UTIL.DLL`

The EXE is a 16-bit Windows (NE) program built with **Turbo Pascal for Windows**. It has 10 segments. Code is in segment 1, and the data segment is segment 10.

## Method

- **Help file:** WinHelp 3.0 format. The `|TOPIC` text is phrase-compressed against the `|Phrases` table, whose offsets are relative to the table start + 4. Decoding it gives the full help text.
- **EXE:** parse the NE segment table and relocations, then disassemble with Capstone in 16-bit mode. Relocations name the KERNEL/USER/GDI imports, e.g. `USER.10` = `SetTimer`.
- **Floats** are Turbo Pascal 6-byte `Real` values, passed in AX:BX:DX:
  - The exponent is in AL with a bias of 129.
  - The sign is the top bit of DX.
  - The mantissa is in the rest, with an implicit leading 1.
  - Runtime helpers (entry numbers in the system unit): 205 add, 206 subtract, 207 multiply, 208 divide, 209 compare, 210 integer→Real.

## Key variables (data segment) and code (segment 1)

| What | Where | Finding |
|---|---|---|
| Timer interval | `[0xB4E]`, set at 1:2A70 / 1:2A99 | 50 ms when Speed = FAST, 100 ms when SLOW (from `entpack.ini`) |
| Step phases | 1:23CE | Alternates per tick. Phase A (1:2356) checks and bounces atoms, checks wall halves, applies a queued click and counts down the timer. Phase B (1:2388) moves atoms and advances wall halves, then checks for level end. |
| Atom count | `[0xB76]` | 2 on new game (1:26B5). +1 per level while < 50 (1:25E0). |
| Lives | `[0xB6E]` | Set to the atom count at level start (1:1EA7). −1 on a wall break (1:0956). Set to 0 on time-out (1:1F4A). |
| Level time | `[0x1DD0]` | 250 × atoms + 1000 (1:1BC2). −1 per phase A, plus one more on Slow (1:22EA, 1:2377). Warning sound at 200 (1:231F). |
| Cleared fraction | `[0x1DC8]` (Real) | Plus cells/560 per removal (1:01F1). Compared with 0.75 (1:024B). |
| Capture points | 1:01F1 → 1:0195 | (atoms + 5) × cells, divided by 2 on Slow |
| Level bonus | 1:218C | Time left × 1 + lives × 250 × (atoms+5) + 50 × (atoms+5) × (pct−80)⁺ + 100 × (atoms+5) × (pct−90)⁺. Divided by 2 on Slow. Only if lives > 0. |
| Grid | `[0xAEE]`, 6 bytes per cell, column stride 0x84 | Valid cells x 1..30, y 1..22 (1:0292), including a border ring, so the playfield is 28 × 20. Cell value 0 = removed, 1 = open, 2/3 = growing half A/B. |
| Wall halves | 10-byte records at `[0x1AE6 + 10·i]`, i = 1, 2 | Start: 1:1A72 (only if the slot is free and the cell is open). Grow: 1:0A31 / 1:0B92. Complete: 1:085E. Break: 1:0940 (cells back to open). |
| Atoms | 14-byte records at `[0x1AF6 + 14·i]` | Cell x, y and direction dx, dy = ±1. Bounce: 1:10B5. Wall-break check over the 8 neighbouring cells: 1:13F9. 11 spin frames. |
| Atom occupancy | Word at `[0xAF0]` in each grid cell = index of the atom in that cell (0 = none) | `1:02D1` "cell free?" needs the cell open, no wall head and no atom. In the bounce routine `1:10B5`, a neighbouring atom's dx/dy is overwritten with the mover's, then the mover reflects. |
| Cheat | `1:33FE` | Ctrl+Shift+F12 during a running game sets cleared = 1.01, which skips the level |
| Orientation | `[0x1DC0]` | 1 = vertical (the default at level start), 0 = horizontal |
