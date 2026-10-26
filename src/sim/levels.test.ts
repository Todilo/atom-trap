import { describe, expect, it } from 'vitest';
import { createLevel, levelRules } from './levels';
import { LAYOUTS, layoutCells } from './layouts';
import { classicRuleset } from './ruleset';
import { CELL_OPEN, CELL_REMOVED, Simulation } from './simulation';

const COLS = 28;
const ROWS = 20;

/** Open cells reachable from the first open cell, moving up, down, left and right. */
function reachable(cells: Uint8Array): number {
  const start = cells.indexOf(0);
  const seen = new Set([start]);
  const stack = [start];
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % COLS;
    for (const n of [x > 0 ? i - 1 : -1, x < COLS - 1 ? i + 1 : -1, i - COLS, i + COLS]) {
      if (n < 0 || n >= cells.length || cells[n] || seen.has(n)) continue;
      seen.add(n);
      stack.push(n);
    }
  }
  return seen.size;
}

describe('Board layouts (src/sim/layouts.ts)', () => {
  it.each(LAYOUTS.map((l) => [l.id, l] as const))('%s is 28 × 20 with one connected open area', (_id, layout) => {
    const cells = layoutCells(layout, COLS, ROWS);
    const open = cells.filter((c) => c === 0).length;
    expect(open).toBeGreaterThan(COLS * ROWS * 0.8);
    expect(reachable(cells)).toBe(open);
  });

  it('starts a layout filled, with no atom inside it and coverage at zero', () => {
    const layout = LAYOUTS.find((l) => l.id === 'cross')!;
    const cells = layoutCells(layout, COLS, ROWS);
    for (let seed = 1; seed <= 50; seed++) {
      const sim = createLevel({ level: 10, layout: 'cross', seed });
      for (const a of sim.atoms) expect(cells[a.y * COLS + a.x]).toBe(0);
      expect(sim.startFilled).toBeGreaterThanOrEqual(cells.filter(Boolean).length);
      expect(sim.coverage).toBe(0);
      expect(sim.score).toBe(0);
    }
    const sim = createLevel({ level: 1, layout: 'cross', seed: 1 });
    expect(sim.cellAt(13, 9)).toBe(CELL_REMOVED);
    expect(sim.cellAt(0, 0)).toBe(CELL_OPEN);
  });

  it('fills a pocket that got no atom before play, without points', () => {
    // An 8 × 1 board split at x = 3: the atom is on the left, so the right pocket fills at once.
    const filled = new Uint8Array(8);
    filled[3] = 1;
    const sim = new Simulation({ ...classicRuleset(1), cols: 8, rows: 1 }, { atoms: [{ x: 0, y: 0, dx: 1, dy: 1 }], filled });
    expect(sim.startFilled).toBe(5);
    expect(sim.cellAt(7, 0)).toBe(CELL_REMOVED);
    expect(sim.cellAt(1, 0)).toBe(CELL_OPEN);
    expect(sim.score).toBe(0);
  });

  it('measures coverage over the clearable cells only', () => {
    const filled = new Uint8Array(8);
    filled[7] = 1;
    // A one-row board: atoms can never move vertically, so this one stays put.
    const sim = new Simulation({ ...classicRuleset(1), cols: 8, rows: 1 }, { atoms: [{ x: 0, y: 0, dx: 1, dy: 1 }], filled });
    sim.placeWall(3, 0, 'vertical');
    sim.step();
    // The wall cell and cells 4–6 are removed: 4 of the 7 clearable cells.
    expect(sim.removedCells).toBe(4);
    expect(sim.coverage).toBeCloseTo(4 / 7);
  });

  it('rejects an explicit atom placed on a filled cell', () => {
    const filled = new Uint8Array(8);
    filled[2] = 1;
    expect(() => new Simulation({ ...classicRuleset(1), cols: 8, rows: 1 }, { atoms: [{ x: 2, y: 0, dx: 1, dy: 1 }], filled })).toThrow();
  });
});

describe('Level descriptions (src/sim/levels.ts)', () => {
  it('without tweaks or a layout is exactly a Classic level', () => {
    expect(levelRules({ level: 4, speed: 'slow', seed: 1 })).toEqual(classicRuleset(4, 'slow'));
    const sim = createLevel({ level: 4, seed: 7 });
    expect(sim.startFilled).toBe(0);
    expect(sim.atoms).toEqual(new Simulation(classicRuleset(4), { seed: 7 }).atoms);
  });

  it('applies rule tweaks on top of the Classic numbers', () => {
    const rules = levelRules({ level: 6, tweaks: { lives: 2, targetCoverage: 0.85 }, seed: 1 });
    expect(rules.lives).toBe(2);
    expect(rules.targetCoverage).toBe(0.85);
    expect(rules.atoms).toBe(classicRuleset(6).atoms);
  });

  it('gives the same starting board for the same description', () => {
    const spec = { level: 8, layout: 'teeth', tweaks: { atoms: 5 }, seed: 20261026 };
    expect(createLevel(spec).atoms).toEqual(createLevel(spec).atoms);
    expect(createLevel(spec).atoms).toHaveLength(5);
    expect(createLevel({ ...spec, seed: 20261027 }).atoms).not.toEqual(createLevel(spec).atoms);
  });
});
