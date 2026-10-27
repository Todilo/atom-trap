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
  /** Stable id: saved progress is keyed by it, so puzzles can be reordered or added. */
  id: string;
  name: string;
  layout?: string;
  atoms: number;
  /** Walls for three stars, and for two. */
  par: [three: number, two: number];
  seed: number;
}

export const PUZZLE_LIVES = 3;

/**
 * In order of difficulty, from the tuning bot's results (expert walls, then casual clear rate). The
 * second twelve (on the second batch of layouts) come after the first, so adding them kept everyone's
 * unlocks: each puzzle opens when the one before it is cleared.
 */
export const PUZZLES: Puzzle[] = [
  { id: 'first-trap', name: 'First trap', atoms: 2, par: [3, 6], seed: 101 },
  { id: 'pillars', name: 'Pillars', layout: 'pillars', atoms: 2, par: [4, 9], seed: 102 },
  { id: 'two-rooms', name: 'Two rooms', layout: 'rooms', atoms: 2, par: [5, 8], seed: 103 },
  { id: 'teeth', name: 'Teeth', layout: 'teeth', atoms: 3, par: [3, 8], seed: 106 },
  { id: 'crossroads', name: 'Crossroads', layout: 'cross', atoms: 3, par: [6, 11], seed: 104 },
  { id: 'diamond', name: 'Diamond', layout: 'diamond', atoms: 3, par: [6, 12], seed: 107 },
  { id: 'picture-frame', name: 'Picture frame', layout: 'frame', atoms: 3, par: [5, 13], seed: 105 },
  { id: 'busy-crossing', name: 'Busy crossing', layout: 'cross', atoms: 4, par: [8, 13], seed: 109 },
  { id: 'room-service', name: 'Room service', layout: 'rooms', atoms: 4, par: [8, 14], seed: 110 },
  { id: 'crowded-pillars', name: 'Crowded pillars', layout: 'pillars', atoms: 4, par: [9, 15], seed: 108 },
  { id: 'shark', name: 'Shark', layout: 'teeth', atoms: 5, par: [9, 17], seed: 112 },
  { id: 'full-frame', name: 'Full frame', layout: 'frame', atoms: 5, par: [10, 18], seed: 111 },
  { id: 'plus-signs', name: 'Plus signs', layout: 'plus-field', atoms: 3, par: [5, 11], seed: 114 },
  { id: 'four-corners', name: 'Four corners', layout: 'corners', atoms: 3, par: [5, 11], seed: 113 },
  { id: 'bar-hopping', name: 'Bar hopping', layout: 'bars', atoms: 4, par: [6, 12], seed: 116 },
  { id: 'ring-road', name: 'Ring road', layout: 'ring', atoms: 3, par: [7, 14], seed: 115 },
  { id: 'spiral', name: 'Spiral', layout: 'spiral', atoms: 4, par: [7, 14], seed: 118 },
  { id: 'big-h', name: 'Big H', layout: 'h-block', atoms: 4, par: [7, 12], seed: 119 },
  { id: 'bridge', name: 'Bridge', layout: 'bridge', atoms: 4, par: [7, 14], seed: 117 },
  { id: 'arrowhead', name: 'Arrowhead', layout: 'chevron', atoms: 5, par: [10, 15], seed: 121 },
  { id: 'corridors', name: 'Corridors', layout: 'corridors', atoms: 5, par: [11, 20], seed: 122 },
  { id: 'checkmate', name: 'Checkmate', layout: 'checker', atoms: 5, par: [11, 22], seed: 120 },
  { id: 'pinch-point', name: 'Pinch point', layout: 'pinch', atoms: 5, par: [12, 17], seed: 124 },
  { id: 'scattershot', name: 'Scattershot', layout: 'scatter', atoms: 6, par: [15, 24], seed: 123 },
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

/** The first release kept best walls in an array in this puzzle order; read once to carry them over. */
const FIRST_ORDER = ['first-trap', 'pillars', 'two-rooms', 'crossroads', 'picture-frame', 'teeth', 'diamond', 'crowded-pillars', 'busy-crossing', 'room-service', 'full-frame', 'shark'];

/** Best results per puzzle, saved by puzzle id. */
export class PuzzleProgress {
  constructor(private readonly store: KeyValueStore) {
    const old = store.get<(number | null)[] | null>('puzzleWalls', null);
    if (!old) return;
    const best: Record<string, number> = {};
    old.forEach((w, i) => {
      if (w !== null && FIRST_ORDER[i]) best[FIRST_ORDER[i]] = w;
    });
    store.set('puzzleBest', { ...best, ...store.get<Record<string, number>>('puzzleBest', {}) });
    store.set('puzzleWalls', null);
  }

  /** Fewest walls each puzzle has been cleared in (in PUZZLES order), or null if not yet cleared. */
  get bestWalls(): (number | null)[] {
    const saved = this.store.get<Record<string, number>>('puzzleBest', {});
    return PUZZLES.map((p) => saved[p.id] ?? null);
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
    const id = PUZZLES[index].id;
    const saved = this.store.get<Record<string, number>>('puzzleBest', {});
    if (saved[id] !== undefined && walls >= saved[id]) return false;
    this.store.set('puzzleBest', { ...saved, [id]: walls });
    return true;
  }
}
