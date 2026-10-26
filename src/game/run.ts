import type { KeyValueStore } from '../shell/storage';
import { createLevel } from '../sim/levels';
import type { ClassicSpeed } from '../sim/ruleset';
import type { Simulation } from '../sim/simulation';

/**
 * A run is one play-through (ADR-0007). A scored run starts at level 1 and can enter the high-score
 * table; a continue run starts at the highest level reached, with the score reset, and never does.
 */
export type RunKind = 'scored' | 'continue';

export interface HighScore {
  score: number;
  level: number;
  /** ISO date. */
  date: string;
  name?: string;
  /** Set for runs played at the original's Slow speed (half points). */
  speed?: ClassicSpeed;
}

export const MAX_NAME_LENGTH = 12;

export const HIGH_SCORE_SLOTS = 10;

export class Progress {
  constructor(private readonly store: KeyValueStore) {}

  get highestLevel(): number {
    return this.store.get('highestLevel', 1);
  }

  noteLevelStarted(level: number): void {
    if (level > this.highestLevel) this.store.set('highestLevel', level);
  }

  get highScores(): HighScore[] {
    return this.store.get<HighScore[]>('highScores', []);
  }

  /** The name last entered for a high score, offered again next time. */
  get playerName(): string {
    return this.store.get('playerName', '');
  }

  /** Names the entry at a 1-based rank, and remembers the name for next time. */
  nameScore(rank: number, name: string): void {
    const clean = name.trim().slice(0, MAX_NAME_LENGTH);
    const table = this.highScores;
    if (!table[rank - 1]) return;
    table[rank - 1] = { ...table[rank - 1], name: clean || undefined };
    this.store.set('highScores', table);
    this.store.set('playerName', clean);
  }

  /** Records a scored run's result; returns its 1-based rank, or null if it didn't make the table. */
  submitScore(entry: HighScore): number | null {
    if (entry.score <= 0) return null;
    const table = [...this.highScores, entry].sort((a, b) => b.score - a.score).slice(0, HIGH_SCORE_SLOTS);
    const rank = table.indexOf(entry);
    if (rank === -1) return null;
    this.store.set('highScores', table);
    return rank + 1;
  }
}

export class Run {
  level: number;
  /** Points banked from cleared levels. */
  private banked = 0;
  sim: Simulation;

  constructor(
    readonly kind: RunKind,
    private readonly progress: Progress,
    readonly speed: ClassicSpeed = 'fast',
    private readonly seed: () => number = () => (Math.random() * 0xffffffff) >>> 0,
  ) {
    this.level = kind === 'scored' ? 1 : progress.highestLevel;
    this.sim = this.startLevel();
  }

  /** Total score so far, including points earned on the current level. */
  get score(): number {
    return this.banked + this.sim.score;
  }

  /** Call after the current level is cleared. */
  nextLevel(): void {
    if (this.sim.status !== 'cleared') throw new Error('Level not cleared');
    this.banked += this.sim.score;
    this.level++;
    this.sim = this.startLevel();
  }

  /** Call once when the run ends; only scored runs reach the table. */
  finish(): number | null {
    if (this.kind !== 'scored') return null;
    return this.progress.submitScore({
      score: Math.round(this.score),
      level: this.level,
      date: new Date().toISOString(),
      ...(this.speed === 'slow' ? { speed: 'slow' as const } : {}),
    });
  }

  private startLevel(): Simulation {
    this.progress.noteLevelStarted(this.level);
    return createLevel({ level: this.level, speed: this.speed, seed: this.seed() });
  }
}
