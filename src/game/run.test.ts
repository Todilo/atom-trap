import { describe, expect, it } from 'vitest';
import { memoryStore } from '../shell/storage';
import { arcadeAtoms, ARCADE_CLEAR_TIME, ARCADE_START_TIME, ARCADE_TIME_PER_PERCENT, Progress, Run } from './run';

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

  it('keeps Arcade runs apart: their own table and highest level, with Arcade rules', () => {
    const store = memoryStore();
    const classic = new Progress(store);
    const arcade = new Progress(store, 'arcade');
    const run = new Run('scored', arcade);
    expect(run.sim.rules.captureSize).toBeGreaterThan(0);
    expect(new Run('scored', classic).sim.rules.captureSize).toBe(0);
    arcade.submitScore({ score: 500, level: 3, date: '2026-10-26' });
    arcade.noteLevelStarted(4);
    expect(arcade.highScores).toHaveLength(1);
    expect(arcade.highestLevel).toBe(4);
    expect(classic.highScores).toHaveLength(0);
    expect(classic.highestLevel).toBe(1);
  });

  it('carries the Arcade clock from board to board, adding time for each clear', () => {
    const run = new Run('scored', new Progress(memoryStore(), 'arcade'), 'fast', () => 1);
    expect(run.sim.timeLeft).toBe(ARCADE_START_TIME);
    // Clear the board by hand: 80% cleared, with 400 timer units left.
    run.sim.removedCells = Math.ceil(0.8 * 28 * 20);
    run.sim.timeLeft = 400;
    run.sim.status = 'cleared';
    run.nextLevel();
    expect(run.sim.timeLeft).toBe(400 + ARCADE_CLEAR_TIME + 5 * ARCADE_TIME_PER_PERCENT);
  });

  it('adds an Arcade atom every two boards, not every board', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(arcadeAtoms)).toEqual([2, 2, 3, 3, 4, 4, 5]);
    expect(arcadeAtoms(99)).toBe(12);
    const run = new Run('scored', new Progress(memoryStore(), 'arcade'));
    expect(run.sim.atoms).toHaveLength(2);
    expect(run.sim.lives).toBe(4);
    // Round scoring: 10 a cell and 500 a capture, whatever the level.
    expect(run.sim.rules.pointsPerCell).toBe(10);
    expect(run.sim.rules.capturePoints).toBe(500);
  });
});
