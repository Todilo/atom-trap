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
  | { type: 'cells-removed'; count: number; points: number }
  | { type: 'time-warning' }
  | { type: 'level-cleared'; bonus: LevelBonus }
  | { type: 'game-over'; reason: 'lives' | 'time' };

export interface SimulationOptions {
  seed?: number;
  /** Explicit atom placement (tests); otherwise atoms are placed randomly from the seed. */
  atoms?: Atom[];
}

export class Simulation {
  readonly rules: Ruleset;
  readonly atoms: Atom[];
  readonly halves: Record<Slot, WallHalf | null> = { a: null, b: null };
  lives: number;
  timeLeft: number;
  /** Points earned on this level, bonus included. */
  score = 0;
  removedCells = 0;
  status: LevelStatus = 'playing';
  steps = 0;

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
    this.atoms = options.atoms ? options.atoms.map((a) => ({ ...a })) : this.placeAtoms(options.seed ?? 1);
    this.atoms.forEach((a, i) => {
      if (!this.inBounds(a.x, a.y) || this.occupant[this.idx(a.x, a.y)] !== -1) throw new Error(`Bad atom position ${a.x},${a.y}`);
      this.occupant[this.idx(a.x, a.y)] = i;
    });
  }

  get coverage(): number {
    return this.removedCells / (this.rules.cols * this.rules.rows);
  }

  cellAt(x: number, y: number): number {
    return this.grid[this.idx(x, y)];
  }

  /** Queue a wall; it is applied at the start of the next step (the original also queues clicks). */
  placeWall(x: number, y: number, orientation: Orientation): void {
    if (this.status === 'playing') this.queued = { x, y, orientation };
  }

  step(): GameEvent[] {
    const events: GameEvent[] = [];
    if (this.status !== 'playing') return events;
    this.steps++;

    this.applyQueuedWall(events);
    for (const slot of ['a', 'b'] as const) this.advanceHalf(slot, events);
    for (let i = 0; i < this.atoms.length; i++) this.moveAtom(i);
    this.checkBreaks(events);

    if (this.status === 'playing') this.tickTimer(events);
    if (this.status === 'playing' && this.coverage >= this.rules.targetCoverage && !this.halves.a && !this.halves.b) {
      const bonus = levelBonus(this.rules, this.coverage * 100, this.lives, this.timeLeft);
      this.score += bonus.total;
      this.status = 'cleared';
      events.push({ type: 'level-cleared', bonus });
    }
    return events;
  }

  private applyQueuedWall(events: GameEvent[]): void {
    const q = this.queued;
    if (!q) return;
    this.queued = null;
    if (q.orientation === 'horizontal') {
      this.startHalf('a', q.x, q.y, -1, 0, events);
      this.startHalf('b', q.x + 1, q.y, 1, 0, events);
    } else {
      this.startHalf('a', q.x, q.y, 0, -1, events);
      this.startHalf('b', q.x, q.y + 1, 0, 1, events);
    }
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
    let removed = 0;
    for (const c of half.cells) {
      this.grid[this.idx(c.x, c.y)] = CELL_REMOVED;
      removed++;
    }
    events.push({ type: 'wall-completed', slot: half.slot });
    removed += this.fillEmptyRegions();
    this.removeCells(removed, events);
  }

  /** Removes every open region (4-connected) that holds no atom. Growing cells are part of a region. */
  private fillEmptyRegions(): number {
    const { cols, rows } = this.rules;
    const seen = new Uint8Array(cols * rows);
    const stack: number[] = [];
    let removed = 0;
    for (let start = 0; start < cols * rows; start++) {
      if (seen[start] || this.grid[start] === CELL_REMOVED) continue;
      const region: number[] = [];
      let hasAtom = false;
      stack.push(start);
      seen[start] = 1;
      while (stack.length) {
        const i = stack.pop()!;
        region.push(i);
        if (this.occupant[i] !== -1) hasAtom = true;
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
      // A region still holding a growing half is never filled: that half has nothing to anchor to yet.
      if (hasAtom || region.some((i) => this.grid[i] !== CELL_OPEN)) continue;
      for (const i of region) this.grid[i] = CELL_REMOVED;
      removed += region.length;
    }
    return removed;
  }

  private removeCells(count: number, events: GameEvent[]): void {
    if (count === 0) return;
    this.removedCells += count;
    const points = count * this.rules.pointsPerCell * this.rules.scoreScale;
    this.score += points;
    events.push({ type: 'cells-removed', count, points });
  }

  /**
   * Bounce, then move one cell diagonally. A neighbouring atom in the way takes over this atom's
   * direction on that axis, and this atom reflects as if it hit a wall (from the original's code).
   */
  private moveAtom(i: number): void {
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
    this.lives = Math.max(0, this.lives - 1);
    events.push({ type: 'wall-broken', slot }, { type: 'life-lost', livesLeft: this.lives });
    if (this.lives === 0 && this.status === 'playing') {
      this.status = 'over';
      events.push({ type: 'game-over', reason: 'lives' });
    }
  }

  private tickTimer(events: GameEvent[]): void {
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
      if (taken.has(this.idx(x, y))) continue;
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
