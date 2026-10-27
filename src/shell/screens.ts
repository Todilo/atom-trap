import { dailyStars, dayNumber, type DailyResult } from '../game/daily';
import { GAME_MODES, modeById, type GameModeId } from '../game/modes';
import { PUZZLES } from '../game/puzzles';
import { layoutById } from '../sim/layouts';
import { MAX_NAME_LENGTH, type HighScore, type RunMode } from '../game/run';
import { ATOM_STYLES, THEMES, type AtomStyle } from '../render/themes';
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
  download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
  trophy:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></svg>',
  sliders:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
  left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
  right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true" class="filled"><path d="M6 4l14 8-14 8z"/></svg>',
  next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  restart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>',
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
  puzzle: `<svg viewBox="0 0 180 104" aria-hidden="true"><rect class="board edge" x="2" y="2" width="176" height="100" rx="3"/><rect class="removed" x="30" y="16" width="20" height="20"/><rect class="removed" x="130" y="16" width="20" height="20"/><circle class="atom" cx="90" cy="26" r="7"/><path class="bolt" d="M60 58l4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1z"/><path class="bolt" d="M90 58l4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1z"/><path class="bolt" d="M120 58l4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1z"/></svg>`,
  arcade: `<svg viewBox="0 0 180 104" aria-hidden="true"><polygon class="board edge" points="90,14 122,32 122,70 90,88 58,70 58,32"/><path class="bolt" d="M94 30l-14 24h12l-6 20 16-26H90z"/><circle class="atom" cx="30" cy="30" r="6"/><circle class="atom" cx="152" cy="76" r="6"/></svg>`,
};

/** Player preferences shown as switches. */
export interface Prefs {
  music: boolean;
  sfx: boolean;
  musicVolume: number;
  sfxVolume: number;
  haptics: boolean;
  speed: ClassicSpeed;
  /** Colour theme id. */
  theme: string;
  atomStyle: AtomStyle;
  /** The mode selected on the title screen. */
  mode: GameModeId;
  reduceMotion: boolean;
}

/** Puzzle progress, for the title screen, the puzzle list and the Puzzle scores tab. */
export interface PuzzleSummary {
  /** Best stars per puzzle, in PUZZLES order. */
  stars: number[];
  /** Fewest walls each puzzle was cleared in, or null. */
  bestWalls: (number | null)[];
  unlocked: boolean[];
  total: number;
  max: number;
  /** The puzzle the title screen offers: the first open one without three stars. */
  suggested: number;
}

/** Three stars, `n` of them lit. */
function stars(n: number, cls = ''): string {
  const one = (on: boolean) =>
    `<svg viewBox="0 0 24 24" class="star${on ? ' on' : ''}" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>`;
  return `<span class="stars ${cls}" role="img" aria-label="${n} of 3 stars">${[0, 1, 2].map((i) => one(i < n)).join('')}</span>`;
}

/** A small picture of a puzzle's board: its layout's filled cells. */
function boardThumb(layoutId: string | undefined): string {
  const rows = layoutId ? layoutById(layoutId).rows : [];
  const cells = rows.flatMap((row, y) => [...row].map((c, x) => (c === '#' ? `<rect x="${x}" y="${y}" width="1.02" height="1.02"/>` : ''))).join('');
  return `<svg class="thumb" viewBox="0 0 28 20" preserveAspectRatio="none" aria-hidden="true"><rect class="thumb-board" width="28" height="20"/><g class="thumb-cells">${cells}</g></svg>`;
}

/** Today's Daily, for the title screen and the Daily scores tab. */
export interface DailySummary {
  key: string;
  number: number;
  /** Null while the device works out the day's par. */
  par: [number, number] | null;
  /** Today's scored try, once taken. */
  result: DailyResult | null;
  streak: number;
  history: { key: string; result: DailyResult }[];
}

function dailyOutcome(r: DailyResult): string {
  return r.cleared ? `${stars(dailyStars(r), 'small')} ${r.walls} walls` : 'Not cleared';
}

/**
 * The attract screen the game opens on: the demo plays full-screen behind the logo, and a tap
 * anywhere (the whole screen is the button) brings up the menu.
 */
export function attractScreen(touch: boolean): string {
  return `
    <button type="button" class="attract" data-action="wake" aria-label="Show the menu">
      <span class="attract-brand">${logo}<span class="attract-name">Atom Trap</span></span>
      <span class="attract-cta">${touch ? 'Tap to play' : 'Click to play'}</span>
    </button>`;
}

/** A scored mode's high-score table and highest level (Classic, Arcade). */
export interface ScoreTable {
  scores: HighScore[];
  highestLevel: number;
}

/** `canInstall`: the browser offers to install the game as an app (it isn't installed yet). */
export function titleScreen(prefs: Prefs, tables: Record<RunMode, ScoreTable>, puzzles: PuzzleSummary, daily: DailySummary, canInstall: boolean): string {
  const selected = modeById(prefs.mode);
  const cards = GAME_MODES.map((m) => {
    const on = m.id === selected.id;
    const best = (t: ScoreTable) => (t.scores.length ? `Best <b>${fmt(t.scores[0].score)}</b>` : 'No score yet');
    const foot =
      m.id === 'classic' || m.id === 'arcade'
        ? best(tables[m.id])
        : m.id === 'puzzle'
          ? `Stars <b>${puzzles.total} / ${puzzles.max}</b>`
          : m.id === 'daily'
            ? daily.result
              ? `Today ${dailyOutcome(daily.result)}`
              : `#${daily.number} is ready${daily.streak ? ` · streak <b>${daily.streak}</b>` : ''}`
            : m.footnote;
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

  const next = puzzles.suggested;
  const dailyActions = daily.result
    ? `<p class="soon-note">Today: ${dailyOutcome(daily.result)}${daily.streak ? ` · streak ${daily.streak}` : ''}. A new board at midnight.</p>
      ${button('daily-practice', `${icon.restart}Practice`, 'secondary')}
      ${button('daily-share', 'Share result', 'primary big')}`
    : daily.par
      ? `${button('daily', `${icon.play}Play Daily #${daily.number}`, 'primary big')}`
      : `<button type="button" class="soon" disabled>Preparing today's board…</button>`;
  const actions =
    selected.id === 'daily'
      ? dailyActions
      : selected.id === 'puzzle'
      ? `${button('puzzles', 'All puzzles', 'secondary')}
      ${button(`puzzle:${next}`, `${icon.play}Puzzle ${next + 1}`, 'primary big')}`
      : selected.id === 'classic' || selected.id === 'arcade'
    ? `${
        // Slow speed is the original's; Arcade plays at Fast.
        selected.id === 'classic'
          ? `<div class="segmented" role="group" aria-label="Speed">
        ${button('speed:fast', 'Fast', prefs.speed === 'fast' ? 'on' : '', `aria-pressed="${prefs.speed === 'fast'}"`)}
        ${button('speed:slow', 'Slow · ½ points', prefs.speed === 'slow' ? 'on' : '', `aria-pressed="${prefs.speed === 'slow'}"`)}
      </div>`
          : ''
      }
      ${tables[selected.id].highestLevel > 1 ? button('continue', `Continue · level ${tables[selected.id].highestLevel}`, 'secondary') : ''}
      ${button('play', `${icon.play}Play`, 'primary big')}`
    : `<p class="soon-note">This mode is on the way. Classic progress and scores carry over.</p>
      <button type="button" class="soon" disabled>Coming soon</button>`;

  return `
    <div class="page title">
      <header class="topbar">
        <div class="brand">${logo}<div><h1>Atom Trap</h1><p class="tagline">A neon tribute to JezzBall (1992)</p></div></div>
        <nav class="topnav" aria-label="Menu">
          ${canInstall ? button('install', `${icon.download}<span>Install app</span>`, 'nav') : ''}
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

/** A volume slider under its on/off switch (main.ts listens for `data-volume`). */
function volume(which: 'music' | 'sfx', label: string, value: number): string {
  return `<div class="volume"><input type="range" min="0" max="100" step="5" value="${Math.round(value * 100)}" data-volume="${which}" aria-label="${label}" /></div>`;
}

function toggle(action: string, label: string, hint: string, on: boolean): string {
  return `
    <div class="setting">
      <div><div class="setting-label">${label}</div><div class="setting-hint">${hint}</div></div>
      <button type="button" role="switch" class="switch" data-action="${action}" aria-checked="${on}" aria-label="${label}"><span></span></button>
    </div>`;
}

/** Atom styles shown at a time in Settings; the arrows page through the rest. */
export const ATOM_PAGE_SIZE = 3;

/**
 * `atomPage` picks which atom styles show. Each one gets a canvas that the shell fills with a live
 * preview drawn by the game's own atom painter (`data-atom-preview`).
 */
/** The version row in Settings: `ready` once a new version has downloaded; `unavailable` without offline support (dev). */
export interface UpdateInfo {
  version: string;
  status: 'idle' | 'checking' | 'latest' | 'failed' | 'ready' | 'unavailable';
}

function updateRow(u: UpdateInfo): string {
  const note = {
    idle: '',
    checking: '',
    latest: 'You have the latest version.',
    failed: 'Couldn’t check. Are you offline?',
    ready: 'A new version is ready.',
    unavailable: 'Updates work in the deployed game.',
  }[u.status];
  const action =
    u.status === 'ready'
      ? button('apply-update', `${icon.restart}Reload to update`, 'primary small')
      : u.status === 'unavailable'
        ? ''
        : button('check-update', u.status === 'checking' ? 'Checking…' : 'Check for updates', 'secondary small', u.status === 'checking' ? 'disabled' : '');
  return `
    <div class="setting version-row">
      <div><div class="setting-label">Version</div><div class="setting-hint">${u.version}${note ? ` · ${note}` : ''}</div></div>
      ${action}
    </div>`;
}

export function settingsScreen(prefs: Prefs, hapticsSupported: boolean, back: 'menu' | 'pause', atomPage: number, update: UpdateInfo): string {
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
  const pages = Math.ceil(ATOM_STYLES.length / ATOM_PAGE_SIZE);
  const atoms = ATOM_STYLES.slice(atomPage * ATOM_PAGE_SIZE, (atomPage + 1) * ATOM_PAGE_SIZE)
    .map((a) => {
      const on = a.id === prefs.atomStyle;
      return `
      <button type="button" role="radio" class="swatch${on ? ' selected' : ''}" data-action="atom:${a.id}" aria-checked="${on}">
        <canvas class="atom-preview" data-atom-preview="${a.id}" aria-hidden="true"></canvas>
        <span>${a.name}</span>
      </button>`;
    })
    .join('');
  return `
    <div class="page settings">
      <header class="topbar">
        <div class="brand">${backButton(back === 'pause' ? 'pause-menu' : 'menu')}<h1 class="page-title">Settings</h1></div>
      </header>
      <div class="panels">
        <section class="panel">
          <h2 class="section-label">Theme</h2>
          <div class="swatches" role="radiogroup" aria-label="Theme">${swatches}</div>
          <div class="label-row"><h2 class="section-label">Atoms</h2><span class="dim">${atomPage + 1} / ${pages}</span></div>
          <div class="carousel">
            ${button('atoms-page:-1', icon.left, 'icon', 'aria-label="Previous atom styles"')}
            <div class="swatches atoms" role="radiogroup" aria-label="Atoms">${atoms}</div>
            ${button('atoms-page:1', icon.right, 'icon', 'aria-label="More atom styles"')}
          </div>
        </section>
        <section class="panel">
          <h2 class="section-label">Sound &amp; feel</h2>
          ${toggle('toggle-music', 'Music', 'Ambient synth soundtrack', prefs.music)}
          ${prefs.music ? volume('music', 'Music volume', prefs.musicVolume) : ''}
          ${toggle('toggle-sfx', 'Sound effects', 'Walls, breaks and captures', prefs.sfx)}
          ${prefs.sfx ? volume('sfx', 'Sound effects volume', prefs.sfxVolume) : ''}
          ${hapticsSupported ? toggle('toggle-haptics', 'Vibration', 'On touch devices', prefs.haptics) : ''}
          ${toggle('toggle-motion', 'Reduce motion', 'No shake, demo or pop-in effects; softer flashes', prefs.reduceMotion)}
          ${updateRow(update)}
          <div class="panel-foot">${button('show-hint', 'Show the tutorials again', 'secondary small')}</div>
        </section>
      </div>
    </div>`;
}

/** What the pause dialog shows about the level in progress. */
export interface PauseInfo {
  /** Where the player is, e.g. "Classic · Level 3". */
  where: string;
  coverage: number;
  stats: [label: string, value: string][];
  /** Puzzles can be restarted; a scored Classic run can't, or a bad board could be retried. */
  canRestart: boolean;
}

const stat = (label: string, value: string) => `<div class="stat"><span>${label}</span><b>${value}</b></div>`;

export function pauseScreen(info: PauseInfo, prefs: Prefs): string {
  return `
    <div class="dialog" role="dialog" aria-labelledby="dlg-title">
      <div class="dialog-head">
        <h2 id="dlg-title" class="glow">Paused</h2>
        <p class="sub">${info.where} · ${info.coverage}% cleared</p>
      </div>
      <div class="stats">${info.stats.map(([label, value]) => stat(label, value)).join('')}</div>
      <div class="stack">
        ${button('resume', `${icon.play}Resume`, 'primary big')}
        ${info.canRestart ? button('retry', `${icon.restart}Restart`, 'secondary') : ''}
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
        <tr class="total"><td>${c.scored ? 'Run total' : 'Run total (unscored)'}</td><td data-count="${Math.round(c.total)}">${fmt(c.total)}</td></tr>
      </table>
      <div class="row">${button('next', `Next level${icon.next}`, 'primary big grow')}</div>
    </div>`;
}

/** `rank` set means a new high score; `savedName` set means its name has been saved. */
export function gameOverScreen(
  reason: 'lives' | 'time' | 'walls',
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

export function highScoresScreen(tables: Record<RunMode, ScoreTable>, tab: GameModeId, puzzles: PuzzleSummary, daily: DailySummary): string {
  const tabs = GAME_MODES.map(
    (m) => button(`scores:${m.id}`, m.name, m.id === tab ? 'on' : '', `role="tab" aria-selected="${m.id === tab}"`),
  ).join('');
  const mode = modeById(tab);
  let body: string;
  if (mode.id === 'puzzle') {
    const rows = PUZZLES.map(
      (p, i) =>
        `<tr${puzzles.unlocked[i] ? '' : ' class="dim"'}><td class="rank">${i + 1}</td><td class="name">${p.name}</td><td class="dim">${puzzles.bestWalls[i] ?? '—'}</td><td class="dim">${p.par[0]}</td><td class="num">${puzzles.unlocked[i] ? stars(puzzles.stars[i], 'small') : 'Locked'}</td></tr>`,
    ).join('');
    body = `
      <div class="score-layout" role="tabpanel">
        <section class="panel table-panel"><table class="scores"><thead><tr><th>#</th><th>Puzzle</th><th>Best walls</th><th>Par</th><th class="num">Stars</th></tr></thead><tbody>${rows}</tbody></table></section>
        <aside class="side">
          <div class="panel best">
            <span class="section-label">Stars</span>
            <b>${puzzles.total} / ${puzzles.max}</b>
            <span class="dim">${puzzles.stars.filter((s) => s > 0).length} of ${PUZZLES.length} puzzles solved</span>
          </div>
          <div class="panel">${button('puzzles', 'Open puzzles', 'secondary')}</div>
        </aside>
      </div>`;
  } else if (mode.id === 'daily') {
    const rows = daily.history
      .map(
        ({ key, result }) =>
          `<tr><td class="rank">#${dayNumber(key)}</td><td class="dim">${key}</td><td>${dailyOutcome(result)}</td><td class="dim num">par ${result.par[0]}</td></tr>`,
      )
      .join('');
    body = `
      <div class="score-layout" role="tabpanel">
        <section class="panel table-panel">${
          rows
            ? `<table class="scores"><thead><tr><th>Day</th><th>Date</th><th>Result</th><th class="num">Par</th></tr></thead><tbody>${rows}</tbody></table>`
            : '<p class="note">No Daily played yet. A new board arrives every day.</p>'
        }</section>
        <aside class="side">
          <div class="panel best">
            <span class="section-label">Streak</span>
            <b>${daily.streak}</b>
            <span class="dim">${daily.streak === 1 ? 'day' : 'days'} in a row</span>
          </div>
        </aside>
      </div>`;
  } else if (mode.id !== 'classic' && mode.id !== 'arcade') {
    body = `
      <section class="panel empty" role="tabpanel">
        ${MODE_ART[mode.id]}
        <h2>${mode.name} is on the way</h2>
        <p>${mode.scoresNote ?? ''}</p>
      </section>`;
  } else {
    const { scores, highestLevel } = tables[mode.id];
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
            <span class="section-label">${mode.name}</span>
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

export function puzzlesScreen(summary: PuzzleSummary): string {
  const tiles = PUZZLES.map((p, i) => {
    const open = summary.unlocked[i];
    return `
      <button type="button" class="puzzle-tile${open ? '' : ' locked'}" data-action="puzzle:${i}" ${open ? '' : 'disabled'} aria-label="Puzzle ${i + 1}, ${p.name}${open ? `, ${summary.stars[i]} of 3 stars` : ', locked'}">
        ${boardThumb(p.layout)}
        <span class="puzzle-head"><span class="puzzle-num">${i + 1}</span><span class="puzzle-name">${p.name}</span></span>
        <span class="puzzle-foot">${open ? stars(summary.stars[i], 'small') : '<span class="dim">Locked</span>'}<span class="dim">${summary.bestWalls[i] !== null ? `Best ${summary.bestWalls[i]} · ` : ''}Par ${p.par[0]}</span></span>
      </button>`;
  }).join('');
  return `
    <div class="page puzzles-page">
      <header class="topbar">
        <div class="brand">${backButton('menu')}<h1 class="page-title">Puzzles</h1></div>
        <div class="total-stars">${stars(3, 'small')}<b>${summary.total} / ${summary.max}</b></div>
      </header>
      <div class="puzzle-grid">${tiles}</div>
    </div>`;
}

/** What the puzzle-solved dialog shows. */
export interface PuzzleResult {
  index: number;
  stars: number;
  /** True when this beat the puzzle's earlier best. */
  improved: boolean;
  wallsUsed: number;
  /** Fewest walls this puzzle has been cleared in, this clear included. */
  best: number;
  hasNext: boolean;
}

export function puzzleClearedScreen(r: PuzzleResult): string {
  const p = PUZZLES[r.index];
  const tip =
    r.stars === 3
      ? 'Perfect.'
      : `Use ${r.stars === 2 ? p.par[0] : p.par[1]} walls or fewer for ${r.stars === 2 ? 'three' : 'two'} stars.`;
  return `
    <div class="dialog gold" role="dialog" aria-labelledby="dlg-title">
      <div class="dialog-head">
        <p class="kicker">Puzzle ${r.index + 1} · ${p.name}</p>
        <h2 id="dlg-title" class="glow gold">Solved</h2>
      </div>
      ${stars(r.stars, 'big')}
      <p class="sub">${r.wallsUsed} walls · par ${p.par[0]} · ${r.improved ? 'new best' : `best ${r.best}`}. ${tip}</p>
      <div class="row">
        ${button('retry', `${icon.restart}Retry`, 'secondary grow')}
        ${r.hasNext ? button(`puzzle:${r.index + 1}`, `Next${icon.next}`, 'primary big grow') : button('puzzles', 'All puzzles', 'primary big grow')}
      </div>
      ${r.hasNext ? button('puzzles', 'All puzzles', 'ghost') : ''}
    </div>`;
}

export function puzzleFailedScreen(reason: 'lives' | 'time' | 'walls', index: number): string {
  const p = PUZZLES[index];
  return `
    <div class="dialog" role="dialog" aria-labelledby="dlg-title">
      <div class="dialog-head">
        <p class="kicker">Puzzle ${index + 1} · ${p.name}</p>
        <h2 id="dlg-title" class="glow">${reason === 'walls' ? 'Out of walls' : 'Out of lives'}</h2>
        <p class="sub">${reason === 'walls' ? 'No walls left before 75% was cleared.' : 'Every life lost to a broken wall.'}</p>
      </div>
      <div class="row">
        ${button('puzzles', 'All puzzles', 'secondary grow')}
        ${button('retry', `${icon.restart}Retry`, 'primary big grow')}
      </div>
    </div>`;
}

/** What a cleared Arcade board earned: the time added and where its points came from. */
export interface ArcadeClear {
  level: number;
  seconds: number;
  fills: number;
  captures: number;
  bonus: number;
}

/** Arcade's quick note between boards (it moves on by itself). */
export function arcadeClearedBanner(c: ArcadeClear): string {
  const part = (label: string, n: number) => (n > 0 ? `<span><b>${fmt(n)}</b> ${label}</span>` : '');
  return `
    <div class="banner-card" role="status">
      <p class="kicker">Level ${c.level} cleared</p>
      <p class="banner-time">+${c.seconds} s</p>
      <p class="banner-points">${part('fills', c.fills)}${part('captures', c.captures)}${part('bonus', c.bonus)}</p>
      <p class="sub">Level ${c.level + 1} next</p>
    </div>`;
}

/** What the Daily result dialog shows. */
export interface DailyEnd {
  number: number;
  cleared: boolean;
  walls: number;
  par: [number, number];
  /** False for practice games after the day's scored try. */
  scored: boolean;
  streak: number;
}

export function dailyResultScreen(d: DailyEnd): string {
  const earned = d.cleared ? dailyStars({ cleared: true, walls: d.walls, par: d.par }) : 0;
  return `
    <div class="dialog${d.cleared ? ' gold' : ''}" role="dialog" aria-labelledby="dlg-title">
      <div class="dialog-head">
        <p class="kicker">Daily #${d.number}${d.scored ? '' : ' · practice'}</p>
        <h2 id="dlg-title" class="glow${d.cleared ? ' gold' : ''}">${d.cleared ? 'Solved' : 'Not cleared'}</h2>
      </div>
      ${d.cleared ? stars(earned, 'big') : ''}
      <p class="sub">${d.cleared ? `${d.walls} walls · par ${d.par[0]}` : 'Every life lost to a broken wall.'}${d.scored && d.streak ? ` · streak ${d.streak}` : ''}</p>
      ${d.scored ? '' : '<p class="note">Practice games don’t change today’s result.</p>'}
      <div class="row">
        ${button('menu', 'Menu', 'secondary grow')}
        ${d.scored ? button('daily-share', 'Share result', 'primary big grow') : button('daily-practice', `${icon.restart}Again`, 'primary big grow')}
      </div>
      ${d.scored ? button('daily-practice', 'Practice this board', 'ghost') : ''}
    </div>`;
}

/** The modes that explain themselves the first time they're played. */
export type IntroMode = 'puzzle' | 'daily' | 'arcade';

/** Small animated pictures for the intros (the animation is CSS: `.intro-art` in style.css). */
const INTRO_ART: Record<IntroMode, string> = {
  // A wall closes a small pocket's gap, the atom inside implodes and the pocket fills.
  arcade: `<svg viewBox="0 0 180 104" aria-hidden="true"><rect class="board edge" x="2" y="2" width="176" height="100" rx="3"/><path class="edge" d="M50 20H110V84H90M70 84H50Z"/><rect class="removed i-fill" x="52" y="22" width="56" height="60"/><line class="hot i-wall" x1="70" y1="84" x2="90" y2="84"/><circle class="atom i-atom" cx="80" cy="50" r="7"/><circle class="edge i-ring" cx="80" cy="50" r="16"/><circle class="atom" cx="150" cy="30" r="6"/></svg>`,
  // Three walls go up one after another; fewer walls, more stars.
  puzzle: `<svg viewBox="0 0 180 104" aria-hidden="true"><rect class="board edge" x="2" y="2" width="176" height="100" rx="3"/><rect class="removed" x="40" y="30" width="16" height="16"/><rect class="removed" x="124" y="58" width="16" height="16"/><line class="hot i-wall i-w1" x1="90" y1="2" x2="90" y2="102"/><line class="hot i-wall i-w2" x1="2" y1="52" x2="90" y2="52"/><line class="hot i-wall i-w3" x1="90" y1="70" x2="178" y2="70"/><circle class="atom" cx="140" cy="30" r="6"/><path class="bolt" d="M24 70l3 6 7 1-5 5 1 7-6-4-6 4 1-7-5-5 7-1z"/></svg>`,
  // A calendar page with today's number, and a share arrow.
  daily: `<svg viewBox="0 0 180 104" aria-hidden="true"><rect class="board edge" x="50" y="12" width="80" height="80" rx="8"/><line class="edge" x1="50" y1="32" x2="130" y2="32"/><line class="hot round" x1="68" y1="6" x2="68" y2="18"/><line class="hot round" x1="112" y1="6" x2="112" y2="18"/><circle class="atom" cx="76" cy="60" r="6"/><circle class="atom" cx="104" cy="72" r="6"/><path class="edge" d="M146 58l16-12-16-12M162 46h-14c-8 0-12 6-12 14"/></svg>`,
};

const INTROS: Record<IntroMode, { title: string; lines: string[] }> = {
  arcade: {
    title: 'Hunt the atoms',
    lines: [
      'Seal an atom into a pocket of 20 cells or fewer to capture it: 500 points and +5 seconds.',
      'Catches within a few seconds of each other build a chain, up to ×8.',
      'One clock for the whole run. Clearing a board adds time; capturing the last atom clears it too.',
    ],
  },
  puzzle: {
    title: 'Fewer walls, more stars',
    lines: [
      'Each puzzle starts the same way every time. No timer, three lives.',
      'Any clear earns a star. Get near par for two, reach par for three.',
      'Clear a puzzle to open the next one.',
    ],
  },
  daily: {
    title: 'One board a day',
    lines: [
      'Everyone gets the same board today. Clear it in as few walls as you can.',
      'Your first try is the one that counts; after that you can practise.',
      'Share your result, and play every day to keep your streak.',
    ],
  },
};

/** Explains a mode the first time it's played; its button starts the game. */
export function introScreen(m: IntroMode): string {
  const intro = INTROS[m];
  return `
    <div class="dialog intro" role="dialog" aria-labelledby="dlg-title">
      <div class="dialog-head">
        <p class="kicker">${modeById(m).name}</p>
        <h2 id="dlg-title" class="glow">${intro.title}</h2>
      </div>
      <div class="intro-art ${m}">${INTRO_ART[m]}</div>
      <ul class="intro-lines">${intro.lines.map((l) => `<li>${l}</li>`).join('')}</ul>
      <div class="row">
        ${button('menu', 'Back', 'secondary grow')}
        ${button('intro-ok', `${icon.play}Let's play`, 'primary big grow')}
      </div>
    </div>`;
}
