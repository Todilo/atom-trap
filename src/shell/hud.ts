import { dayNumber } from '../game/daily';
import { starsFor } from '../game/puzzles';
import type { Simulation } from '../sim/simulation';
import type { Play, ShellMode } from './play';

/** Lives show as dots up to this many; above it, as a number. */
const MAX_LIFE_DOTS = 8;

/**
 * The HUD above the board: mode and level, lives, coverage against the target, the score (or, in
 * puzzles, walls against par), Arcade's chain, and the timer. Updated every frame; parts that build
 * HTML only change when their value does.
 */
export class Hud {
  private readonly root = el('hud');
  private readonly mode = el('hud-mode');
  private readonly level = el('hud-level');
  private readonly lives = el('hud-lives');
  private readonly dots = el('hud-dots');
  private readonly coverage = el('hud-coverage');
  private readonly coverageBar = el('hud-coverage-bar');
  private readonly target = el('hud-target');
  private readonly targetMark = el('hud-target-mark');
  private readonly score = el('hud-score');
  private readonly scoreLabel = el('hud-score-label');
  private readonly stars = el('hud-stars');
  private readonly timeChip = el('hud-time-chip');
  private readonly chain = el('hud-chain');
  private readonly chainValue = el('hud-chain-value');
  private readonly chainBar = el('hud-chain-bar');
  private readonly chainPips = el('hud-chain-pips');
  private readonly unscored = el('hud-unscored');
  private readonly time = el('hud-time');
  private readonly timeBar = el('hud-time-bar');
  readonly pause = el('hud-pause');

  private shownLives = '';
  private shownScore = 0;
  private shownStars = -1;

  /** `stepPart` is how far into the current step it is (0 to 1), for the chain bar to drain smoothly. */
  update(mode: ShellMode, { run, puzzle }: Play, s: Simulation | null, stepPart: number, idleLevel: number): void {
    this.mode.textContent = puzzle?.daily ? 'Daily' : puzzle ? 'Puzzle' : run?.mode === 'arcade' ? 'Arcade' : 'Classic';
    this.level.textContent = puzzle?.daily ? `#${dayNumber(puzzle.daily.key)}` : String(puzzle ? puzzle.index! + 1 : (run?.level ?? idleLevel));

    const lives = s?.lives ?? 0;
    const maxLives = Math.max(s?.rules.lives ?? 0, lives);
    const livesKey = `${lives}/${maxLives}`;
    if (livesKey !== this.shownLives) {
      this.shownLives = livesKey;
      const dots = maxLives > 0 && maxLives <= MAX_LIFE_DOTS;
      this.dots.innerHTML = dots ? Array.from({ length: maxLives }, (_, i) => `<i${i < lives ? ' class="on"' : ''}></i>`).join('') : '';
      this.lives.textContent = String(lives);
      this.lives.classList.toggle('sr-only', dots);
    }

    const coverage = Math.floor((s?.coverage ?? 0) * 100);
    const target = Math.round((s?.rules.targetCoverage ?? 0.75) * 100);
    this.coverage.textContent = `${coverage}%`;
    this.coverageBar.style.width = `${coverage}%`;
    this.target.textContent = `/ ${target}%`;
    this.targetMark.style.left = `${target}%`;

    // Puzzles show walls used against par, and the stars still within reach, instead of a score.
    this.scoreLabel.textContent = puzzle ? `Walls · par ${puzzle.def.par[0]}` : 'Score';
    this.updateChain(run?.mode === 'arcade' ? s : null, stepPart);

    // The score counts up to its new value, so each catch visibly adds to it.
    const score = run?.score ?? 0;
    this.shownScore = Math.abs(score - this.shownScore) < 1 || score < this.shownScore ? score : this.shownScore + (score - this.shownScore) * 0.15;
    this.score.textContent = puzzle ? String(s?.wallsPlaced ?? 0) : Math.round(this.shownScore).toLocaleString('en-US');
    this.score.classList.toggle('counting', score - this.shownScore >= 1);
    const reachable = puzzle && s ? starsFor(puzzle.def, s.wallsPlaced) : -1;
    if (reachable !== this.shownStars) {
      this.shownStars = reachable;
      this.stars.innerHTML = reachable < 0 ? '' : [0, 1, 2].map((i) => `<i${i < reachable ? ' class="on"' : ''}>★</i>`).join('');
      this.stars.setAttribute('aria-label', reachable < 0 ? '' : `${reachable} stars within reach`);
    }
    this.unscored.hidden = run?.kind !== 'continue';

    this.timeChip.hidden = !!s && !s.rules.timeLimit;
    const time = s?.timeLeft ?? 0;
    this.time.textContent = String(time);
    this.timeBar.style.width = `${s ? Math.min(100, (100 * time) / s.rules.timeLimit) : 0}%`;
    this.timeBar.classList.toggle('low', !!s && time <= s.rules.timeWarningAt);

    this.pause.hidden = mode !== 'playing' && mode !== 'paused';
    // The HUD belongs to a game; the menus (and the demo) have none.
    this.root.hidden = mode === 'menu';
  }

  /** Arcade's chain: the multiplier, pips for progress to the next, and a bar draining until it ends. */
  private updateChain(s: Simulation | null, stepPart: number): void {
    this.chain.hidden = !s;
    if (!s) return;
    const active = s.chain > 0;
    const left = active ? (s.chainEndsAt - s.steps + 1 - stepPart) / s.rules.chainWindow : 0;
    this.chainValue.textContent = `×${s.chainMultiplier}`;
    const atTop = s.chainMultiplier === s.rules.chainMultipliers[s.rules.chainMultipliers.length - 1];
    const lit = atTop ? s.rules.chainStep : s.chainProgress;
    if (this.chainPips.childElementCount !== s.rules.chainStep || this.chainPips.dataset.lit !== String(lit)) {
      this.chainPips.dataset.lit = String(lit);
      this.chainPips.innerHTML = Array.from({ length: s.rules.chainStep }, (_, i) => `<i${i < lit ? ' class="on"' : ''}></i>`).join('');
    }
    this.chainBar.style.width = `${Math.max(0, Math.min(1, left)) * 100}%`;
    this.chain.classList.toggle('on', active);
  }
}

function el(id: string): HTMLElement {
  return document.getElementById(id)!;
}
