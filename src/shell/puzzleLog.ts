import { PUZZLES } from '../game/puzzles';
import type { Simulation } from '../sim/simulation';
import type { KeyValueStore } from './storage';

/**
 * Puzzle attempts, logged in dev builds to tune pars from real play (ADR-0015). Saved by puzzle id,
 * so reordering puzzles keeps the log right.
 */
interface PuzzleAttempt {
  id: string;
  cleared: boolean;
  walls: number;
  livesLost: number;
}

export function logPuzzleAttempt(store: KeyValueStore, puzzleIndex: number, s: Simulation, cleared: boolean): void {
  if (!import.meta.env.DEV) return;
  const log = store.get<PuzzleAttempt[]>('puzzleLog', []);
  log.push({ id: PUZZLES[puzzleIndex].id, cleared, walls: s.wallsPlaced, livesLost: s.rules.lives - s.lives });
  store.set('puzzleLog', log.slice(-1000));
}

/** A console table per puzzle of the logged attempts, next to its pars (`atomTrap.puzzleLog()`). */
export function printPuzzleLog(store: KeyValueStore): void {
  const log = store.get<PuzzleAttempt[]>('puzzleLog', []);
  console.table(
    PUZZLES.map((p, i) => {
      const mine = log.filter((a) => a.id === p.id);
      const walls = mine
        .filter((a) => a.cleared)
        .map((a) => a.walls)
        .sort((a, b) => a - b);
      return {
        puzzle: `${i + 1} ${p.name}`,
        attempts: mine.length,
        cleared: walls.length,
        best: walls[0] ?? null,
        median: walls.length ? walls[Math.floor((walls.length - 1) / 2)] : null,
        par: p.par.join(' / '),
      };
    }),
  );
}
