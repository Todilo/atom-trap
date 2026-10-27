import { describe, expect, it } from 'vitest';
import { classicAtomCount, classicRuleset, levelBonus, type Ruleset } from './ruleset';
import { CELL_OPEN, CELL_REMOVED, Simulation, type Atom, type GameEvent } from './simulation';

const level1 = classicRuleset(1);

function rules(overrides: Partial<Ruleset>): Ruleset {
  return { ...level1, ...overrides };
}

function run(sim: Simulation, steps: number): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < steps; i++) events.push(...sim.step());
  return events;
}

const types = (events: GameEvent[]) => events.map((e) => e.type);

describe('Classic ruleset (docs/classic-rules.md)', () => {
  it('level 1: 2 atoms, 2 lives, 1500 time units, 7 points per cell', () => {
    expect(level1).toMatchObject({ cols: 28, rows: 20, atoms: 2, lives: 2, timeLimit: 1500, pointsPerCell: 7, stepMs: 100 });
  });

  it('adds an atom per level and caps at 50 from level 49', () => {
    expect(classicAtomCount(7)).toBe(8);
    expect(classicRuleset(7).lives).toBe(8);
    expect(classicAtomCount(49)).toBe(50);
    expect(classicRuleset(80)).toMatchObject({ atoms: 50, timeLimit: 13500 });
  });

  it('slow speed halves the step rate and the points, but the clock still runs at 10 units/s', () => {
    const slow = classicRuleset(1, 'slow');
    expect(slow).toMatchObject({ stepMs: 200, timeUnitsPerStep: 2, scoreScale: 0.5 });
    expect((1000 / slow.stepMs) * slow.timeUnitsPerStep).toBe(10);
  });

  it('matches the worked bonus example: level 1, 85%, 2 lives, 900 units left = 6150', () => {
    expect(levelBonus(level1, 85, 2, 900)).toEqual({ coverage: 1750, lives: 3500, time: 900, total: 6150 });
  });

  it('stacks both coverage tiers above 90%', () => {
    // 50·7·(95−80) + 100·7·(95−90)
    expect(levelBonus(level1, 95, 0, 0).coverage).toBe(5250 + 3500);
  });
});

describe('Atoms', () => {
  it('bounce off the board edge', () => {
    const sim = new Simulation(level1, { atoms: [{ x: 0, y: 5, dx: -1, dy: 1 }] });
    sim.step();
    expect(sim.atoms[0]).toEqual({ x: 1, y: 6, dx: 1, dy: 1 });
  });

  it('collide: the hit atom takes the mover’s direction and the mover reflects', () => {
    const atoms: Atom[] = [
      { x: 5, y: 5, dx: 1, dy: 1 },
      { x: 6, y: 5, dx: -1, dy: 1 },
    ];
    const sim = new Simulation(level1, { atoms });
    sim.step();
    expect(sim.atoms[0]).toEqual({ x: 4, y: 6, dx: -1, dy: 1 });
    expect(sim.atoms[1]).toEqual({ x: 7, y: 6, dx: 1, dy: 1 });
  });

  it('decide bounces on the same positions, so atoms two cells apart don’t bounce early', () => {
    const sim = new Simulation(level1, {
      atoms: [
        { x: 10, y: 10, dx: 1, dy: 1 },
        { x: 12, y: 10, dx: -1, dy: 1 },
      ],
    });
    sim.step();
    // Both aimed at (11, 11): the first takes it, the second waits without bouncing.
    expect(sim.atoms[0]).toEqual({ x: 11, y: 11, dx: 1, dy: 1 });
    expect(sim.atoms[1]).toEqual({ x: 12, y: 10, dx: -1, dy: 1 });
    sim.step();
    // Now neighbours: they bounce apart.
    expect(sim.atoms[0]).toEqual({ x: 10, y: 12, dx: -1, dy: 1 });
    expect(sim.atoms[1]).toEqual({ x: 13, y: 9, dx: 1, dy: -1 });
  });

  it('never share a cell', () => {
    const sim = new Simulation(classicRuleset(30), { seed: 7 });
    for (let i = 0; i < 500; i++) {
      sim.step();
      const cells = new Set(sim.atoms.map((a) => `${a.x},${a.y}`));
      expect(cells.size).toBe(sim.atoms.length);
    }
  });

  it('are placed deterministically from the seed', () => {
    const a = new Simulation(classicRuleset(10), { seed: 42 });
    const b = new Simulation(classicRuleset(10), { seed: 42 });
    run(a, 200);
    run(b, 200);
    expect(a.atoms).toEqual(b.atoms);
  });
});

describe('Walls and filling', () => {
  it('a vertical wall grows both ways, completes and fills the empty side', () => {
    const sim = new Simulation(level1, { atoms: [{ x: 27, y: 10, dx: 1, dy: 1 }] });
    sim.placeWall(10, 10, 'vertical');
    const events = run(sim, 12);
    expect(types(events).filter((t) => t === 'wall-completed')).toHaveLength(2);
    // Wall column (20 cells) plus the atom-free left side (10 × 20 cells).
    expect(sim.removedCells).toBe(220);
    expect(sim.cellAt(0, 0)).toBe(CELL_REMOVED);
    expect(sim.cellAt(20, 5)).toBe(CELL_OPEN);
    expect(sim.score).toBe(220 * 7);
    expect(sim.lives).toBe(2);
  });

  it('an atom next to a growing half breaks it: cells reopen and a life is lost', () => {
    const sim = new Simulation(level1, { atoms: [{ x: 12, y: 3, dx: -1, dy: 1 }] });
    sim.placeWall(10, 5, 'vertical');
    const events = run(sim, 1);
    expect(types(events)).toContain('wall-broken');
    expect(sim.lives).toBe(1);
    expect(sim.halves.a).toBeNull();
    expect(sim.cellAt(10, 4)).toBe(CELL_OPEN);
  });

  it('losing the last life ends the game', () => {
    const sim = new Simulation(rules({ lives: 1 }), { atoms: [{ x: 12, y: 3, dx: -1, dy: 1 }] });
    sim.placeWall(10, 5, 'vertical');
    expect(types(run(sim, 1))).toContain('game-over');
    expect(sim.status).toBe('over');
  });

  it('has one slot per half: a click while both halves grow starts nothing', () => {
    const sim = new Simulation(level1, { atoms: [{ x: 27, y: 19, dx: 1, dy: 1 }] });
    sim.placeWall(5, 10, 'vertical');
    sim.step();
    sim.placeWall(15, 5, 'horizontal');
    expect(types(sim.step())).not.toContain('wall-started');
  });

  it('a click next to a removed cell gives a one-sided wall', () => {
    // A one-row board: atoms can never move vertically, so they stay put.
    const sim = new Simulation(rules({ cols: 8, rows: 1 }), { atoms: [{ x: 0, y: 0, dx: 1, dy: 1 }] });
    sim.placeWall(7, 0, 'horizontal');
    const events = sim.step();
    expect(types(events).filter((t) => t === 'wall-started')).toHaveLength(1);
    expect(sim.halves.b).toBeNull();
  });

  it('counts a wall only when one of its halves starts', () => {
    const sim = new Simulation(level1, { atoms: [{ x: 27, y: 19, dx: 1, dy: 1 }] });
    sim.placeWall(5, 10, 'vertical');
    sim.step();
    // Both slots are busy, so this click starts nothing and costs nothing.
    sim.placeWall(15, 5, 'horizontal');
    sim.step();
    expect(sim.wallsPlaced).toBe(1);
  });

  it('ends the level when the wall budget is spent without clearing', () => {
    const sim = new Simulation(rules({ wallLimit: 1 }), { atoms: [{ x: 27, y: 10, dx: 1, dy: 1 }] });
    expect(sim.wallsLeft).toBe(1);
    sim.placeWall(10, 10, 'vertical');
    const events = run(sim, 12);
    // The wall clears 220 of 560 cells: short of 75%, and no walls left.
    expect(sim.wallsLeft).toBe(0);
    expect(events).toContainEqual({ type: 'game-over', reason: 'walls' });
    expect(sim.status).toBe('over');
  });

  it('has no wall budget in Classic', () => {
    expect(new Simulation(level1, { seed: 1 }).wallsLeft).toBeNull();
  });

  it('clones into an independent copy that plays on identically', () => {
    const sim = new Simulation(level1, { seed: 3 });
    sim.placeWall(10, 10, 'vertical');
    run(sim, 3);
    const copy = sim.clone();
    copy.placeWall(20, 5, 'horizontal');
    run(copy, 20);
    expect(sim.steps).toBe(3);
    expect(sim.wallsPlaced).toBe(1);
    // Played the same way, the copy and the original stay in step.
    const twin = sim.clone();
    run(sim, 20);
    run(twin, 20);
    expect(twin.atoms).toEqual(sim.atoms);
    expect(twin.removedCells).toBe(sim.removedCells);
  });

  it('knows an atom is stuck for good once all four diagonal cells are filled', () => {
    // A one-cell-wide corridor (row 1 of a 3-row board): long, but an atom in it can never move.
    const filled = new Uint8Array(8 * 3);
    for (let x = 0; x < 8; x++) filled[x] = filled[16 + x] = 1;
    const corridor = new Simulation(rules({ cols: 8, rows: 3 }), { atoms: [{ x: 3, y: 1, dx: 1, dy: 1 }], filled });
    expect(corridor.atomStuck(0)).toBe(true);
    const before = { ...corridor.atoms[0] };
    run(corridor, 10);
    expect(corridor.atoms[0]).toMatchObject({ x: before.x, y: before.y });

    const free = new Simulation(level1, { atoms: [{ x: 10, y: 10, dx: 1, dy: 1 }] });
    expect(free.atomStuck(0)).toBe(false);
  });

  it('does not fill a region that still holds an atom', () => {
    const sim = new Simulation(rules({ cols: 8, rows: 1 }), { atoms: [{ x: 0, y: 0, dx: 1, dy: 1 }] });
    sim.placeWall(4, 0, 'vertical');
    sim.step();
    expect(sim.cellAt(0, 0)).toBe(CELL_OPEN);
    expect(sim.cellAt(7, 0)).toBe(CELL_REMOVED);
  });
});

describe('Fuzz', () => {
  it('random walls on many levels keep the invariants', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const r = classicRuleset((seed % 12) + 1);
      const sim = new Simulation(r, { seed });
      let rnd = seed * 9973;
      const next = () => (rnd = (rnd * 1103515245 + 12345) % 2147483648) / 2147483648;
      for (let i = 0; i < 2000 && sim.status === 'playing'; i++) {
        if (i % 7 === 0) sim.placeWall(Math.floor(next() * r.cols), Math.floor(next() * r.rows), next() < 0.5 ? 'vertical' : 'horizontal');
        sim.step();
        for (const a of sim.atoms) expect(sim.cellAt(a.x, a.y)).toBe(CELL_OPEN);
        expect(sim.lives).toBeGreaterThanOrEqual(0);
        expect(sim.coverage).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('Level end', () => {
  it('clears at 75% with no growing wall, adding the lives and time bonus', () => {
    const sim = new Simulation(rules({ cols: 8, rows: 1 }), { atoms: [{ x: 0, y: 0, dx: 1, dy: 1 }] });
    sim.placeWall(2, 0, 'vertical');
    const events = sim.step();
    expect(sim.status).toBe('cleared');
    const cleared = events.find((e) => e.type === 'level-cleared');
    // 6 of 8 cells removed = exactly 75%: no coverage bonus; 2 lives × 1750; 1499 time units left.
    expect(cleared).toEqual({ type: 'level-cleared', bonus: { coverage: 0, lives: 3500, time: 1499, total: 4999 } });
    expect(sim.score).toBe(6 * 7 + 4999);
  });

  it('running out of time is game over, not a lost life', () => {
    const sim = new Simulation(rules({ cols: 8, rows: 1, timeLimit: 3 }), { atoms: [{ x: 0, y: 0, dx: 1, dy: 1 }] });
    const events = run(sim, 5);
    expect(events).toContainEqual({ type: 'game-over', reason: 'time' });
    expect(sim.lives).toBe(2);
    expect(sim.steps).toBe(3);
  });

  it('never runs out of time on an untimed level', () => {
    const sim = new Simulation(rules({ cols: 8, rows: 1, timeLimit: 0 }), { atoms: [{ x: 0, y: 0, dx: 1, dy: 1 }] });
    expect(types(run(sim, 5000))).not.toContain('game-over');
    expect(sim.status).toBe('playing');
  });

  it('warns once when the timer drops to 200 units', () => {
    const sim = new Simulation(rules({ cols: 8, rows: 1, timeLimit: 205 }), { atoms: [{ x: 0, y: 0, dx: 1, dy: 1 }] });
    expect(types(run(sim, 10)).filter((t) => t === 'time-warning')).toHaveLength(1);
  });
});

describe('Arcade rules (ADR-0018)', () => {
  const arcade = (o: Partial<Ruleset> = {}) => rules({ chainWindow: 30, chainMultipliers: [1, 2, 3], ...o });
  // A vertical wall at x = 10 with the atom far right: half B (9 cells) completes first, then half A
  // (11 cells) closes off the 200-cell left side.
  const wallAtTen = (sim: Simulation) => {
    sim.placeWall(10, 10, 'vertical');
    return run(sim, 12);
  };
  // A one-row board: atoms can never move vertically, so they stay put.
  const row = (o: Partial<Ruleset> = {}) => arcade({ cols: 8, rows: 1, captureSize: 3, capturePoints: 100, captureTime: 30, ...o });

  it('multiplies points by the chain of fills in quick succession', () => {
    const sim = new Simulation(arcade(), { atoms: [{ x: 27, y: 10, dx: 1, dy: 1 }] });
    const events = wallAtTen(sim);
    expect(sim.chain).toBe(2);
    expect(sim.chainMultiplier).toBe(2);
    expect(sim.score).toBe(9 * 7 + 211 * 7 * 2);
    expect(events.filter((e) => e.type === 'chain')).toEqual([
      { type: 'chain', count: 1 },
      { type: 'chain', count: 2 },
    ]);
  });

  it('ends the chain after a pause, and a break drops it one step', () => {
    const sim = new Simulation(arcade({ chainWindow: 5 }), { atoms: [{ x: 27, y: 10, dx: 1, dy: 1 }] });
    wallAtTen(sim);
    expect(run(sim, 6)).toContainEqual({ type: 'chain-ended', count: 2 });
    expect(sim.chain).toBe(0);
    expect(sim.chainMultiplier).toBe(1);

    const broken = new Simulation(arcade(), { atoms: [{ x: 12, y: 3, dx: -1, dy: 1 }] });
    broken.chain = 3;
    broken.chainEndsAt = 99;
    broken.placeWall(10, 5, 'vertical');
    run(broken, 1);
    expect(broken.chain).toBe(2);
  });

  it('climbs one multiplier per two catches when the step is 2, and a break takes one step back', () => {
    const sim = new Simulation(arcade({ chainStep: 2 }), { atoms: [{ x: 27, y: 10, dx: 1, dy: 1 }] });
    sim.chain = 1;
    sim.chainEndsAt = 99;
    expect([sim.chainMultiplier, sim.chainProgress]).toEqual([1, 1]);
    sim.chain = 2;
    expect([sim.chainMultiplier, sim.chainProgress]).toEqual([1, 2]);
    sim.chain = 3;
    expect([sim.chainMultiplier, sim.chainProgress]).toEqual([2, 1]);

    const broken = new Simulation(arcade({ chainStep: 2 }), { atoms: [{ x: 12, y: 3, dx: -1, dy: 1 }] });
    broken.chain = 5;
    broken.chainEndsAt = 99;
    broken.placeWall(10, 5, 'vertical');
    run(broken, 1);
    expect(broken.chain).toBe(3);
    expect(broken.chainMultiplier).toBe(2);
  });

  it('keeps the points from fills and from captures apart, for the board breakdown', () => {
    const sim = new Simulation(row({ chainWindow: 0 }), { atoms: [{ x: 1, y: 0, dx: 1, dy: 1 }, { x: 6, y: 0, dx: 1, dy: 1 }] });
    sim.placeWall(3, 0, 'vertical');
    sim.step();
    expect(sim.capturePointsEarned).toBe(100);
    expect(sim.fillPoints).toBe(sim.score - 100);
  });

  it("doesn't run the chain down while a wall is growing", () => {
    const sim = new Simulation(arcade({ chainWindow: 3 }), { atoms: [{ x: 27, y: 19, dx: 1, dy: 1 }] });
    sim.chain = 1;
    sim.chainEndsAt = 3;
    // A long wall: both halves grow for several steps.
    sim.placeWall(14, 10, 'vertical');
    run(sim, 6);
    expect(sim.halves.a).not.toBeNull();
    expect(sim.chain).toBe(1);
  });

  it('doubles a big catch', () => {
    const sim = new Simulation(arcade({ chainWindow: 0, bigCatchShare: 0.3 }), { atoms: [{ x: 27, y: 10, dx: 1, dy: 1 }] });
    const events = wallAtTen(sim);
    expect(events).toContainEqual({ type: 'big-catch', cells: 211 });
    expect(sim.score).toBe(9 * 7 + 211 * 7 * 2);
  });

  it('captures an atom sealed into a small pocket, filling it and adding points and time', () => {
    const sim = new Simulation(row(), { atoms: [{ x: 1, y: 0, dx: 1, dy: 1 }, { x: 6, y: 0, dx: 1, dy: 1 }] });
    const time = sim.timeLeft;
    sim.placeWall(3, 0, 'vertical');
    const events = sim.step();
    // Cells 0-2 (3 cells) hold the first atom: captured. Cells 4-7 (4 cells) are too big a pocket.
    expect(events).toContainEqual({ type: 'atom-captured', x: 1, y: 0, points: 100 });
    expect(sim.atoms[0].captured).toBe(true);
    expect(sim.atoms[1].captured).toBeUndefined();
    expect(sim.liveAtoms).toBe(1);
    expect(sim.cellAt(1, 0)).toBe(CELL_REMOVED);
    expect(sim.cellAt(5, 0)).toBe(CELL_OPEN);
    expect(sim.timeLeft).toBe(time - 1 + 30);
  });

  it('clears the board when the last atom is captured', () => {
    const sim = new Simulation(row({ targetCoverage: 1 }), { atoms: [{ x: 1, y: 0, dx: 1, dy: 1 }, { x: 6, y: 0, dx: 1, dy: 1 }] });
    sim.placeWall(3, 0, 'vertical');
    sim.step();
    sim.placeWall(5, 0, 'vertical');
    const events = sim.step();
    expect(sim.liveAtoms).toBe(0);
    expect(types(events)).toContain('level-cleared');
    expect(sim.status).toBe('cleared');
  });

  it('reports where cells were removed, for showing the points there', () => {
    const sim = new Simulation(row({ captureSize: 0 }), { atoms: [{ x: 1, y: 0, dx: 1, dy: 1 }] });
    sim.placeWall(3, 0, 'vertical');
    const removed = sim.step().find((e) => e.type === 'cells-removed');
    // The wall cell (3) and the empty right side (4-7).
    expect(removed).toMatchObject({ count: 5, x: 5, y: 0 });
  });

  it('leaves Classic without chains, big catches or captures', () => {
    const sim = new Simulation(level1, { atoms: [{ x: 27, y: 10, dx: 1, dy: 1 }] });
    const events = wallAtTen(sim);
    expect(sim.score).toBe(220 * 7);
    expect(types(events)).not.toContain('chain');
    expect(types(events)).not.toContain('big-catch');
    const small = new Simulation(rules({ cols: 8, rows: 1 }), { atoms: [{ x: 1, y: 0, dx: 1, dy: 1 }, { x: 6, y: 0, dx: 1, dy: 1 }] });
    small.placeWall(3, 0, 'vertical');
    small.step();
    expect(small.liveAtoms).toBe(2);
  });
});
