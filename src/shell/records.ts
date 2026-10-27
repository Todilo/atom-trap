import { AchievementTracker, type AchievementView } from '../game/achievements';
import { DailyProgress, dailyBoard, dailyPar, dayKey, dayNumber } from '../game/daily';
import { MAX_STARS, PUZZLES, PuzzleProgress } from '../game/puzzles';
import { Progress, type RunMode } from '../game/run';
import type { DailySummary, PuzzleSummary, ScoreTable } from './screens';
import type { KeyValueStore } from './storage';

/**
 * Everything the player has achieved, saved per mode: Classic and Arcade scores and levels, puzzle
 * results, and Daily tries. It also works out today's Daily par (once per day and device) and builds
 * the summaries the screens show.
 */
export class Records {
  readonly classic: Progress;
  readonly arcade: Progress;
  readonly puzzles: PuzzleProgress;
  readonly daily: DailyProgress;
  readonly achievements: AchievementTracker;
  private dailyPar: { key: string; par: [number, number] } | null = null;
  private dailyParWork: string | null = null;

  /** `parReady` runs when today's par has been worked out (the title waits for it). */
  constructor(
    store: KeyValueStore,
    private readonly parReady: () => void,
  ) {
    this.classic = new Progress(store);
    this.arcade = new Progress(store, 'arcade');
    this.puzzles = new PuzzleProgress(store);
    this.daily = new DailyProgress(store);
    this.achievements = new AchievementTracker(store);
  }

  /** Everything achievements are judged on (src/game/achievements.ts). */
  achievementView(): AchievementView {
    const stars = this.puzzles.stars;
    return {
      stats: this.achievements.stats,
      puzzlesSolved: this.puzzles.bestWalls.filter((w) => w !== null).length,
      puzzleCount: PUZZLES.length,
      totalStars: this.puzzles.totalStars,
      bestPuzzleStars: Math.max(0, ...stars),
      dailiesPlayed: this.daily.played,
      bestDailyStreak: this.daily.bestStreak,
      bestDailyStars: this.daily.bestStars,
    };
  }

  progressFor(mode: RunMode): Progress {
    return mode === 'arcade' ? this.arcade : this.classic;
  }

  scoreTables(): Record<RunMode, ScoreTable> {
    return {
      classic: { scores: this.classic.highScores, highestLevel: this.classic.highestLevel },
      arcade: { scores: this.arcade.highScores, highestLevel: this.arcade.highestLevel },
    };
  }

  puzzleSummary(): PuzzleSummary {
    return {
      stars: this.puzzles.stars,
      bestWalls: this.puzzles.bestWalls,
      unlocked: PUZZLES.map((_, i) => this.puzzles.unlocked(i)),
      total: this.puzzles.totalStars,
      max: MAX_STARS,
      suggested: this.puzzles.suggested,
    };
  }

  /** Today's par, or null while it's still being worked out (it starts working on it if needed). */
  parFor(key: string): [number, number] | null {
    if (this.dailyPar?.key === key) return this.dailyPar.par;
    const cached = this.daily.cachedPar(key);
    if (cached) {
      this.dailyPar = { key, par: cached };
      return cached;
    }
    if (this.dailyParWork !== key) {
      this.dailyParWork = key;
      void dailyPar(dailyBoard(key)).then((par) => {
        this.daily.cachePar(key, par);
        this.dailyPar = { key, par };
        this.parReady();
      });
    }
    return null;
  }

  dailySummary(): DailySummary {
    const key = dayKey(new Date());
    return {
      key,
      number: dayNumber(key),
      par: this.parFor(key),
      result: this.daily.result(key),
      streak: this.daily.streak(key),
      history: this.daily.history(),
    };
  }
}
