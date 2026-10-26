import type { KeyValueStore } from '../shell/storage';
import { createLevel, type LevelSpec } from '../sim/levels';
import type { Simulation } from '../sim/simulation';

/**
 * Puzzle mode: hand-made boards built from layouts (src/sim/layouts.ts). Each puzzle has a fixed seed,
 * so it starts the same way every time, no timer and three lives. Like golf, the aim is to clear it in
 * as few walls as you can: any clear earns a star, and getting near or under par earns two or three.
 * There is no wall limit, so a par set too low only makes stars harder, never a puzzle unbeatable.
 * Pars come from `npm run tune-puzzles` (a bot playing each puzzle 400 times per skill, October 2026);
 * adjust them from real play.
 */
export interface Puzzle {
  name: string;
  layout?: string;
  atoms: number;
  /** Walls for three stars, and for two. */
  par: [three: number, two: number];
  seed: number;
}

export const PUZZLE_LIVES = 3;

export const PUZZLES: Puzzle[] = [
  { name: 'First trap', atoms: 2, par: [3, 6], seed: 101 },
  { name: 'Pillars', layout: 'pillars', atoms: 2, par: [4, 9], seed: 102 },
  { name: 'Two rooms', layout: 'rooms', atoms: 2, par: [5, 8], seed: 103 },
  { name: 'Crossroads', layout: 'cross', atoms: 3, par: [6, 11], seed: 104 },
  { name: 'Picture frame', layout: 'frame', atoms: 3, par: [7, 13], seed: 105 },
  { name: 'Teeth', layout: 'teeth', atoms: 3, par: [3, 8], seed: 106 },
  { name: 'Diamond', layout: 'diamond', atoms: 3, par: [6, 12], seed: 107 },
  { name: 'Crowded pillars', layout: 'pillars', atoms: 4, par: [9, 15], seed: 108 },
  { name: 'Busy crossing', layout: 'cross', atoms: 4, par: [8, 13], seed: 109 },
  { name: 'Room service', layout: 'rooms', atoms: 4, par: [8, 14], seed: 110 },
  { name: 'Full frame', layout: 'frame', atoms: 5, par: [10, 18], seed: 111 },
  { name: 'Shark', layout: 'teeth', atoms: 5, par: [9, 17], seed: 112 },
];

export const MAX_STARS = PUZZLES.length * 3;

export function puzzleSpec(p: Puzzle): LevelSpec {
  return {
    // The Classic level with this many atoms, for its scoring numbers; puzzles show stars, not points.
    level: p.atoms - 1,
    layout: p.layout,
    tweaks: { atoms: p.atoms, lives: PUZZLE_LIVES, timeLimit: 0 },
    seed: p.seed,
  };
}

export function startPuzzle(p: Puzzle): Simulation {
  return createLevel(puzzleSpec(p));
}

/** Stars for clearing a puzzle with this many walls: any clear earns one. */
export function starsFor(p: Puzzle, wallsUsed: number): number {
  if (wallsUsed <= p.par[0]) return 3;
  return wallsUsed <= p.par[1] ? 2 : 1;
}

/** Best results per puzzle, kept by position in PUZZLES. */
export class PuzzleProgress {
  constructor(private readonly store: KeyValueStore) {}

  /** Fewest walls each puzzle has been cleared in, or null if not yet cleared. */
  get bestWalls(): (number | null)[] {
    const saved = this.store.get<(number | null)[]>('puzzleWalls', []);
    return PUZZLES.map((_, i) => saved[i] ?? null);
  }

  get stars(): number[] {
    return this.bestWalls.map((w, i) => (w === null ? 0 : starsFor(PUZZLES[i], w)));
  }

  get totalStars(): number {
    return this.stars.reduce((a, b) => a + b, 0);
  }

  /** The first puzzle is always open; each next one opens once the one before is cleared. */
  unlocked(index: number): boolean {
    return index === 0 || this.bestWalls[index - 1] !== null;
  }

  /** The first open puzzle without three stars, to offer from the title screen. */
  get suggested(): number {
    const stars = this.stars;
    const i = stars.findIndex((s, k) => s < 3 && this.unlocked(k));
    return i === -1 ? 0 : i;
  }

  /** Keeps the fewest walls; returns whether this clear beat the earlier best. */
  record(index: number, walls: number): boolean {
    const all = this.bestWalls;
    const best = all[index];
    if (best !== null && walls >= best) return false;
    all[index] = walls;
    this.store.set('puzzleWalls', all);
    return true;
  }
}
