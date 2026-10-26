import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { PointerInput } from './game/input';
import { cellAt, layoutBoard } from './game/layout';
import { Progress, Run, type RunKind } from './game/run';
import { NeonRenderer } from './render/neonRenderer';
import { AudioEngine, type AudioSettings } from './shell/audio';
import { Haptics } from './shell/haptics';
import { gameOverScreen, highScoresScreen, levelClearedScreen, pauseScreen, titleScreen, type Prefs } from './shell/screens';
import { localStore } from './shell/storage';
import type { ClassicSpeed } from './sim/ruleset';
import type { Atom, Simulation } from './sim/simulation';

// The complete Classic game (ADR-0010) with the neon look (ADR-0004) and synth audio (ADR-0008).
registerSW({ immediate: true });

// Best effort only: browsers allow the orientation lock just in fullscreen / installed mode.
const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
orientation.lock?.('landscape').catch(() => {});

const $ = (id: string) => document.getElementById(id)!;
const hud = {
  level: $('hud-level'),
  lives: $('hud-lives'),
  coverage: $('hud-coverage'),
  score: $('hud-score'),
  unscored: $('hud-unscored'),
  time: $('hud-time'),
  pause: $('hud-pause'),
};
const screenEl = $('screen');
const host = $('app');
const renderer = await NeonRenderer.create(host);
const progress = new Progress(localStore);
const audio = new AudioEngine(localStore.get<AudioSettings>('audio', { music: true, sfx: true }));
const saveAudio = () => localStore.set('audio', audio.settings);
const prefsStore = localStore.get<{ haptics: boolean; speed: ClassicSpeed }>('prefs', { haptics: true, speed: 'fast' });
const haptics = new Haptics(prefsStore.haptics);
const savePrefs = () => localStore.set('prefs', { haptics: haptics.enabled, speed: prefsStore.speed });
const prefs = (): Prefs => ({ ...audio.settings, haptics: haptics.enabled, speed: prefsStore.speed });

// Audio unlock: browsers only allow sound after a user gesture, so start it on the first tap or click.
window.addEventListener('pointerdown', () => audio.unlock(), { capture: true });

/**
 * Shell states: `menu` (title / high scores, board idle behind), `playing`, `paused`,
 * `cleared` (level-clear screen), `over` (game-over screen).
 */
type Mode = 'menu' | 'playing' | 'paused' | 'cleared' | 'over';
let mode: Mode = 'menu';
let run: Run | null = null;
let previous: Atom[] = [];
let accumulator = 0;
/** While the first-play hint shows, the level waits for the player's first wall. */
let hintActive = false;
/** The game-over screen's state, so it can be redrawn after the name is saved. */
let gameOver: { reason: 'lives' | 'time'; rank: number | null; savedName: string | null } | null = null;

const hintEl = $('hint');
const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
$('hint-text').innerHTML = coarsePointer
  ? 'Touch where a wall should start, then swipe:<br>sideways for horizontal, up or down for vertical.<br><small>The atoms wait for your first wall.</small>'
  : 'Click to build a wall. Right-click turns it<br>between vertical and horizontal.<br><small>The atoms wait for your first wall.</small>';

function setHint(show: boolean): void {
  hintActive = show;
  hintEl.hidden = !show;
}

const sim = (): Simulation | null => run?.sim ?? null;

function snapshot(s: Simulation): Atom[] {
  return s.atoms.map((a) => ({ ...a }));
}

function showScreen(html: string | null): void {
  screenEl.hidden = html === null;
  screenEl.innerHTML = html ?? '';
}

function showMenu(): void {
  mode = 'menu';
  setHint(false);
  showScreen(titleScreen(progress.highestLevel, prefs(), haptics.supported));
}

function startRun(kind: RunKind): void {
  run = new Run(kind, progress, prefsStore.speed);
  beginLevel();
}

function beginLevel(): void {
  previous = snapshot(run!.sim);
  accumulator = 0;
  input.mouseOrientation = 'vertical';
  mode = 'playing';
  showScreen(null);
  if (!localStore.get('hintSeen', false)) setHint(true);
}

function pause(): void {
  if (mode !== 'playing') return;
  mode = 'paused';
  showScreen(pauseScreen(prefs(), haptics.supported));
}

function resume(): void {
  if (mode !== 'paused') return;
  mode = 'playing';
  showScreen(null);
}

screenEl.addEventListener('click', (e) => {
  const action = (e.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action;
  if (!action) {
    // A tap anywhere on the level-clear screen moves on.
    if (mode === 'cleared') nextLevel();
    return;
  }
  switch (action) {
    case 'play':
      return startRun('scored');
    case 'continue':
      return startRun('continue');
    case 'scores':
      return showScreen(highScoresScreen(progress.highScores));
    case 'menu':
      return showMenu();
    case 'resume':
      return resume();
    case 'toggle-music':
      audio.setMusic(!audio.settings.music);
      saveAudio();
      return redrawSettings();
    case 'toggle-sfx':
      audio.setSfx(!audio.settings.sfx);
      saveAudio();
      return redrawSettings();
    case 'toggle-haptics':
      haptics.enabled = !haptics.enabled;
      savePrefs();
      haptics.event({ type: 'wall-completed', slot: 'a' });
      return redrawSettings();
    case 'toggle-speed':
      prefsStore.speed = prefsStore.speed === 'fast' ? 'slow' : 'fast';
      savePrefs();
      return redrawSettings();
    case 'save-name':
      return saveName();
    case 'quit':
      run = null;
      setHint(false);
      return showMenu();
  }
});

/** Redraws the screen that holds the settings switches after one changes. */
function redrawSettings(): void {
  showScreen(mode === 'paused' ? pauseScreen(prefs(), haptics.supported) : titleScreen(progress.highestLevel, prefs(), haptics.supported));
}

function showGameOver(): void {
  const g = gameOver!;
  showScreen(gameOverScreen(g.reason, run!.score, run!.level, run!.kind === 'scored', g.rank, progress.playerName, g.savedName));
}

function saveName(): void {
  if (!gameOver?.rank) return;
  const value = (document.getElementById('name-input') as HTMLInputElement | null)?.value ?? '';
  progress.nameScore(gameOver.rank, value);
  gameOver.savedName = progress.highScores[gameOver.rank - 1]?.name ?? '';
  showGameOver();
}

// Enter in the name field saves too.
screenEl.addEventListener('submit', (e) => {
  e.preventDefault();
  saveName();
});

function nextLevel(): void {
  run!.nextLevel();
  beginLevel();
}

hud.pause.addEventListener('click', () => (mode === 'paused' ? resume() : pause()));

let layout = layoutBoard(28, 20, 0, 0, 1, 1);
function relayout(): void {
  // Layout size, not the on-screen box: in portrait the stage is drawn rotated (ADR-0013).
  const width = host.clientWidth;
  const height = host.clientHeight;
  const pad = 8;
  layout = layoutBoard(28, 20, pad, pad, width - 2 * pad, height - 2 * pad);
  renderer.setLayout(layout, 28, 20);
}
new ResizeObserver(relayout).observe(host);
relayout();

const input = new PointerInput(renderer.canvas, {
  place(x, y, o) {
    const s = sim();
    if (mode !== 'playing' || !s) return;
    const cell = cellAt(layout, s.rules.cols, s.rules.rows, x, y);
    if (!cell) return;
    s.placeWall(cell.x, cell.y, o);
    if (hintActive) {
      setHint(false);
      localStore.set('hintSeen', true);
    }
  },
  tap: () => mode !== 'playing',
});

// Auto-pause when the app goes to the background; the player resumes it (ADR-0008).
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pause();
    audio.suspend();
  } else {
    audio.resume();
  }
});

function handleStepEvents(s: Simulation): void {
  for (const e of s.step()) {
    audio.event(e);
    haptics.event(e);
    if (e.type === 'level-cleared') {
      mode = 'cleared';
      showScreen(levelClearedScreen(run!.level, e.bonus, run!.score, run!.kind === 'scored'));
    } else if (e.type === 'game-over') {
      mode = 'over';
      gameOver = { reason: e.reason, rank: run!.finish(), savedName: null };
      showGameOver();
    }
  }
}

renderer.app.ticker.add((ticker) => {
  const s = sim();
  if (s && mode === 'playing' && !hintActive) {
    accumulator += Math.min(ticker.deltaMS, 250);
    while (accumulator >= s.rules.stepMs && mode === 'playing') {
      previous = snapshot(s);
      handleStepEvents(s);
      accumulator -= s.rules.stepMs;
    }
  }
  renderer.draw(s, previous, s && mode === 'playing' && !hintActive ? accumulator / s.rules.stepMs : 1);
  updateHud();
  const growing = mode === 'playing' && s ? (s.halves.a?.cells.length ?? 0) + (s.halves.b?.cells.length ?? 0) : 0;
  audio.setGrowing(growing);
});

function updateHud(): void {
  const s = sim();
  hud.level.textContent = String(run?.level ?? progress.highestLevel);
  hud.lives.textContent = String(s?.lives ?? 0);
  hud.coverage.textContent = `${Math.floor((s?.coverage ?? 0) * 100)}%`;
  hud.score.textContent = Math.round(run?.score ?? 0).toLocaleString('en-US');
  hud.unscored.hidden = run?.kind !== 'continue';
  hud.time.textContent = String(s?.timeLeft ?? 0);
  hud.pause.hidden = mode !== 'playing' && mode !== 'paused';
}

// Dev-only hook for inspecting the running game from the browser console.
if (import.meta.env.DEV) Object.defineProperty(window, 'atomTrap', { get: () => ({ run, mode, layout, progress, renderer, audio, haptics }) });

showMenu();
