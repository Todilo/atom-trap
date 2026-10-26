import type { HighScore } from '../game/run';
import type { LevelBonus } from '../sim/ruleset';

/**
 * Menu and message screens as plain HTML. Buttons carry `data-action`; the shell handles the clicks.
 * A screen with `data-tap` also reacts to a tap anywhere.
 */
const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

const button = (action: string, label: string, primary = false) =>
  `<button type="button" data-action="${action}" class="${primary ? 'primary' : ''}">${label}</button>`;

export function titleScreen(highestLevel: number): string {
  return `
    <h1>Atom Trap</h1>
    <p class="tagline">A neon tribute to JezzBall (1992)</p>
    <div class="buttons">
      ${button('play', 'Play', true)}
      ${highestLevel > 1 ? button('continue', `Continue from level ${highestLevel}`) : ''}
      ${button('scores', 'High scores')}
    </div>
    <p class="hint">Touch where a wall should start and swipe: sideways for horizontal, up or down for vertical.</p>`;
}

export function pauseScreen(): string {
  return `
    <h2>Paused</h2>
    <div class="buttons">
      ${button('resume', 'Resume', true)}
      ${button('quit', 'Quit to menu')}
    </div>`;
}

export function levelClearedScreen(level: number, bonus: LevelBonus, total: number, scored: boolean): string {
  const row = (label: string, value: number) => (value > 0 ? `<tr><td>${label}</td><td>${fmt(value)}</td></tr>` : '');
  return `
    <h2>Level ${level} cleared</h2>
    <table class="bonus">
      ${row('Coverage bonus', bonus.coverage)}
      ${row('Lives bonus', bonus.lives)}
      ${row('Time bonus', bonus.time)}
      <tr class="total"><td>Bonus</td><td>${fmt(bonus.total)}</td></tr>
      <tr><td>${scored ? 'Score' : 'Score (unscored run)'}</td><td>${fmt(total)}</td></tr>
    </table>
    <p class="hint" data-tap="next">Tap to start level ${level + 1}</p>`;
}

export function gameOverScreen(reason: 'lives' | 'time', score: number, level: number, scored: boolean, rank: number | null): string {
  return `
    <h2>${reason === 'time' ? 'Out of time' : 'Game over'}</h2>
    <p>Level ${level} · Score ${fmt(score)}</p>
    ${rank ? `<p class="highlight">New high score, #${rank}!</p>` : ''}
    ${scored ? '' : '<p class="hint">Continue runs don’t count for high scores.</p>'}
    <div class="buttons">
      ${button('play', 'Play again', true)}
      ${button('menu', 'Menu')}
    </div>`;
}

export function highScoresScreen(scores: HighScore[]): string {
  const rows = scores
    .map((s, i) => `<tr><td>${i + 1}</td><td>${fmt(s.score)}</td><td>Level ${s.level}</td><td>${s.date.slice(0, 10)}</td></tr>`)
    .join('');
  return `
    <h2>High scores</h2>
    ${scores.length ? `<table class="scores">${rows}</table>` : '<p class="hint">No scores yet. Play a game from level 1.</p>'}
    <div class="buttons">${button('menu', 'Back', true)}</div>`;
}
