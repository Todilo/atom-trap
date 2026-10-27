import { createRng } from './rng';
import { levelBonus, type LevelBonus, type Ruleset } from './ruleset';

/**
 * The pure, deterministic simulation of one level (ADR-0005), following docs/classic-rules.md.
 * Everything is on the cell grid; one `step()` moves every atom one cell and grows every wall half one cell.
 */

export type Orientation = 'horizontal' | 'vertical';
export type Slot = 'a' | 'b';
export type LevelStatus = 'playing' | 'cleared' | 'over';

export const CELL_OPEN = 0;
export const CELL_REMOVED = 1;
export const CELL_GROWING_A = 2;
export const CELL_GROWING_B = 3;

export interface Atom {
  x: number;
  y: number;
  dx: number;
  dy: number;
  /** Arcade: sealed into a small pocket (ADR-0018). A captured atom is off the board for good. */
  captured?: boolean;
}

export interface WallHalf {
  slot: Slot;
  dx: number;
  dy: number;
  /** Cells from the start cell to the head (last entry). */
  cells: { x: number; y: number }[];
}

export type GameEvent =
  | { type: 'wall-started'; slot: Slot }
  | { type: 'wall-completed'; slot: Slot }
  | { type: 'wall-broken'; slot: Slot }
  | { type: 'life-lost'; livesLeft: number }
  /** `x`, `y`: the middle of the removed cells, in cells, for showing the points there. */
  | { type: 'cells-removed'; count: number; points: number; x: number; y: number }
  | { type: 'time-warning' }
  | { type: 'level-cleared'; bonus: LevelBonus }
  | { type: 'game-over'; reason: 'lives' | 'time' | 'walls' }
  | { type: 'big-catch'; cells: number }
  | { type: 'atom-captured'; x: number; y: number; points: number }
  | { type: 'chain'; count: number }
  /** The chain ran out of time (not a break, which only costs a step). */
  | { type: 'chain-ended'; count: number };

export interface SimulationOptions {
  seed?: number;
  /** Explicit atom placement (tests); otherwise atoms are placed randomly from the seed. */
  atoms?: Atom[];
  /** Cells that start filled, one entry per cell row by row (1 = filled), e.g. from src/sim/layouts.ts. */
  filled?: Uint8Array;
}

export class Simulation {
  readonly rules: Ruleset;
  readonly atoms: Atom[];
  readonly halves: Record<Slot, WallHalf | null> = { a: null, b: null };
  lives: number;
  timeLeft: number;
  /** Points earned on this level, bonus included. */
  score = 0;
  /** Cells removed during play; cells filled at the start are not counted. */
  removedCells = 0;
  /**
   * Cells filled before play: the layout's, plus any open pocket that got no atom. They are not part
   * of the board you clear, so coverage is measured over the rest.
   */
  readonly startFilled: number = 0;
  status: LevelStatus = 'playing';
  steps = 0;
  /** Walls placed so far; a placement counts once at least one of its halves starts. */
  wallsPlaced = 0;
  /** Arcade chain: fills and captures in quick succession (0 when none is running). */
  chain = 0;
  /** The step the chain ends at unless something fills first. */
  chainEndsAt = 0;
  /** Points from fills and from captures on this level, for the board's breakdown. */
  fillPoints = 0;
  capturePointsEarned = 0;

  private readonly grid: Uint8Array;
  /** Index of the atom in each cell, or -1. Atoms never share a cell. */
  private readonly occupant: Int16Array;
  private queued: { x: number; y: number; orientation: Orientation } | null = null;

  constructor(rules: Ruleset, options: SimulationOptions = {}) {
    this.rules = rules;
    this.grid = new Uint8Array(rules.cols * rules.rows);
    this.occupant = new Int16Array(rules.cols * rules.rows).fill(-1);
    this.lives = rules.lives;
    this.timeLeft = rules.timeLimit;
    let filled = 0;
    if (options.filled) {
      if (options.filled.length !== this.grid.length) throw new Error('Filled cells do not match the board size');
      options.filled.forEach((f, i) => {
        if (!f) return;
        this.grid[i] = CELL_REMOVED;
        filled++;
      });
    }
    this.atoms = options.atoms ? options.atoms.map((a) => ({ ...a })) : this.placeAtoms(options.seed ?? 1);
    this.atoms.forEach((a, i) => {
      if (!this.isFree(a.x, a.y)) throw new Error(`Bad atom position ${a.x},${a.y}`);
      this.occupant[this.idx(a.x, a.y)] = i;
    });
    // A layout pocket that got no atom would be filled, for free points, by the first wall: fill it now.
    if (filled) this.startFilled = filled + this.fillEmptyRegions().length;
  }

  /** An independent copy, so a copy can be played forward to look ahead (the puzzle-tuning bot). */
  clone(): Simulation {
    const copy: Simulation = Object.assign(Object.create(Simulation.prototype), this);
    const half = (h: WallHalf | null) => h && { ...h, cells: h.cells.map((c) => ({ ...c })) };
    // Object.assign shared the mutable parts; give the copy its own.
    Object.assign(copy, {
      atoms: this.atoms.map((a) => ({ ...a })),
      halves: { a: half(this.halves.a), b: half(this.halves.b) },
      grid: this.grid.slice(),
      occupant: this.occupant.slice(),
      queued: this.queued && { ...this.queued },
    });
    return copy;
  }

  /** The share of the clearable board (everything not filled at the start) that has been removed. */
  get coverage(): number {
    return this.removedCells / (this.rules.cols * this.rules.rows - this.startFilled);
  }

  cellAt(x: number, y: number): number {
    return this.grid[this.idx(x, y)];
  }

  /** Queue a wall; it is applied at the start of the next step (the original also queues clicks). */
  placeWall(x: number, y: number, orientation: Orientation): void {
    if (this.status === 'playing' && this.wallsLeft !== 0) this.queued = { x, y, orientation };
  }

  /** The multiplier points get from the chain now (Arcade). */
  get chainMultiplier(): number {
    const m = this.rules.chainMultipliers;
    return this.chain === 0 ? 1 : m[Math.min(Math.floor((this.chain - 1) / this.rules.chainStep), m.length - 1)];
  }

  /** How many of the fills and captures needed for the next multiplier are done (1 to `chainStep`). */
  get chainProgress(): number {
    return this.chain === 0 ? 0 : ((this.chain - 1) % this.rules.chainStep) + 1;
  }

  /**
   * Whether atom `i` is walled in for good: atoms only move diagonally, so once all four diagonal
   * cells are filled (or off the board) it can never move again, however big its area is.
   */
  atomStuck(i: number): boolean {
    const a = this.atoms[i];
    if (a.captured) return false;
    return [-1, 1].every((dx) =>
      [-1, 1].every((dy) => !this.inBounds(a.x + dx, a.y + dy) || this.grid[this.idx(a.x + dx, a.y + dy)] === CELL_REMOVED),
    );
  }

  /** Atoms still on the board (Arcade captures take them off). */
  get liveAtoms(): number {
    return this.atoms.filter((a) => !a.captured).length;
  }

  /** Walls the player may still place, or null when there is no limit. */
  get wallsLeft(): number | null {
    return this.rules.wallLimit ? Math.max(0, this.rules.wallLimit - this.wallsPlaced) : null;
  }

  step(): GameEvent[] {
    const events: GameEvent[] = [];
    if (this.status !== 'playing') return events;
    this.steps++;

    // The chain only runs down while the player is choosing the next wall, not while one is growing.
    if (this.chain && (this.halves.a || this.halves.b)) this.chainEndsAt++;
    if (this.chain && this.steps > this.chainEndsAt) {
      events.push({ type: 'chain-ended', count: this.chain });
      this.chain = 0;
    }
    this.applyQueuedWall(events);
    for (const slot of ['a', 'b'] as const) this.advanceHalf(slot, events);
    // Like the original's two phases: every atom decides its bounce on the same positions, then all move.
    for (let i = 0; i < this.atoms.length; i++) if (!this.atoms[i].captured) this.bounceAtom(i);
    for (let i = 0; i < this.atoms.length; i++) if (!this.atoms[i].captured) this.moveAtom(i);
    this.checkBreaks(events);

    if (this.status === 'playing') this.tickTimer(events);
    // Arcade: capturing the last atom clears the board too.
    const allCaught = this.rules.captureSize > 0 && this.liveAtoms === 0;
    if (this.status === 'playing' && (this.coverage >= this.rules.targetCoverage || allCaught) && !this.halves.a && !this.halves.b) {
      const bonus = levelBonus(this.rules, this.coverage * 100, this.lives, this.timeLeft);
      this.score += bonus.total;
      this.status = 'cleared';
      events.push({ type: 'level-cleared', bonus });
    }
    // Out of walls, with nothing left growing that could still clear the board.
    if (this.status === 'playing' && this.wallsLeft === 0 && !this.queued && !this.halves.a && !this.halves.b) {
      this.status = 'over';
      events.push({ type: 'game-over', reason: 'walls' });
    }
    return events;
  }

  private applyQueuedWall(events: GameEvent[]): void {
    const q = this.queued;
    if (!q) return;
    this.queued = null;
    const started = events.length;
    if (q.orientation === 'horizontal') {
      this.startHalf('a', q.x, q.y, -1, 0, events);
      this.startHalf('b', q.x + 1, q.y, 1, 0, events);
    } else {
      this.startHalf('a', q.x, q.y, 0, -1, events);
      this.startHalf('b', q.x, q.y + 1, 0, 1, events);
    }
    if (events.length > started) this.wallsPlaced++;
  }

  /** Each half has one slot and starts only if that slot is free and its start cell is open. */
  private startHalf(slot: Slot, x: number, y: number, dx: number, dy: number, events: GameEvent[]): void {
    if (this.halves[slot] || !this.isFree(x, y)) return;
    this.halves[slot] = { slot, dx, dy, cells: [{ x, y }] };
    this.grid[this.idx(x, y)] = slot === 'a' ? CELL_GROWING_A : CELL_GROWING_B;
    events.push({ type: 'wall-started', slot });
  }

  private advanceHalf(slot: Slot, events: GameEvent[]): void {
    const half = this.halves[slot];
    if (!half) return;
    const head = half.cells[half.cells.length - 1];
    const nx = head.x + half.dx;
    const ny = head.y + half.dy;
    if (!this.inBounds(nx, ny) || this.grid[this.idx(nx, ny)] === CELL_REMOVED) {
      this.completeHalf(half, events);
    } else if (this.isFree(nx, ny)) {
      half.cells.push({ x: nx, y: ny });
      this.grid[this.idx(nx, ny)] = slot === 'a' ? CELL_GROWING_A : CELL_GROWING_B;
    }
    // Otherwise an atom or the other half is in the way: wait a step.
  }

  private completeHalf(half: WallHalf, events: GameEvent[]): void {
    this.halves[half.slot] = null;
    const removed: number[] = [];
    for (const c of half.cells) {
      this.grid[this.idx(c.x, c.y)] = CELL_REMOVED;
      removed.push(this.idx(c.x, c.y));
    }
    events.push({ type: 'wall-completed', slot: half.slot });
    removed.push(...this.fillEmptyRegions());
    const pockets = this.captureAtoms();
    // Arcade: a fill or capture extends the chain, which multiplies the points; a big fill doubles them.
    this.extendChain(events);
    const big = this.rules.bigCatchShare > 0 && removed.length >= this.rules.bigCatchShare * this.clearableCells;
    const multiplier = this.chainMultiplier * (big ? 2 : 1);
    this.removeCells([...removed, ...pockets.flatMap((p) => p.cells)], events, multiplier);
    if (big) events.push({ type: 'big-catch', cells: removed.length });
    for (const pocket of pockets) {
      for (const a of pocket.atoms) {
        const points = this.rules.capturePoints * this.rules.scoreScale * this.chainMultiplier;
        this.score += points;
        this.capturePointsEarned += points;
        if (this.rules.timeLimit) this.timeLeft += this.rules.captureTime;
        events.push({ type: 'atom-captured', x: a.x, y: a.y, points });
      }
    }
  }

  private get clearableCells(): number {
    return this.rules.cols * this.rules.rows - this.startFilled;
  }

  private extendChain(events: GameEvent[]): void {
    if (!this.rules.chainWindow) return;
    this.chain = this.chain && this.steps <= this.chainEndsAt ? this.chain + 1 : 1;
    this.chainEndsAt = this.steps + this.rules.chainWindow;
    events.push({ type: 'chain', count: this.chain });
  }

  /**
   * Arcade: an atom sealed into a pocket of at most `captureSize` cells is captured, and the pocket
   * fills (ADR-0018). A pocket with a wall still growing in it isn't sealed yet.
   */
  private captureAtoms(): { cells: number[]; atoms: Atom[] }[] {
    if (!this.rules.captureSize) return [];
    const pockets = this.openRegions().filter(
      (r) => r.atoms.length > 0 && r.cells.length <= this.rules.captureSize && r.cells.every((i) => this.grid[i] === CELL_OPEN),
    );
    return pockets.map((r) => {
      const atoms = r.atoms.map((i) => this.atoms[i]);
      for (const a of atoms) {
        a.captured = true;
        this.occupant[this.idx(a.x, a.y)] = -1;
      }
      for (const i of r.cells) this.grid[i] = CELL_REMOVED;
      return { cells: r.cells, atoms };
    });
  }

  /** The open regions (4-connected; growing cells count as open), with the atoms in each. */
  private openRegions(): { cells: number[]; atoms: number[] }[] {
    const { cols, rows } = this.rules;
    const seen = new Uint8Array(cols * rows);
    const regions: { cells: number[]; atoms: number[] }[] = [];
    for (let start = 0; start < cols * rows; start++) {
      if (seen[start] || this.grid[start] === CELL_REMOVED) continue;
      const cells: number[] = [];
      const atoms: number[] = [];
      const stack = [start];
      seen[start] = 1;
      while (stack.length) {
        const i = stack.pop()!;
        cells.push(i);
        if (this.occupant[i] !== -1) atoms.push(this.occupant[i]);
        const x = i % cols;
        const y = (i - x) / cols;
        for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
          if (!this.inBounds(nx, ny)) continue;
          const n = this.idx(nx, ny);
          if (seen[n] || this.grid[n] === CELL_REMOVED) continue;
          seen[n] = 1;
          stack.push(n);
        }
      }
      regions.push({ cells, atoms });
    }
    return regions;
  }

  /** Removes every open region that holds no atom, returning its cells. */
  private fillEmptyRegions(): number[] {
    const removed: number[] = [];
    for (const r of this.openRegions()) {
      // A region still holding a growing half is never filled: that half has nothing to anchor to yet.
      if (r.atoms.length || r.cells.some((i) => this.grid[i] !== CELL_OPEN)) continue;
      for (const i of r.cells) this.grid[i] = CELL_REMOVED;
      removed.push(...r.cells);
    }
    return removed;
  }

  private removeCells(cells: number[], events: GameEvent[], multiplier = 1): void {
    const count = cells.length;
    if (count === 0) return;
    this.removedCells += count;
    const points = count * this.rules.pointsPerCell * this.rules.scoreScale * multiplier;
    this.score += points;
    this.fillPoints += points;
    const { cols } = this.rules;
    const x = cells.reduce((t, i) => t + (i % cols), 0) / count;
    const y = cells.reduce((t, i) => t + Math.floor(i / cols), 0) / count;
    events.push({ type: 'cells-removed', count, points, x, y });
  }

  /**
   * A neighbouring atom in the way takes over this atom's direction on that axis, and this atom
   * reflects as if it hit a wall (from the original's code).
   */
  private bounceAtom(i: number): void {
    const a = this.atoms[i];
    const { dx, dy } = a;
    const h = this.atomAt(a.x + dx, a.y);
    const v = this.atomAt(a.x, a.y + dy);
    const d = this.atomAt(a.x + dx, a.y + dy);
    if (h) h.dx = dx;
    if (v) v.dy = dy;
    if (d) {
      d.dx = dx;
      d.dy = dy;
    }
    const hBlocked = !this.isFree(a.x + dx, a.y);
    const vBlocked = !this.isFree(a.x, a.y + dy);
    if (hBlocked) a.dx = -dx;
    if (vBlocked) a.dy = -dy;
    if (!hBlocked && !vBlocked && !this.isFree(a.x + dx, a.y + dy)) {
      a.dx = -dx;
      a.dy = -dy;
    }
  }

  /** Move one cell diagonally, unless the target cell has been taken or is blocked. */
  private moveAtom(i: number): void {
    const a = this.atoms[i];
    const tx = a.x + a.dx;
    const ty = a.y + a.dy;
    if (!this.isFree(tx, ty)) return;
    this.occupant[this.idx(a.x, a.y)] = -1;
    a.x = tx;
    a.y = ty;
    this.occupant[this.idx(tx, ty)] = i;
  }

  /** A growing half breaks when any atom is in one of the 8 cells around one of its cells. */
  private checkBreaks(events: GameEvent[]): void {
    for (const a of this.atoms) {
      if (a.captured) continue;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const x = a.x + ox;
          const y = a.y + oy;
          if (!this.inBounds(x, y)) continue;
          const c = this.grid[this.idx(x, y)];
          if (c === CELL_GROWING_A) this.breakHalf('a', events);
          else if (c === CELL_GROWING_B) this.breakHalf('b', events);
        }
      }
    }
  }

  private breakHalf(slot: Slot, events: GameEvent[]): void {
    const half = this.halves[slot];
    if (!half) return;
    this.halves[slot] = null;
    for (const c of half.cells) this.grid[this.idx(c.x, c.y)] = CELL_OPEN;
    // A break costs the chain one step, not all of it.
    this.chain = Math.max(0, this.chain - this.rules.chainStep);
    this.lives = Math.max(0, this.lives - 1);
    events.push({ type: 'wall-broken', slot }, { type: 'life-lost', livesLeft: this.lives });
    if (this.lives === 0 && this.status === 'playing') {
      this.status = 'over';
      events.push({ type: 'game-over', reason: 'lives' });
    }
  }

  private tickTimer(events: GameEvent[]): void {
    if (!this.rules.timeLimit) return;
    const before = this.timeLeft;
    this.timeLeft = Math.max(0, this.timeLeft - this.rules.timeUnitsPerStep);
    if (before > this.rules.timeWarningAt && this.timeLeft <= this.rules.timeWarningAt) events.push({ type: 'time-warning' });
    if (this.timeLeft === 0) {
      this.status = 'over';
      events.push({ type: 'game-over', reason: 'time' });
    }
  }

  private placeAtoms(seed: number): Atom[] {
    const rng = createRng(seed);
    const { cols, rows, atoms } = this.rules;
    const taken = new Set<number>();
    const out: Atom[] = [];
    while (out.length < atoms) {
      const x = Math.floor(rng() * cols);
      const y = Math.floor(rng() * rows);
      if (taken.has(this.idx(x, y)) || this.grid[this.idx(x, y)] !== CELL_OPEN) continue;
      taken.add(this.idx(x, y));
      out.push({ x, y, dx: rng() < 0.5 ? -1 : 1, dy: rng() < 0.5 ? -1 : 1 });
    }
    return out;
  }

  private atomAt(x: number, y: number): Atom | null {
    if (!this.inBounds(x, y)) return null;
    const o = this.occupant[this.idx(x, y)];
    return o === -1 ? null : this.atoms[o];
  }

  /** Open and not holding an atom. */
  private isFree(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return false;
    const i = this.idx(x, y);
    return this.grid[i] === CELL_OPEN && this.occupant[i] === -1;
  }

  private inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.rules.cols && y < this.rules.rows;
  }

  private idx(x: number, y: number): number {
    return y * this.rules.cols + x;
  }
}
