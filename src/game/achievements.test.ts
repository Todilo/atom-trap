import { describe, expect, it } from 'vitest';
import { memoryStore } from '../shell/storage';
import { ACHIEVEMENTS, AchievementTracker, NO_STATS, type AchievementView } from './achievements';
import { DailyProgress } from './daily';

const view = (o: Partial<AchievementView> = {}, stats = {}): AchievementView => ({
  stats: { ...NO_STATS, ...stats },
  puzzlesSolved: 0,
  puzzleCount: 24,
  totalStars: 0,
  bestPuzzleStars: 0,
  dailiesPlayed: 0,
  bestDailyStreak: 0,
  bestDailyStars: 0,
  ...o,
});

describe('Achievements', () => {
  it('have unique ids, and all start at zero progress', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    for (const a of ACHIEVEMENTS) {
      const [current, goal] = a.progress(view());
      expect(current).toBe(0);
      expect(goal).toBeGreaterThan(0);
    }
  });

  it("has a Classic Atom trap for walling an atom in so it can't move", () => {
    const trap = ACHIEVEMENTS.find((a) => a.id === 'atom-trap')!;
    expect(trap.group).toBe('Classic');
    expect(trap.progress(view({}, { classicTraps: 1 }))).toEqual([1, 1]);
  });

  it('keeps lifetime counters and bests', () => {
    const t = new AchievementTracker(memoryStore());
    t.record({ add: { wallsPlaced: 1, atomsCaptured: 2 }, best: { bestChain: 3 } });
    t.record({ add: { wallsPlaced: 1 }, best: { bestChain: 2 } });
    expect(t.stats).toMatchObject({ wallsPlaced: 2, atomsCaptured: 2, bestChain: 3 });
  });

  it('unlocks what is complete once, with its progress capped at the goal', () => {
    const t = new AchievementTracker(memoryStore());
    const v = view({ puzzlesSolved: 1 }, { atomsCaptured: 120 });
    const fresh = t.check(v, new Date('2026-10-27T10:00:00Z')).map((a) => a.id);
    expect(fresh).toEqual(expect.arrayContaining(['got-one', 'atom-hunter', 'solved']));
    expect(fresh).not.toContain('hat-trick');
    expect(t.check(v)).toEqual([]);
    const hunter = t.list(v).find((s) => s.achievement.id === 'atom-hunter')!;
    expect(hunter).toMatchObject({ current: 100, goal: 100, unlockedAt: '2026-10-27T10:00:00.000Z' });
    expect(t.list(v).find((s) => s.achievement.id === 'architect')).toMatchObject({ current: 0, goal: 1000, unlockedAt: null });
  });
});

describe('Daily records for achievements', () => {
  it('finds the longest run of days played and the best stars', () => {
    const daily = new DailyProgress(memoryStore());
    for (const key of ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-30', '2026-10-31']) daily.start(key, [4, 7]);
    daily.finish('2026-10-27', true, 4);
    expect(daily.bestStreak).toBe(3);
    expect(daily.played).toBe(5);
    expect(daily.bestStars).toBe(3);
  });
});
