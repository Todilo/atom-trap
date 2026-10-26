import { GAME_MODES, modeById, type GameModeId } from '../game/modes';
import { MAX_NAME_LENGTH, type HighScore } from '../game/run';
import { THEMES } from '../render/themes';
import type { ClassicSpeed, LevelBonus } from '../sim/ruleset';

/**
 * Menu and message screens as plain HTML. Buttons carry `data-action` (`name` or `name:argument`);
 * the shell handles the clicks. Full-page screens (title, settings, high scores) cover the stage;
 * dialogs (pause, level cleared, game over) sit over the dimmed board.
 */
const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const button = (action: string, label: string, cls = '', attrs = '') =>
  `<button type="button" data-action="${action}" class="${cls}" ${attrs}>${label}</button>`;

/** Stroke icons, coloured by CSS (`currentColor`). */
const icon = {
  trophy:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></svg>',
  sliders:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true" class="filled"><path d="M6 4l14 8-14 8z"/></svg>',
  next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  music: (on: boolean) =>
    `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>${on ? '' : '<path d="M3 3l18 18"/>'}</svg>`,
  sound: (on: boolean) =>
    `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5L6 9H2v6h4l5 4z"/>${on ? '<path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>' : '<path d="M22 9l-6 6M16 9l6 6"/>'}</svg>`,
};

/** The logo mark: a board split by a wall, an atom on each side. */
const logo = `<svg class="logo" viewBox="0 0 44 44" aria-hidden="true"><rect class="edge" x="3" y="3" width="38" height="38" rx="4"/><line class="hot" x1="22" y1="3" x2="22" y2="41"/><circle class="atom" cx="12" cy="14" r="5"/><circle class="atom" cx="31" cy="29" r="5"/></svg>`;

/** A small picture for each mode card. */
const MODE_ART: Record<GameModeId, string> = {
  classic: `<svg viewBox="0 0 180 104" aria-hidden="true"><rect class="board edge" x="2" y="2" width="176" height="100" rx="3"/><rect class="removed" x="112" y="2" width="66" height="100"/><line class="hot" x1="112" y1="2" x2="112" y2="102"/><line class="edge" x1="2" y1="58" x2="112" y2="58"/><circle class="atom" cx="44" cy="30" r="7"/><circle class="atom" cx="80" cy="82" r="7"/></svg>`,
  daily: `<svg viewBox="0 0 180 104" aria-hidden="true"><rect class="board edge" x="40" y="10" width="100" height="86" rx="8"/><line class="edge" x1="40" y1="32" x2="140" y2="32"/><line class="hot round" x1="62" y1="4" x2="62" y2="18"/><line class="hot round" x1="118" y1="4" x2="118" y2="18"/><circle class="atom" cx="72" cy="62" r="7"/><circle class="atom" cx="108" cy="74" r="7"/></svg>`,
  zen: `<svg viewBox="0 0 180 104" aria-hidden="true"><path class="edge" d="M30 52c0-16 16-28 30-14l60 28c14 14 30 2 30-14s-16-28-30-14L60 66C46 80 30 68 30 52z"/><circle class="atom" cx="60" cy="38" r="7"/><circle class="atom" cx="120" cy="66" r="7"/></svg>`,
  arcade: `<svg viewBox="0 0 180 104" aria-hidden="true"><polygon class="board edge" points="90,14 122,32 122,70 90,88 58,70 58,32"/><path class="bolt" d="M94 30l-14 24h12l-6 20 16-26H90z"/><circle class="atom" cx="30" cy="30" r="6"/><circle class="atom" cx="152" cy="76" r="6"/></svg>`,
};

/** Player preferences shown as switches. */
export interface Prefs {
  music: boolean;
  sfx: boolean;
  haptics: boolean;
  speed: ClassicSpeed;
  /** Colour theme id. */
  theme: string;
  /** The mode selected on the title screen. */
  mode: GameModeId;
}

export function titleScreen(highestLevel: number, prefs: Prefs, bestScore: number | null): string {
  const selected = modeById(prefs.mode);
  const cards = GAME_MODES.map((m) => {
    const on = m.id === selected.id;
    const foot = m.id === 'classic' ? (bestScore ? `Best <b>${fmt(bestScore)}</b>` : 'No score yet') : m.footnote;
    return `
      <button type="button" class="mode-card${on ? ' selected' : ''}" data-action="mode:${m.id}" aria-pressed="${on}">
        <span class="mode-art">${MODE_ART[m.id]}</span>
        <span class="mode-body">
          <span class="mode-head"><span class="mode-name">${m.name}</span><span class="badge${m.available ? ' ready' : ''}">${m.available ? 'Play' : 'Soon'}</span></span>
          <span class="mode-blurb">${m.blurb}</span>
          <span class="mode-foot">${foot}</span>
        </span>
      </button>`;
  }).join('');

  const actions = selected.available
    ? `<div class="segmented" role="group" aria-label="Speed">
        ${button('speed:fast', 'Fast', prefs.speed === 'fast' ? 'on' : '', `aria-pressed="${prefs.speed === 'fast'}"`)}
        ${button('speed:slow', 'Slow · ½ points', prefs.speed === 'slow' ? 'on' : '', `aria-pressed="${prefs.speed === 'slow'}"`)}
      </div>
      ${highestLevel > 1 ? button('continue', `Continue · level ${highestLevel}`, 'secondary') : ''}
      ${button('play', `${icon.play}Play`, 'primary big')}`
    : `<p class="soon-note">This mode is on the way. Classic progress and scores carry over.</p>
      <button type="button" class="soon" disabled>Coming soon</button>`;

  return `
    <div class="page title">
      <header class="topbar">
        <div class="brand">${logo}<div><h1>Atom Trap</h1><p class="tagline">A neon tribute to JezzBall (1992)</p></div></div>
        <nav class="topnav" aria-label="Menu">
          ${button('scores', `${icon.trophy}<span>High scores</span>`, 'nav')}
          ${button('settings', `${icon.sliders}<span>Settings</span>`, 'nav')}
        </nav>
      </header>
      <h2 class="section-label">Choose a mode</h2>
      <div class="modes">${cards}</div>
      <section class="mode-panel" aria-label="Selected mode">
        <div class="mode-summary">
          <div class="mode-title">${selected.name}</div>
          <div class="chips">${selected.rules.map((r) => `<span>${r}</span>`).join('')}</div>
        </div>
        <div class="mode-actions">${actions}</div>
      </section>
    </div>`;
}

const backButton = (action: string) => button(action, icon.back, 'icon', 'aria-label="Back"');

function toggle(action: string, label: string, hint: string, on: boolean): string {
  return `
    <div class="setting">
      <div><div class="setting-label">${label}</div><div class="setting-hint">${hint}</div></div>
      <button type="button" role="switch" class="switch" data-action="${action}" aria-checked="${on}" aria-label="${label}"><span></span></button>
    </div>`;
}

export function settingsScreen(prefs: Prefs, hapticsSupported: boolean, back: 'menu' | 'pause'): string {
  const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
  const swatches = THEMES.map((t) => {
    const on = t.id === prefs.theme;
    return `
      <button type="button" role="radio" class="swatch${on ? ' selected' : ''}" data-action="theme:${t.id}" aria-checked="${on}">
        <span class="swatch-board" style="background:${hex(t.board)};border-color:${hex(t.wall)}">
          <span style="background:${hex(t.removed[0])};border-color:${hex(t.wall)}"></span>
          <i style="background:${t.atomBody[1]}"></i>
        </span>
        <span>${t.name}</span>
      </button>`;
  }).join('');
  return `
    <div class="page settings">
      <header class="topbar">
        <div class="brand">${backButton(back === 'pause' ? 'pause-menu' : 'menu')}<h1 class="page-title">Settings</h1></div>
      </header>
      <div class="panels">
        <section class="panel">
          <h2 class="section-label">Theme</h2>
          <div class="swatches" role="radiogroup" aria-label="Theme">${swatches}</div>
        </section>
        <section class="panel">
          <h2 class="section-label">Sound &amp; feel</h2>
          ${toggle('toggle-music', 'Music', 'Ambient synth soundtrack', prefs.music)}
          ${toggle('toggle-sfx', 'Sound effects', 'Walls, breaks and captures', prefs.sfx)}
          ${hapticsSupported ? toggle('toggle-haptics', 'Vibration', 'On touch devices', prefs.haptics) : ''}
          <div class="panel-foot">${button('show-hint', 'Show the first-play hint again', 'secondary small')}</div>
        </section>
      </div>
    </div>`;
}

/** What the pause dialog shows about the level in progress. */
export interface PauseInfo {
  mode: string;
  level: number;
  coverage: number;
  score: number;
  lives: number;
  time: number;
}

const stat = (label: string, value: string) => `<div class="stat"><span>${label}</span><b>${value}</b></div>`;

export function pauseScreen(info: PauseInfo, prefs: Prefs): string {
  return `
    <div class="dialog" role="dialog" aria-labelledby="dlg-title">
      <div class="dialog-head">
        <h2 id="dlg-title" class="glow">Paused</h2>
        <p class="sub">${info.mode} · Level ${info.level} · ${info.coverage}% cleared</p>
      </div>
      <div class="stats">${stat('Score', fmt(info.score))}${stat('Lives', String(info.lives))}${stat('Time', String(info.time))}</div>
      <div class="stack">
        ${button('resume', `${icon.play}Resume`, 'primary big')}
        ${button('settings', 'Settings', 'secondary')}
        ${button('quit', 'Quit to menu', 'ghost')}
      </div>
      <div class="quick">
        ${button('toggle-music', icon.music(prefs.music), `icon${prefs.music ? ' on' : ''}`, `aria-label="Music ${prefs.music ? 'on' : 'off'}" aria-pressed="${prefs.music}"`)}
        ${button('toggle-sfx', icon.sound(prefs.sfx), `icon${prefs.sfx ? ' on' : ''}`, `aria-label="Sound ${prefs.sfx ? 'on' : 'off'}" aria-pressed="${prefs.sfx}"`)}
      </div>
    </div>`;
}

/** What the level-clear dialog shows. `levelScore` includes the bonus. */
export interface ClearedInfo {
  mode: string;
  level: number;
  coverage: number;
  livesLeft: number;
  bonus: LevelBonus;
  levelScore: number;
  total: number;
  scored: boolean;
  nextAtoms: number;
}

export function levelClearedScreen(c: ClearedInfo): string {
  const row = (label: string, value: number, plus = true) =>
    value > 0 ? `<tr><td>${label}</td><td>${plus ? '+' : ''}${fmt(value)}</td></tr>` : '';
  return `
    <div class="dialog wide gold" role="dialog" aria-labelledby="dlg-title">
      <div class="dialog-head">
        <p class="kicker">${c.mode} · Level ${c.level}</p>
        <h2 id="dlg-title" class="glow gold">Board cleared</h2>
        <p class="sub">${c.coverage}% trapped with ${c.livesLeft} ${c.livesLeft === 1 ? 'life' : 'lives'} left</p>
      </div>
      <table class="bonus">
        ${row('Capture points', c.levelScore - c.bonus.total, false)}
        ${row('Coverage bonus', c.bonus.coverage)}
        ${row('Lives bonus', c.bonus.lives)}
        ${row('Time bonus', c.bonus.time)}
        <tr class="total"><td>${c.scored ? 'Run total' : 'Run total (unscored)'}</td><td>${fmt(c.total)}</td></tr>
      </table>
      <p class="note">Next: ${c.nextAtoms} atoms, ${c.nextAtoms} lives.</p>
      <div class="row">${button('next', `Next level${icon.next}`, 'primary big grow')}</div>
    </div>`;
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
      ? `<p class="note">Saved as ${escape(savedName || 'anonymous')}.</p>`
      : `<form class="name-entry" data-action-form="save-name">
          <label for="name-input" class="sr-only">Your name</label>
          <input id="name-input" type="text" maxlength="${MAX_NAME_LENGTH}" placeholder="Your name" value="${escape(name)}" autocomplete="nickname" enterkeyhint="done" />
          ${button('save-name', 'Save', 'secondary')}
        </form>`;
  return `
    <div class="dialog" role="dialog" aria-labelledby="dlg-title">
      <div class="dialog-head">
        <h2 id="dlg-title" class="glow">${reason === 'time' ? 'Out of time' : 'Game over'}</h2>
        <p class="sub">Level ${level}</p>
      </div>
      <div class="final-score">${fmt(score)}</div>
      ${rank ? `<p class="highlight">New high score, #${rank}!</p>` : ''}
      ${entry}
      ${scored ? '' : '<p class="note">Continue runs don’t count for high scores.</p>'}
      <div class="row">
        ${button('menu', 'Menu', 'secondary grow')}
        ${button('play', `${icon.play}Play again`, 'primary big grow')}
      </div>
    </div>`;
}

export function highScoresScreen(scores: HighScore[], tab: GameModeId, highestLevel: number): string {
  const tabs = GAME_MODES.map(
    (m) => button(`scores:${m.id}`, m.name, m.id === tab ? 'on' : '', `role="tab" aria-selected="${m.id === tab}"`),
  ).join('');
  const mode = modeById(tab);
  let body: string;
  if (mode.id !== 'classic') {
    body = `
      <section class="panel empty" role="tabpanel">
        ${MODE_ART[mode.id]}
        <h2>${mode.name} is on the way</h2>
        <p>${mode.scoresNote ?? ''}</p>
      </section>`;
  } else {
    const rows = scores
      .map(
        (s, i) =>
          `<tr${i === 0 ? ' class="top"' : ''}><td class="rank">${i + 1}</td><td class="name">${escape(s.name ?? '—')}</td><td>${s.level}</td><td class="dim">${s.speed === 'slow' ? 'Slow' : 'Fast'}</td><td class="dim">${s.date.slice(0, 10)}</td><td class="num">${fmt(s.score)}</td></tr>`,
      )
      .join('');
    const table = scores.length
      ? `<table class="scores"><thead><tr><th>#</th><th>Name</th><th>Level</th><th>Speed</th><th>Date</th><th class="num">Score</th></tr></thead><tbody>${rows}</tbody></table>`
      : '<p class="note">No scores yet. Play a game from level 1.</p>';
    body = `
      <div class="score-layout" role="tabpanel">
        <section class="panel table-panel">${table}</section>
        <aside class="side">
          <div class="panel best">
            <span class="section-label">Your best</span>
            <b>${scores.length ? fmt(scores[0].score) : '—'}</b>
            <span class="dim">${scores.length ? `Level ${scores[0].level}` : 'Play a scored run'}</span>
          </div>
          <div class="panel">
            <span class="section-label">Classic</span>
            <div class="kv"><span>Highest level reached</span><b>${highestLevel}</b></div>
            <div class="kv"><span>Scores in the table</span><b>${scores.length}</b></div>
          </div>
        </aside>
      </div>`;
  }
  return `
    <div class="page scores-page">
      <header class="topbar">
        <div class="brand">${backButton('menu')}<h1 class="page-title">High scores</h1></div>
        <div class="segmented tabs" role="tablist" aria-label="Mode">${tabs}</div>
      </header>
      ${body}
    </div>`;
}
