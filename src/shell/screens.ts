import { MAX_NAME_LENGTH, type HighScore } from '../game/run';
import type { ClassicSpeed, LevelBonus } from '../sim/ruleset';

/**
 * Menu and message screens as plain HTML. Buttons carry `data-action`; the shell handles the clicks.
 * A screen with `data-tap` also reacts to a tap anywhere.
 */
const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const button = (action: string, label: string, primary = false) =>
  `<button type="button" data-action="${action}" class="${primary ? 'primary' : ''}">${label}</button>`;

/** Player preferences shown as switches. */
export interface Prefs {
  music: boolean;
  sfx: boolean;
  haptics: boolean;
  speed: ClassicSpeed;
  /** Display name of the colour theme. */
  theme: string;
}

const onOff = (on: boolean) => (on ? 'On' : 'Off');

/** Theme, music, sound and vibration switches (ADR-0008); vibration only where the device supports it. */
const toggles = (p: Prefs, hapticsSupported: boolean) => `
    <div class="buttons toggles">
      ${button('toggle-theme', `Theme: ${p.theme}`)}
      ${button('toggle-music', `Music: ${onOff(p.music)}`)}
      ${button('toggle-sfx', `Sound: ${onOff(p.sfx)}`)}
      ${hapticsSupported ? button('toggle-haptics', `Vibration: ${onOff(p.haptics)}`) : ''}
    </div>`;

export function titleScreen(highestLevel: number, prefs: Prefs, hapticsSupported: boolean): string {
  return `
    <h1>Atom Trap</h1>
    <p class="tagline">A neon tribute to JezzBall (1992)</p>
    <div class="buttons">
      ${button('play', 'Play', true)}
      ${highestLevel > 1 ? button('continue', `Continue from level ${highestLevel}`) : ''}
      ${button('scores', 'High scores')}
    </div>
    <div class="buttons toggles">
      ${button('toggle-speed', `Speed: ${prefs.speed === 'fast' ? 'Fast' : 'Slow (half points)'}`)}
    </div>
    ${toggles(prefs, hapticsSupported)}`;
}

export function pauseScreen(prefs: Prefs, hapticsSupported: boolean): string {
  return `
    <h2>Paused</h2>
    <div class="buttons">
      ${button('resume', 'Resume', true)}
      ${button('quit', 'Quit to menu')}
    </div>
    ${toggles(prefs, hapticsSupported)}`;
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

/** `rank` set means a new high score; `savedName` set means its name has been saved. */
export function gameOverScreen(
  reason: 'lives' | 'time',
  score: number,
  level: number,
  scored: boolean,
  rank: number | null,
  name: string,
  savedName: string | null,
): string {
  const entry = !rank
    ? ''
    : savedName !== null
      ? `<p class="hint">Saved as ${escape(savedName || 'anonymous')}.</p>`
      : `<form class="name-entry" data-action-form="save-name">
          <input id="name-input" type="text" maxlength="${MAX_NAME_LENGTH}" placeholder="Your name" value="${escape(name)}" autocomplete="nickname" enterkeyhint="done" />
          ${button('save-name', 'Save')}
        </form>`;
  return `
    <h2>${reason === 'time' ? 'Out of time' : 'Game over'}</h2>
    <p>Level ${level} · Score ${fmt(score)}</p>
    ${rank ? `<p class="highlight">New high score, #${rank}!</p>` : ''}
    ${entry}
    ${scored ? '' : '<p class="hint">Continue runs don’t count for high scores.</p>'}
    <div class="buttons">
      ${button('play', 'Play again', true)}
      ${button('menu', 'Menu')}
    </div>`;
}

export function highScoresScreen(scores: HighScore[]): string {
  const rows = scores
    .map(
      (s, i) =>
        `<tr><td>${i + 1}</td><td class="name">${escape(s.name ?? '—')}</td><td>${fmt(s.score)}</td><td>Level ${s.level}${s.speed === 'slow' ? ' · slow' : ''}</td><td>${s.date.slice(0, 10)}</td></tr>`,
    )
    .join('');
  return `
    <h2>High scores</h2>
    ${scores.length ? `<table class="scores">${rows}</table>` : '<p class="hint">No scores yet. Play a game from level 1.</p>'}
    <div class="buttons">${button('menu', 'Back', true)}</div>`;
}
