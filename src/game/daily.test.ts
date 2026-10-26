import { describe, expect, it } from 'vitest';
import { memoryStore } from '../shell/storage';
import { DailyProgress, dailyBoard, dailyPar, dailyStars, dayKey, dayNumber, shareText } from './daily';
import { startPuzzle } from './puzzles';

describe('Daily board', () => {
  it('numbers days from 26 October 2026, by local date', () => {
    expect(dayKey(new Date(2026, 9, 26, 23, 59))).toBe('2026-10-26');
    expect(dayNumber('2026-10-26')).toBe(1);
    expect(dayNumber('2026-11-25')).toBe(31);
    expect(dayNumber('2027-10-26')).toBe(366);
  });

  it('is the same board for the same day and a different one the next day', () => {
    expect(dailyBoard('2026-11-02')).toEqual(dailyBoard('2026-11-02'));
    expect(dailyBoard('2026-11-03').seed).not.toBe(dailyBoard('2026-11-02').seed);
    const board = dailyBoard('2026-11-02');
    expect(board.atoms).toBeGreaterThanOrEqual(3);
    expect(board.atoms).toBeLessThanOrEqual(5);
    expect(startPuzzle({ ...board, par: [1, 2] }).atoms).toHaveLength(board.atoms);
  });

  it('gets the same par on every run, with two stars above three', async () => {
    const board = dailyBoard('2026-11-02');
    const par = await dailyPar(board, 6);
    expect(await dailyPar(board, 6)).toEqual(par);
    expect(par[0]).toBeGreaterThan(0);
    expect(par[1]).toBeGreaterThan(par[0]);
  });
});

describe('Daily progress', () => {
  it('scores only the first try, and counts a try left unfinished', () => {
    const daily = new DailyProgress(memoryStore());
    expect(daily.start('2026-11-02', [4, 7])).toBe(true);
    expect(daily.result('2026-11-02')).toMatchObject({ cleared: false, walls: null });
    expect(daily.start('2026-11-02', [4, 7])).toBe(false);
    daily.finish('2026-11-02', true, 5);
    expect(daily.result('2026-11-02')).toMatchObject({ cleared: true, walls: 5 });
    expect(dailyStars(daily.result('2026-11-02')!)).toBe(2);
    // A later practice game doesn't change it.
    daily.finish('2026-11-02', true, 3);
    expect(daily.result('2026-11-02')!.walls).toBe(5);
  });

  it('counts the streak of days in a row, still alive while today is unplayed', () => {
    const daily = new DailyProgress(memoryStore());
    for (const key of ['2026-10-30', '2026-11-01', '2026-11-02']) daily.start(key, [4, 7]);
    expect(daily.streak('2026-11-02')).toBe(2);
    expect(daily.streak('2026-11-03')).toBe(2);
    expect(daily.streak('2026-11-04')).toBe(0);
    expect(daily.history().map((h) => h.key)).toEqual(['2026-11-02', '2026-11-01', '2026-10-30']);
  });

  it('shares the day, the stars and walls against par, and the streak', () => {
    const text = shareText('2026-10-28', { cleared: true, walls: 5, par: [4, 7] }, 3);
    expect(text).toContain('Daily #3');
    expect(text).toContain('★★☆ · 5 walls (par 4)');
    expect(text).toContain('Streak 3');
    expect(shareText('2026-10-28', { cleared: false, walls: null, par: [4, 7] }, 1)).toContain('Not cleared');
  });
});
