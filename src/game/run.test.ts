import { describe, expect, it } from 'vitest';
import { memoryStore } from '../shell/storage';
import { Progress, Run } from './run';

/** Clears the current level by force: marks it cleared with some points. */
function clearLevel(run: Run, points: number): void {
  run.sim.score = points;
  run.sim.status = 'cleared';
}

describe('Run', () => {
  it('a scored run starts at level 1 and banks points across levels', () => {
    const progress = new Progress(memoryStore());
    const run = new Run('scored', progress);
    expect(run.level).toBe(1);
    expect(run.sim.atoms).toHaveLength(2);
    clearLevel(run, 1000);
    run.nextLevel();
    expect(run.level).toBe(2);
    expect(run.sim.atoms).toHaveLength(3);
    expect(run.sim.lives).toBe(3);
    run.sim.score = 50;
    expect(run.score).toBe(1050);
  });

  it('remembers the highest level started', () => {
    const progress = new Progress(memoryStore());
    const run = new Run('scored', progress);
    clearLevel(run, 10);
    run.nextLevel();
    clearLevel(run, 10);
    run.nextLevel();
    expect(progress.highestLevel).toBe(3);
  });

  it('a continue run starts at the highest level with score 0 and never enters the table', () => {
    const store = memoryStore();
    store.set('highestLevel', 7);
    const progress = new Progress(store);
    const run = new Run('continue', progress);
    expect(run.level).toBe(7);
    expect(run.sim.lives).toBe(8);
    expect(run.score).toBe(0);
    run.sim.score = 99999;
    expect(run.finish()).toBeNull();
    expect(progress.highScores).toEqual([]);
  });

  it('the high-score table keeps the best 10, ranked', () => {
    const progress = new Progress(memoryStore());
    for (let i = 1; i <= 12; i++) progress.submitScore({ score: i * 100, level: 1, date: '2026-10-26' });
    expect(progress.highScores).toHaveLength(10);
    expect(progress.highScores[0].score).toBe(1200);
    expect(progress.submitScore({ score: 50, level: 1, date: '2026-10-26' })).toBeNull();
    expect(progress.submitScore({ score: 1150, level: 2, date: '2026-10-26' })).toBe(2);
    // Ties rank below existing entries.
    expect(progress.submitScore({ score: 1000, level: 2, date: '2026-10-26' })).toBe(5);
  });
});

describe('Slow speed and names', () => {
  it('a slow run uses the slow ruleset and is marked in the table', () => {
    const progress = new Progress(memoryStore());
    const run = new Run('scored', progress, 'slow');
    expect(run.sim.rules.stepMs).toBe(200);
    expect(run.sim.rules.scoreScale).toBe(0.5);
    run.sim.score = 500;
    expect(run.finish()).toBe(1);
    expect(progress.highScores[0].speed).toBe('slow');
  });

  it('names an entry and remembers the name', () => {
    const progress = new Progress(memoryStore());
    progress.submitScore({ score: 100, level: 1, date: '2026-10-26' });
    progress.nameScore(1, '  Christian the Great  ');
    expect(progress.highScores[0].name).toBe('Christian th');
    expect(progress.playerName).toBe('Christian th');
  });
});
