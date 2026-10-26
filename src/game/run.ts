import type { KeyValueStore } from '../shell/storage';
import { createLevel, type RuleTweaks } from '../sim/levels';
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

/** Which mode a run belongs to: each keeps its own high scores and highest level. */
export type RunMode = 'classic' | 'arcade';

/**
 * Arcade's rules on top of each Classic level (ADR-0018): capture atoms in small pockets, chain fills
 * and captures, and play against one clock for the whole run. Timer units: 10 a second.
 */
export const ARCADE_TWEAKS: RuleTweaks = {
  // About a 5 × 4 pocket. From the bot (October 2026): at 12, even a strong player rarely caught one.
  captureSize: 20,
  capturePoints: 1000,
  captureTime: 50,
  // A fill or capture within 6 seconds of the last one extends the chain (not counting while a wall grows).
  chainWindow: 60,
  chainMultipliers: [1, 2, 3, 4, 5, 6, 8],
  bigCatchShare: 0.15,
  // The time left carries on to the next board, so it isn't also paid out as points.
  timeBonusPerUnit: 0,
};

/**
 * Arcade's atoms per board: one more every two boards (2, 2, 3, 3, …, up to 12), a gentler climb than
 * Classic's one more every board, since Arcade plays against a clock.
 */
export function arcadeAtoms(level: number): number {
  return Math.min(2 + Math.floor((level - 1) / 2), 12);
}

/**
 * Arcade's lives per board: two more than the atoms. From the bot (October 2026): with Classic's
 * lives = atoms, a weaker player usually lost the first board on lives, never on time.
 */
export const ARCADE_EXTRA_LIVES = 2;

/** Arcade's run clock: what a run starts with, and what clearing a board adds. */
export const ARCADE_START_TIME = 900;
export const ARCADE_CLEAR_TIME = 150;
/** Added for each percent cleared above the target. */
export const ARCADE_TIME_PER_PERCENT = 10;

export class Progress {
  constructor(
    private readonly store: KeyValueStore,
    readonly mode: RunMode = 'classic',
  ) {}

  /** Classic keeps the first release's keys; other modes prefix theirs. */
  private key(name: 'highestLevel' | 'highScores'): string {
    return this.mode === 'classic' ? name : `${this.mode}${name[0].toUpperCase()}${name.slice(1)}`;
  }

  get highestLevel(): number {
    return this.store.get(this.key('highestLevel'), 1);
  }

  noteLevelStarted(level: number): void {
    if (level > this.highestLevel) this.store.set(this.key('highestLevel'), level);
  }

  get highScores(): HighScore[] {
    return this.store.get<HighScore[]>(this.key('highScores'), []);
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
    this.store.set(this.key('highScores'), table);
    this.store.set('playerName', clean);
  }

  /** Records a scored run's result; returns its 1-based rank, or null if it didn't make the table. */
  submitScore(entry: HighScore): number | null {
    if (entry.score <= 0) return null;
    const table = [...this.highScores, entry].sort((a, b) => b.score - a.score).slice(0, HIGH_SCORE_SLOTS);
    const rank = table.indexOf(entry);
    if (rank === -1) return null;
    this.store.set(this.key('highScores'), table);
    return rank + 1;
  }
}

export class Run {
  level: number;
  /** Points banked from cleared levels. */
  private banked = 0;
  /** Arcade: the run's clock, carried from board to board (timer units). */
  private clock = ARCADE_START_TIME;
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

  get mode(): RunMode {
    return this.progress.mode;
  }

  /** Total score so far, including points earned on the current level. */
  get score(): number {
    return this.banked + this.sim.score;
  }

  /** Arcade: the time a cleared board adds to the clock (timer units). */
  get clearTimeBonus(): number {
    const over = Math.max(0, Math.floor(this.sim.coverage * 100 - this.sim.rules.targetCoverage * 100));
    return ARCADE_CLEAR_TIME + over * ARCADE_TIME_PER_PERCENT;
  }

  /** Call after the current level is cleared. */
  nextLevel(): void {
    if (this.sim.status !== 'cleared') throw new Error('Level not cleared');
    this.banked += this.sim.score;
    if (this.mode === 'arcade') this.clock = this.sim.timeLeft + this.clearTimeBonus;
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
    const tweaks =
      this.mode === 'arcade'
        ? { ...ARCADE_TWEAKS, timeLimit: this.clock, atoms: arcadeAtoms(this.level), lives: arcadeAtoms(this.level) + ARCADE_EXTRA_LIVES }
        : undefined;
    return createLevel({ level: this.level, speed: this.speed, tweaks, seed: this.seed() });
  }
}
