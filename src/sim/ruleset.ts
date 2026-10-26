/**
 * A ruleset is the data that defines one level for the simulation (ADR-0002).
 * Classic numbers come from docs/classic-rules.md, read from the original game.
 */
export interface Ruleset {
  cols: number;
  rows: number;
  atoms: number;
  lives: number;
  /** Starting level time, in timer units; 0 means the level is untimed. */
  timeLimit: number;
  /** Timer units consumed per step (10 units per second in Classic). */
  timeUnitsPerStep: number;
  /** Real time per simulation step. */
  stepMs: number;
  /** Timer value at which a warning event fires. */
  timeWarningAt: number;
  /** Coverage fraction (0..1) needed to clear the level. */
  targetCoverage: number;
  /** Points per removed cell, before `scoreScale`. */
  pointsPerCell: number;
  /** Coverage bonus tiers: points per percent above `fromPercent`. Tiers stack. */
  coverageBonusTiers: { fromPercent: number; pointsPerPercent: number }[];
  livesBonusPerLife: number;
  timeBonusPerUnit: number;
  /** Multiplier on every point award (0.5 for the original's Slow speed). */
  scoreScale: number;
  /** Walls the player may place; 0 means no limit (Classic). Running out before clearing ends the level. */
  wallLimit: number;
  /** Arcade: one fill of at least this share of the clearable board scores double; 0 is off. */
  bigCatchShare: number;
  /**
   * Arcade chain (ADR-0018): a fill or capture within this many steps of the last one extends the
   * chain, and points are multiplied by its value (the last holds from then on). Steps with a wall
   * growing don't count, and a break drops the chain one step. 0 means no chains.
   */
  chainWindow: number;
  chainMultipliers: number[];
  /** Arcade: an atom sealed into a pocket of at most this many cells is captured; 0 means never. */
  captureSize: number;
  /** Points for each captured atom (before speed and chain), and timer units it adds. */
  capturePoints: number;
  captureTime: number;
}

export type ClassicSpeed = 'fast' | 'slow';

export const CLASSIC_MAX_ATOMS = 50;

/** Atoms on a Classic level: 2 on level 1, +1 per level, capped at 50. */
export function classicAtomCount(level: number): number {
  return Math.min(level + 1, CLASSIC_MAX_ATOMS);
}

export function classicRuleset(level: number, speed: ClassicSpeed = 'fast'): Ruleset {
  const atoms = classicAtomCount(level);
  // k = atoms + 5 scales capture points and every atom-dependent bonus.
  const k = atoms + 5;
  const slow = speed === 'slow';
  return {
    cols: 28,
    rows: 20,
    atoms,
    lives: atoms,
    timeLimit: 1000 + 250 * atoms,
    // Slow halves the step rate but drains the timer twice per step, so the clock still runs at 10 units/s.
    timeUnitsPerStep: slow ? 2 : 1,
    stepMs: slow ? 200 : 100,
    timeWarningAt: 200,
    targetCoverage: 0.75,
    pointsPerCell: k,
    coverageBonusTiers: [
      { fromPercent: 80, pointsPerPercent: 50 * k },
      { fromPercent: 90, pointsPerPercent: 100 * k },
    ],
    livesBonusPerLife: 250 * k,
    timeBonusPerUnit: 1,
    scoreScale: slow ? 0.5 : 1,
    wallLimit: 0,
    bigCatchShare: 0,
    chainWindow: 0,
    chainMultipliers: [1],
    captureSize: 0,
    capturePoints: 0,
    captureTime: 0,
  };
}

export interface LevelBonus {
  coverage: number;
  lives: number;
  time: number;
  total: number;
}

/** The bonus awarded on a level clear with lives left (docs/classic-rules.md §8). */
export function levelBonus(rules: Ruleset, coveragePercent: number, livesLeft: number, timeLeft: number): LevelBonus {
  let coverage = 0;
  for (const tier of rules.coverageBonusTiers) {
    if (coveragePercent > tier.fromPercent) coverage += (coveragePercent - tier.fromPercent) * tier.pointsPerPercent;
  }
  const lives = livesLeft * rules.livesBonusPerLife;
  const time = Math.max(0, timeLeft) * rules.timeBonusPerUnit;
  const s = rules.scoreScale;
  return { coverage: coverage * s, lives: lives * s, time: time * s, total: (coverage + lives + time) * s };
}
