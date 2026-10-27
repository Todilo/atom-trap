import type { Puzzle } from '../game/puzzles';
import type { Run } from '../game/run';
import type { Simulation } from '../sim/simulation';

/**
 * Shell states: `menu` (title, lists, settings; the board idle or the demo behind), `playing`,
 * `paused`, `cleared` (a board's result showing), `over` (a game's end showing).
 */
export type ShellMode = 'menu' | 'playing' | 'paused' | 'cleared' | 'over';

/**
 * A puzzle-style game in progress: a Puzzle (`index` into PUZZLES) or a Daily board (`daily`,
 * scored or practice). Both play the same way.
 */
export interface PuzzlePlay {
  def: Puzzle;
  index: number | null;
  daily: { key: string; scored: boolean } | null;
  sim: Simulation;
}

/** What's being played: a Classic or Arcade run, or a puzzle-style game (at most one is set). */
export interface Play {
  run: Run | null;
  puzzle: PuzzlePlay | null;
}
