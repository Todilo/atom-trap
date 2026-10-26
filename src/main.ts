import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { PointerInput } from './game/input';
import { cellAt, layoutBoard } from './game/layout';
import { Progress, Run, type RunKind } from './game/run';
import { NeonRenderer } from './render/neonRenderer';
import { AudioEngine, type AudioSettings } from './shell/audio';
import { gameOverScreen, highScoresScreen, levelClearedScreen, pauseScreen, titleScreen } from './shell/screens';
import { localStore } from './shell/storage';
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
  showScreen(titleScreen(progress.highestLevel, audio.settings));
}

function startRun(kind: RunKind): void {
  run = new Run(kind, progress);
  beginLevel();
}

function beginLevel(): void {
  previous = snapshot(run!.sim);
  accumulator = 0;
  input.mouseOrientation = 'vertical';
  mode = 'playing';
  showScreen(null);
}

function pause(): void {
  if (mode !== 'playing') return;
  mode = 'paused';
  showScreen(pauseScreen(audio.settings));
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
      return showScreen(mode === 'paused' ? pauseScreen(audio.settings) : titleScreen(progress.highestLevel, audio.settings));
    case 'toggle-sfx':
      audio.setSfx(!audio.settings.sfx);
      saveAudio();
      return showScreen(mode === 'paused' ? pauseScreen(audio.settings) : titleScreen(progress.highestLevel, audio.settings));
    case 'quit':
      run = null;
      return showMenu();
  }
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
    if (cell) s.placeWall(cell.x, cell.y, o);
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
    if (e.type === 'level-cleared') {
      mode = 'cleared';
      showScreen(levelClearedScreen(run!.level, e.bonus, run!.score, run!.kind === 'scored'));
    } else if (e.type === 'game-over') {
      mode = 'over';
      const rank = run!.finish();
      showScreen(gameOverScreen(e.reason, run!.score, run!.level, run!.kind === 'scored', rank));
    }
  }
}

renderer.app.ticker.add((ticker) => {
  const s = sim();
  if (s && mode === 'playing') {
    accumulator += Math.min(ticker.deltaMS, 250);
    while (accumulator >= s.rules.stepMs && mode === 'playing') {
      previous = snapshot(s);
      handleStepEvents(s);
      accumulator -= s.rules.stepMs;
    }
  }
  renderer.draw(s, previous, s && mode === 'playing' ? accumulator / s.rules.stepMs : 1);
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
if (import.meta.env.DEV) Object.defineProperty(window, 'atomTrap', { get: () => ({ run, mode, layout, progress, renderer, audio }) });

showMenu();
