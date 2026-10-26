import { describe, expect, it } from 'vitest';
import { memoryStore } from '../shell/storage';
import { LAYOUTS } from '../sim/layouts';
import { PUZZLE_LIVES, PUZZLES, PuzzleProgress, startPuzzle, starsFor } from './puzzles';

describe('Puzzles', () => {
  it('are all playable boards: known layouts, sane pars, untimed, no wall limit', () => {
    for (const p of PUZZLES) {
      if (p.layout) expect(LAYOUTS.some((l) => l.id === p.layout)).toBe(true);
      expect(p.par[0]).toBeGreaterThan(0);
      expect(p.par[0]).toBeLessThan(p.par[1]);
      const sim = startPuzzle(p);
      expect(sim.atoms).toHaveLength(p.atoms);
      expect(sim.lives).toBe(PUZZLE_LIVES);
      expect(sim.wallsLeft).toBeNull();
      expect(sim.rules.timeLimit).toBe(0);
    }
  });

  it('start the same way every time', () => {
    expect(startPuzzle(PUZZLES[3]).atoms).toEqual(startPuzzle(PUZZLES[3]).atoms);
  });

  it('give one star for any clear and more for getting near or under par', () => {
    const p = PUZZLES[0];
    expect(starsFor(p, p.par[0])).toBe(3);
    expect(starsFor(p, p.par[0] + 1)).toBe(2);
    expect(starsFor(p, p.par[1])).toBe(2);
    expect(starsFor(p, p.par[1] + 1)).toBe(1);
    expect(starsFor(p, 99)).toBe(1);
  });
});

describe('Puzzle progress', () => {
  it('opens each puzzle once the one before is cleared, and keeps the fewest walls', () => {
    const progress = new PuzzleProgress(memoryStore());
    const p = PUZZLES[0];
    expect(progress.unlocked(0)).toBe(true);
    expect(progress.unlocked(1)).toBe(false);
    expect(progress.record(0, p.par[1] + 3)).toBe(true);
    expect(progress.stars[0]).toBe(1);
    expect(progress.unlocked(1)).toBe(true);
    expect(progress.record(0, p.par[1] + 5)).toBe(false);
    expect(progress.record(0, p.par[0])).toBe(true);
    expect(progress.bestWalls[0]).toBe(p.par[0]);
    expect(progress.stars[0]).toBe(3);
    expect(progress.totalStars).toBe(3);
    expect(progress.suggested).toBe(1);
  });
});
