import type { KeyValueStore } from '../shell/storage';

/**
 * Achievements (ADR-0019): goals across every mode, each with visible progress. They're badges, not
 * locks: everything in the game stays open. Most count from the lifetime stats below; puzzle and
 * Daily ones read the progress those modes already keep.
 */

/** Lifetime counters and bests, kept as the game is played. */
export interface Stats {
  wallsPlaced: number;
  atomsCaptured: number;
  /** Most atoms captured on one Arcade board. */
  bestCapturesOnBoard: number;
  /** Arcade boards cleared by capturing every atom. */
  cleanSweeps: number;
  /** Highest chain multiplier reached. */
  bestChain: number;
  bestArcadeBoard: number;
  bestClassicLevel: number;
  bestClassicScore: number;
  /** Classic atoms walled in so tightly they can't move (Classic has no captures). */
  classicTraps: number;
}

export const NO_STATS: Stats = {
  wallsPlaced: 0,
  atomsCaptured: 0,
  bestCapturesOnBoard: 0,
  cleanSweeps: 0,
  bestChain: 0,
  bestArcadeBoard: 0,
  bestClassicLevel: 0,
  bestClassicScore: 0,
  classicTraps: 0,
};

/** Everything achievements are judged on: the stats, plus what Puzzle and Daily keep. */
export interface AchievementView {
  stats: Stats;
  puzzlesSolved: number;
  puzzleCount: number;
  totalStars: number;
  bestPuzzleStars: number;
  dailiesPlayed: number;
  bestDailyStreak: number;
  bestDailyStars: number;
}

export type AchievementGroup = 'All modes' | 'Classic' | 'Arcade' | 'Puzzle' | 'Daily';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  group: AchievementGroup;
  /** How far along it is, and what completes it. */
  progress(v: AchievementView): [current: number, goal: number];
}

const goal =
  (n: number, value: (v: AchievementView) => number) =>
  (v: AchievementView): [number, number] => [Math.min(value(v), n), n];

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'builder', name: 'Builder', description: 'Place 100 walls.', group: 'All modes', progress: goal(100, (v) => v.stats.wallsPlaced) },
  { id: 'architect', name: 'Architect', description: 'Place 1,000 walls.', group: 'All modes', progress: goal(1000, (v) => v.stats.wallsPlaced) },
  { id: 'getting-going', name: 'Getting going', description: 'Reach level 5 in Classic.', group: 'Classic', progress: goal(5, (v) => v.stats.bestClassicLevel) },
  { id: 'seasoned', name: 'Seasoned', description: 'Reach level 10 in Classic.', group: 'Classic', progress: goal(10, (v) => v.stats.bestClassicLevel) },
  {
    id: 'atom-trap',
    name: 'Atom trap',
    description: "In Classic, wall an atom in so tightly it can't move.",
    group: 'Classic',
    progress: goal(1, (v) => v.stats.classicTraps),
  },
  { id: 'high-roller', name: 'High roller', description: 'Score 50,000 in one Classic run.', group: 'Classic', progress: goal(50_000, (v) => v.stats.bestClassicScore) },
  { id: 'got-one', name: 'Got one', description: 'Capture an atom in Arcade.', group: 'Arcade', progress: goal(1, (v) => v.stats.atomsCaptured) },
  { id: 'hat-trick', name: 'Hat trick', description: 'Capture 3 atoms on one Arcade board.', group: 'Arcade', progress: goal(3, (v) => v.stats.bestCapturesOnBoard) },
  { id: 'clean-sweep', name: 'Clean sweep', description: 'Clear an Arcade board by capturing every atom.', group: 'Arcade', progress: goal(1, (v) => v.stats.cleanSweeps) },
  { id: 'on-a-roll', name: 'On a roll', description: 'Reach a ×4 chain.', group: 'Arcade', progress: goal(4, (v) => v.stats.bestChain) },
  { id: 'unstoppable', name: 'Unstoppable', description: 'Reach a ×8 chain.', group: 'Arcade', progress: goal(8, (v) => v.stats.bestChain) },
  { id: 'marathon', name: 'Marathon', description: 'Reach board 10 in one Arcade run.', group: 'Arcade', progress: goal(10, (v) => v.stats.bestArcadeBoard) },
  { id: 'atom-hunter', name: 'Atom hunter', description: 'Capture 100 atoms in all.', group: 'Arcade', progress: goal(100, (v) => v.stats.atomsCaptured) },
  { id: 'solved', name: 'Solved', description: 'Solve a puzzle.', group: 'Puzzle', progress: goal(1, (v) => v.puzzlesSolved) },
  { id: 'perfectionist', name: 'Perfectionist', description: 'Get three stars on a puzzle.', group: 'Puzzle', progress: goal(3, (v) => v.bestPuzzleStars) },
  { id: 'halfway', name: 'Halfway', description: 'Solve 12 puzzles.', group: 'Puzzle', progress: goal(12, (v) => v.puzzlesSolved) },
  { id: 'star-collector', name: 'Star collector', description: 'Earn 50 puzzle stars.', group: 'Puzzle', progress: goal(50, (v) => v.totalStars) },
  {
    id: 'completionist',
    name: 'Completionist',
    description: 'Solve every puzzle.',
    group: 'Puzzle',
    progress: (v) => [Math.min(v.puzzlesSolved, v.puzzleCount), v.puzzleCount],
  },
  { id: 'daily-habit', name: 'Daily habit', description: 'Play a Daily.', group: 'Daily', progress: goal(1, (v) => v.dailiesPlayed) },
  { id: 'three-in-a-row', name: 'Three in a row', description: 'Play the Daily three days in a row.', group: 'Daily', progress: goal(3, (v) => v.bestDailyStreak) },
  { id: 'week-streak', name: 'Week streak', description: 'Play the Daily seven days in a row.', group: 'Daily', progress: goal(7, (v) => v.bestDailyStreak) },
  { id: 'daily-star', name: 'Daily star', description: 'Get three stars on a Daily.', group: 'Daily', progress: goal(3, (v) => v.bestDailyStars) },
];

/** An achievement with where the player stands on it. */
export interface AchievementState {
  achievement: Achievement;
  current: number;
  goal: number;
  /** When it was unlocked (ISO date), or null. */
  unlockedAt: string | null;
}

/** The lifetime stats and the unlocked achievements, saved; `check` unlocks what's newly earned. */
export class AchievementTracker {
  constructor(private readonly store: KeyValueStore) {}

  get stats(): Stats {
    return { ...NO_STATS, ...this.store.get<Partial<Stats>>('stats', {}) };
  }

  /** Adds to counters (`add`) and raises bests (`best`). */
  record(change: { add?: Partial<Stats>; best?: Partial<Stats> }): void {
    const s = this.stats;
    for (const [k, n] of Object.entries(change.add ?? {})) s[k as keyof Stats] += n;
    for (const [k, n] of Object.entries(change.best ?? {})) s[k as keyof Stats] = Math.max(s[k as keyof Stats], n);
    this.store.set('stats', s);
  }

  private get unlocked(): Record<string, string> {
    return this.store.get<Record<string, string>>('achievements', {});
  }

  list(view: AchievementView): AchievementState[] {
    const unlocked = this.unlocked;
    return ACHIEVEMENTS.map((a) => {
      const [current, goal] = a.progress(view);
      return { achievement: a, current, goal, unlockedAt: unlocked[a.id] ?? null };
    });
  }

  /** Unlocks every achievement now complete; returns the ones that weren't unlocked before. */
  check(view: AchievementView, now = new Date()): Achievement[] {
    const unlocked = this.unlocked;
    const fresh = ACHIEVEMENTS.filter((a) => {
      const [current, goal] = a.progress(view);
      return !unlocked[a.id] && current >= goal;
    });
    if (fresh.length) {
      const at = now.toISOString();
      this.store.set('achievements', { ...unlocked, ...Object.fromEntries(fresh.map((a) => [a.id, at])) });
    }
    return fresh;
  }
}
