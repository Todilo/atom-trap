import '@fontsource/chakra-petch/latin-500.css';
import '@fontsource/chakra-petch/latin-600.css';
import '@fontsource/chakra-petch/latin-700.css';
import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { PointerInput } from './game/input';
import { layoutBoard, wallOriginAt } from './game/layout';
import { Progress, Run, type RunKind, type RunMode } from './game/run';
import { NeonRenderer, snapshot, type Snapshot } from './render/neonRenderer';
import { modeById, type GameModeId } from './game/modes';
import { BotPlayer } from './game/bot';
import { DailyProgress, dailyBoard, dailyPar, dayKey, dayNumber, shareText } from './game/daily';
import { MAX_STARS, PUZZLES, PuzzleProgress, startPuzzle, starsFor, type Puzzle } from './game/puzzles';
import { AtomPreview } from './render/atomPreview';
import { createLevel } from './sim/levels';
import { LAYOUTS } from './sim/layouts';
import { ATOM_STYLES, atomStyleById, cssVariables, themeById, type AtomStyle, type Theme } from './render/themes';
import { AudioEngine, type AudioSettings } from './shell/audio';
import { Haptics } from './shell/haptics';
import {
  gameOverScreen,
  highScoresScreen,
  levelClearedScreen,
  pauseScreen,
  arcadeClearedBanner,
  attractScreen,
  dailyResultScreen,
  puzzleClearedScreen,
  puzzleFailedScreen,
  puzzlesScreen,
  ATOM_PAGE_SIZE,
  settingsScreen,
  titleScreen,
  type Prefs,
  type PuzzleSummary,
  type DailySummary,
} from './shell/screens';
import { localStore } from './shell/storage';
import type { ClassicSpeed } from './sim/ruleset';
import type { GameEvent, Simulation } from './sim/simulation';

// Classic (ADR-0010) and Puzzle modes with the neon look (ADR-0004) and synth audio (ADR-0008).

// Best effort only: browsers allow the orientation lock just in fullscreen / installed mode.
const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
orientation.lock?.('landscape').catch(() => {});

const $ = (id: string) => document.getElementById(id)!;
const hud = {
  mode: $('hud-mode'),
  level: $('hud-level'),
  lives: $('hud-lives'),
  dots: $('hud-dots'),
  coverage: $('hud-coverage'),
  coverageBar: $('hud-coverage-bar'),
  target: $('hud-target'),
  targetMark: $('hud-target-mark'),
  score: $('hud-score'),
  scoreLabel: $('hud-score-label'),
  stars: $('hud-stars'),
  timeChip: $('hud-time-chip'),
  chain: $('hud-chain'),
  chainValue: $('hud-chain-value'),
  chainBar: $('hud-chain-bar'),
  chainPips: $('hud-chain-pips'),
  unscored: $('hud-unscored'),
  time: $('hud-time'),
  timeBar: $('hud-time-bar'),
  pause: $('hud-pause'),
};
const screenEl = $('screen');
const hudEl = $('hud');
const host = $('app');
const progress = new Progress(localStore);
const arcadeProgress = new Progress(localStore, 'arcade');
const progressFor = (m: RunMode) => (m === 'arcade' ? arcadeProgress : progress);
const scoreTables = () => ({
  classic: { scores: progress.highScores, highestLevel: progress.highestLevel },
  arcade: { scores: arcadeProgress.highScores, highestLevel: arcadeProgress.highestLevel },
});
const puzzleProgress = new PuzzleProgress(localStore);
const dailyProgress = new DailyProgress(localStore);

/** Today's par, worked out once per day and device by the bot (src/game/daily.ts). */
let dailyParFor: { key: string; par: Promise<[number, number]> } | null = null;
let dailyParReady: { key: string; par: [number, number] } | null = null;

function ensureDailyPar(key: string): void {
  const cached = dailyProgress.cachedPar(key);
  if (cached) {
    dailyParReady = { key, par: cached };
    return;
  }
  if (dailyParFor?.key === key) return;
  const par = dailyPar(dailyBoard(key));
  dailyParFor = { key, par };
  void par.then((p) => {
    dailyProgress.cachePar(key, p);
    dailyParReady = { key, par: p };
    // The title waits for it: redraw if it's still showing.
    if (screenEl.querySelector('.page.title')) redraw?.();
  });
}

function dailySummary(): DailySummary {
  const key = dayKey(new Date());
  ensureDailyPar(key);
  return {
    key,
    number: dayNumber(key),
    par: dailyParReady?.key === key ? dailyParReady.par : null,
    result: dailyProgress.result(key),
    streak: dailyProgress.streak(key),
    history: dailyProgress.history(),
  };
}

function puzzleSummary(): PuzzleSummary {
  const stars = puzzleProgress.stars;
  return {
    stars,
    bestWalls: puzzleProgress.bestWalls,
    unlocked: PUZZLES.map((_, i) => puzzleProgress.unlocked(i)),
    total: puzzleProgress.totalStars,
    max: MAX_STARS,
    suggested: puzzleProgress.suggested,
  };
}
let theme = themeById(localStore.get('theme', 'neon'));
let atomStyle: AtomStyle = atomStyleById(localStore.get('atomStyle', 'soft'));
const renderer = await NeonRenderer.create(host, theme);
renderer.setAtomStyle(atomStyle);

/** Applies a colour theme to the board (renderer) and to the menus and HUD (CSS variables). */
function applyTheme(t: Theme): void {
  theme = t;
  renderer.setTheme(t);
  for (const [name, value] of Object.entries(cssVariables(t))) document.documentElement.style.setProperty(name, value);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', cssVariables(t)['--bg']);
}
applyTheme(theme);
const audio = new AudioEngine(localStore.get<AudioSettings>('audio', { music: true, sfx: true }));
const saveAudio = () => localStore.set('audio', audio.settings);
const prefsStore = {
  haptics: true,
  speed: 'fast' as ClassicSpeed,
  mode: 'classic' as GameModeId,
  ...localStore.get<{ haptics?: boolean; speed?: ClassicSpeed; mode?: GameModeId }>('prefs', {}),
};
const haptics = new Haptics(prefsStore.haptics);
const savePrefs = () => localStore.set('prefs', { haptics: haptics.enabled, speed: prefsStore.speed, mode: prefsStore.mode });
const prefs = (): Prefs => ({ ...audio.settings, haptics: haptics.enabled, speed: prefsStore.speed, theme: theme.id, atomStyle, mode: prefsStore.mode });

// Audio unlock: browsers only allow sound after a user gesture, so start it on the first tap or click.
window.addEventListener('pointerdown', () => audio.unlock(), { capture: true });

/**
 * Shell states: `menu` (title / high scores, board idle behind), `playing`, `paused`,
 * `cleared` (level-clear screen), `over` (game-over screen).
 */
type Mode = 'menu' | 'playing' | 'paused' | 'cleared' | 'over';
let mode: Mode = 'menu';
/** The Classic run in progress, if any; at most one of `run` and `puzzle` is set. */
let run: Run | null = null;
/**
 * The puzzle-style game in progress, if any: a Puzzle (`index` into PUZZLES) or a Daily board
 * (`daily`, scored or practice). Both play the same way.
 */
let puzzle: { def: Puzzle; index: number | null; daily: { key: string; scored: boolean } | null; sim: Simulation } | null = null;

/**
 * The demo on the attract screen: the bot (src/game/bot.ts) plays a Classic board, sometimes on a
 * layout, like the original's demo. The game opens on it and returns to it after the title sits idle.
 * Silent, and off for reduced motion (the game then opens on the menu).
 */
let demo: { sim: Simulation; bot: BotPlayer; endedAt: number | null } | null = null;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
/** A lighter bot than the tuner's, so its look-ahead never makes a frame stutter on a phone. */
const DEMO_BOT = { candidates: 10, sloppiness: 0.3 };

function newDemo(): void {
  const seed = (Math.random() * 0xffffffff) >>> 0;
  // Half the demos show off a layout.
  const layout = Math.random() < 0.5 ? LAYOUTS[Math.floor(Math.random() * LAYOUTS.length)].id : undefined;
  const sim = createLevel({ level: 2 + Math.floor(Math.random() * 3), layout, seed });
  demo = { sim, bot: new BotPlayer(seed, DEMO_BOT), endedAt: null };
  previous = snapshot(sim);
  accumulator = 0;
}

/** Whether the demo should run now: on the attract screen. */
const demoShowing = () => mode === 'menu' && !run && !puzzle && screenEl.classList.contains('attract-screen');

/** Back to the demo after this long on the title screen without any input. */
const ATTRACT_AFTER_MS = 20_000;
let lastInput = performance.now();
for (const type of ['pointerdown', 'pointermove', 'keydown'] as const) window.addEventListener(type, () => (lastInput = performance.now()), { capture: true });

function showAttract(): void {
  if (reducedMotion.matches) return showMenu();
  mode = 'menu';
  run = null;
  puzzle = null;
  setHint(false);
  demo = null;
  showScreen(attractScreen(coarsePointer), 'attract-screen');
}

// Any key on the attract screen brings up the menu, like a tap.
window.addEventListener('keydown', () => {
  if (demoShowing()) showMenu();
});
/** The simulation before its latest step, for drawing smoothly between steps. */
let previous: Snapshot = { atoms: [], halves: { a: null, b: null } };
let accumulator = 0;
/** While the first-play hint shows, the level waits for the player's first wall. */
let hintActive = false;
/** The game-over screen's state, so it can be redrawn after the name is saved. */
let gameOver: { reason: 'lives' | 'time' | 'walls'; rank: number | null; savedName: string | null } | null = null;

const hintEl = $('hint');
const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
hintEl.classList.add(coarsePointer ? 'touch' : 'mouse');
$('hint-text').innerHTML = coarsePointer
  ? 'Touch where a wall should start, then swipe:<br>sideways for horizontal, up or down for vertical.<br><small>The atoms wait for your first wall.</small>'
  : 'Click to build a wall. Right-click turns it<br>between vertical and horizontal.<br><small>The atoms wait for your first wall.</small>';

function setHint(show: boolean): void {
  hintActive = show;
  hintEl.hidden = !show;
}

/** The game being played; the title demo is drawn separately. */
const sim = (): Simulation | null => run?.sim ?? puzzle?.sim ?? null;

/** Redraws the screen on show, for switches and tabs that change it in place. */
let redraw: (() => void) | null = null;

/** A page covers the whole stage; a dialog sits over the dimmed board. */
function showScreen(html: string | null, kind: 'page' | 'dialog' | 'attract-screen' | 'banner' = 'dialog', draw: (() => void) | null = null): void {
  // Redrawing the same screen (a switch flipped) keeps its scroll position.
  const scroll = draw && draw === redraw ? screenEl.scrollTop : 0;
  redraw = draw;
  screenEl.hidden = html === null;
  screenEl.className = kind;
  screenEl.innerHTML = html ?? '';
  screenEl.scrollTop = scroll;
}

/**
 * Asks the server for a new version. A phone keeps the game open for days, and switching back to it
 * doesn't reload the page, so this also runs on resume and on the title screen, at most once a minute.
 * Resolves once a new version has had time to download; `updateReady` then says whether one did.
 */
let lastUpdateCheck = 0;
async function checkForUpdate(force = false): Promise<void> {
  if (!swRegistration || (!force && Date.now() - lastUpdateCheck < 60_000)) return;
  lastUpdateCheck = Date.now();
  await swRegistration.update();
  const installing = swRegistration.installing;
  if (installing) {
    await new Promise<void>((resolve) => {
      const done = () => installing.state !== 'installing' && resolve();
      installing.addEventListener('statechange', done);
      setTimeout(resolve, 20_000);
    });
    // The page hears about the waiting version just after it installs.
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

/** The Settings row's state while the player checks for updates by hand. */
let updateCheck: 'idle' | 'checking' | 'latest' | 'failed' = 'idle';

async function checkForUpdateNow(): Promise<void> {
  updateCheck = 'checking';
  redrawSettings();
  try {
    await checkForUpdate(true);
    updateCheck = 'latest';
  } catch {
    updateCheck = 'failed';
  }
  redrawSettings();
}

function showMenu(): void {
  mode = 'menu';
  setHint(false);
  void checkForUpdate().catch(() => {});
  const draw = () =>
    showScreen(titleScreen(prefs(), scoreTables(), puzzleSummary(), dailySummary()), 'page', draw);
  draw();
}

function showScores(tab: GameModeId): void {
  const draw = () => showScreen(highScoresScreen(scoreTables(), tab, puzzleSummary(), dailySummary()), 'page', draw);
  draw();
}

function showPuzzles(): void {
  mode = 'menu';
  run = null;
  puzzle = null;
  setHint(false);
  showScreen(puzzlesScreen(puzzleSummary()), 'page');
}

/** Which page of atom styles Settings shows; it opens on the page holding the current style. */
let atomPage = 0;
const atomPages = Math.ceil(ATOM_STYLES.length / ATOM_PAGE_SIZE);
/** Created the first time Settings opens: it needs its own small WebGL context. */
let atomPreview: Promise<AtomPreview> | null = null;

function showSettings(): void {
  const from = mode === 'paused' ? 'pause' : 'menu';
  atomPage = Math.floor(ATOM_STYLES.findIndex((s) => s.id === atomStyle) / ATOM_PAGE_SIZE);
  const draw = () => {
    const update = {
      version: import.meta.env.VITE_APP_VERSION ?? 'local build',
      status: !swRegistration ? ('unavailable' as const) : updateReady ? ('ready' as const) : updateCheck,
    };
    showScreen(settingsScreen(prefs(), haptics.supported, from, atomPage, update), 'page', draw);
    void showAtomPreviews();
  };
  draw();
}

/** Fills the atom tiles in Settings with live previews drawn by the game's own atom painter. */
async function showAtomPreviews(): Promise<void> {
  const canvases = [...screenEl.querySelectorAll<HTMLCanvasElement>('canvas[data-atom-preview]')];
  if (!canvases.length) return;
  atomPreview ??= AtomPreview.create();
  const preview = await atomPreview;
  // The screen may have been redrawn while the preview was being created.
  if (!canvases.every((c) => c.isConnected)) return;
  preview.attach(
    canvases.map((canvas) => ({ canvas, style: atomStyleById(canvas.dataset.atomPreview!) })),
    theme,
  );
}

function showPause(): void {
  const s = sim()!;
  const info = puzzle
    ? {
        where: puzzle.daily ? `${puzzle.def.name}${puzzle.daily.scored ? '' : ' · practice'}` : `Puzzle ${puzzle.index! + 1} · ${puzzle.def.name}`,
        stats: [
          ['Walls', String(s.wallsPlaced)],
          ['Par', String(puzzle.def.par[0])],
          ['Lives', String(s.lives)],
        ] as [string, string][],
        // The Daily's scored try can't be restarted, or a bad board could be tried again.
        canRestart: !puzzle.daily?.scored,
      }
    : {
        where: `${run!.mode === 'arcade' ? 'Arcade' : 'Classic'} · Level ${run!.level}`,
        stats: [
          ['Score', Math.round(run!.score).toLocaleString('en-US')],
          ['Lives', String(s.lives)],
          ['Time', String(s.timeLeft)],
        ] as [string, string][],
        canRestart: false,
      };
  const draw = () => showScreen(pauseScreen({ ...info, coverage: Math.floor(s.coverage * 100) }, prefs()), 'dialog', draw);
  draw();
}

/** Starts a Classic or Arcade run, as selected on the title screen (Arcade plays at Fast). */
function startRun(kind: RunKind): void {
  const runMode: RunMode = prefsStore.mode === 'arcade' ? 'arcade' : 'classic';
  puzzle = null;
  run = new Run(kind, progressFor(runMode), runMode === 'arcade' ? 'fast' : prefsStore.speed);
  beginLevel();
}

function playPuzzle(index: number): void {
  if (!puzzleProgress.unlocked(index) || !PUZZLES[index]) return;
  run = null;
  puzzle = { def: PUZZLES[index], index, daily: null, sim: startPuzzle(PUZZLES[index]) };
  beginLevel();
}

/** Today's Daily: the scored try if it's still unused, otherwise practice. */
function playDaily(practice: boolean): void {
  const key = dayKey(new Date());
  if (dailyParReady?.key !== key) return;
  const def: Puzzle = { ...dailyBoard(key), par: dailyParReady.par };
  const scored = !practice && dailyProgress.start(key, def.par);
  run = null;
  puzzle = { def, index: null, daily: { key, scored }, sim: startPuzzle(def) };
  beginLevel();
}

async function shareDaily(button: HTMLElement): Promise<void> {
  const key = dayKey(new Date());
  const result = dailyProgress.result(key);
  if (!result) return;
  const text = shareText(key, result, dailyProgress.streak(key));
  try {
    if (navigator.share) await navigator.share({ text });
    else {
      await navigator.clipboard.writeText(text);
      button.textContent = 'Copied';
    }
  } catch {
    // Cancelled, or no permission: nothing to do.
  }
}

function beginLevel(): void {
  previous = snapshot(sim()!);
  accumulator = 0;
  input.mouseOrientation = 'vertical';
  mode = 'playing';
  showScreen(null);
  if (!localStore.get('hintSeen', false)) setHint(true);
}

function pause(): void {
  if (mode !== 'playing') return;
  mode = 'paused';
  showPause();
}

function resume(): void {
  if (mode !== 'paused') return;
  mode = 'playing';
  showScreen(null);
}

screenEl.addEventListener('click', (e) => {
  const action = (e.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action;
  if (!action) {
    // A tap anywhere on Classic's level-clear screen moves on.
    if (mode === 'cleared' && run) nextLevel();
    return;
  }
  const [name, arg] = action.split(':');
  switch (name) {
    case 'wake':
      return showMenu();
    case 'play':
      return startRun('scored');
    case 'continue':
      return startRun('continue');
    case 'next':
      return nextLevel();
    case 'puzzles':
      return showPuzzles();
    case 'puzzle':
      return playPuzzle(Number(arg));
    case 'retry':
      if (puzzle?.daily) playDaily(true);
      else if (puzzle) playPuzzle(puzzle.index!);
      return;
    case 'daily':
      return playDaily(false);
    case 'daily-practice':
      return playDaily(true);
    case 'daily-share':
      return void shareDaily((e.target as HTMLElement).closest('button')!);
    case 'mode':
      prefsStore.mode = modeById(arg).id;
      savePrefs();
      return redrawSettings();
    case 'speed':
      prefsStore.speed = arg === 'slow' ? 'slow' : 'fast';
      savePrefs();
      return redrawSettings();
    case 'scores':
      return showScores(arg ? modeById(arg).id : 'classic');
    case 'settings':
      return showSettings();
    case 'pause-menu':
      return showPause();
    case 'atom':
      atomStyle = atomStyleById(arg);
      renderer.setAtomStyle(atomStyle);
      localStore.set('atomStyle', atomStyle);
      // Only move the highlight: redrawing would restart the live previews.
      for (const b of screenEl.querySelectorAll<HTMLElement>('[data-action^="atom:"]')) {
        const on = b.dataset.action === `atom:${atomStyle}`;
        b.classList.toggle('selected', on);
        b.setAttribute('aria-checked', String(on));
      }
      return;
    case 'atoms-page':
      atomPage = (atomPage + Number(arg) + atomPages) % atomPages;
      return redrawSettings();
    case 'theme':
      applyTheme(themeById(arg));
      localStore.set('theme', theme.id);
      return redrawSettings();
    case 'check-update':
      return void checkForUpdateNow();
    case 'apply-update':
      return void updateSW(true);
    case 'show-hint':
      localStore.set('hintSeen', false);
      (e.target as HTMLElement).closest('button')!.textContent = 'The hint shows on your next game';
      return;
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
    case 'save-name':
      return saveName();
    case 'quit':
      run = null;
      puzzle = null;
      setHint(false);
      return showMenu();
  }
});

/** Redraws the current screen after a switch or selection on it changes. */
function redrawSettings(): void {
  redraw?.();
}

function showGameOver(): void {
  const g = gameOver!;
  showScreen(gameOverScreen(g.reason, run!.score, run!.level, run!.kind === 'scored', g.rank, progress.playerName, g.savedName));
}

function saveName(): void {
  if (!gameOver?.rank) return;
  const value = (document.getElementById('name-input') as HTMLInputElement | null)?.value ?? '';
  const table = progressFor(run!.mode);
  table.nameScore(gameOver.rank, value);
  gameOver.savedName = table.highScores[gameOver.rank - 1]?.name ?? '';
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
    const cell = wallOriginAt(layout, s.rules.cols, s.rules.rows, x, y, o);
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
    void checkForUpdate().catch(() => {});
  }
});

/** One puzzle attempt, logged in dev builds to tune pars from real play (`atomTrap.puzzleLog()`). */
interface PuzzleAttempt {
  puzzle: number;
  cleared: boolean;
  walls: number;
  livesLost: number;
}

function logPuzzleAttempt(s: Simulation, cleared: boolean): void {
  if (!import.meta.env.DEV || puzzle?.index == null) return;
  const log = localStore.get<PuzzleAttempt[]>('puzzleLog', []);
  log.push({ puzzle: puzzle.index, cleared, walls: s.wallsPlaced, livesLost: s.rules.lives - s.lives });
  localStore.set('puzzleLog', log.slice(-1000));
}

function handleStepEvents(s: Simulation): void {
  for (const e of s.step()) {
    audio.event(e);
    haptics.event(e);
    if (run?.mode === 'arcade') arcadeFeedback(s, e);
    if (puzzle?.daily && (e.type === 'level-cleared' || e.type === 'game-over')) {
      const cleared = e.type === 'level-cleared';
      mode = cleared ? 'cleared' : 'over';
      const { key, scored } = puzzle.daily;
      if (scored) dailyProgress.finish(key, cleared, s.wallsPlaced);
      showScreen(
        dailyResultScreen({ number: dayNumber(key), cleared, walls: s.wallsPlaced, par: puzzle.def.par, scored, streak: dailyProgress.streak(key) }),
      );
    } else if (puzzle?.index != null && e.type === 'level-cleared') {
      mode = 'cleared';
      logPuzzleAttempt(s, true);
      const stars = starsFor(puzzle.def, s.wallsPlaced);
      const improved = puzzleProgress.record(puzzle.index, s.wallsPlaced);
      const best = puzzleProgress.bestWalls[puzzle.index] ?? s.wallsPlaced;
      showScreen(
        puzzleClearedScreen({ index: puzzle.index, stars, improved, wallsUsed: s.wallsPlaced, best, hasNext: puzzle.index + 1 < PUZZLES.length }),
      );
    } else if (puzzle?.index != null && e.type === 'game-over') {
      logPuzzleAttempt(s, false);
      mode = 'over';
      showScreen(puzzleFailedScreen(e.reason, puzzle.index));
    } else if (e.type === 'level-cleared' && run?.mode === 'arcade') {
      // Arcade keeps moving: a flash and the time gained, then the next board by itself.
      mode = 'cleared';
      renderer.flashBoard();
      showScreen(
        arcadeClearedBanner({ level: run.level, seconds: Math.round(run.clearTimeBonus / 10), fills: s.fillPoints, captures: s.capturePointsEarned, bonus: e.bonus.total }),
        'banner',
      );
      setTimeout(() => {
        if (mode === 'cleared' && run?.mode === 'arcade') nextLevel();
      }, 1500);
    } else if (e.type === 'level-cleared') {
      mode = 'cleared';
      showScreen(
        levelClearedScreen({
          mode: modeById(prefsStore.mode).name,
          level: run!.level,
          coverage: Math.floor(s.coverage * 100),
          livesLeft: s.lives,
          bonus: e.bonus,
          levelScore: s.score,
          total: run!.score,
          scored: run!.kind === 'scored',
        }),
      );
    } else if (e.type === 'game-over') {
      mode = 'over';
      gameOver = { reason: e.reason, rank: run!.finish(), savedName: null };
      showGameOver();
    }
  }
}

renderer.app.ticker.add((ticker) => {
  if (demoShowing()) return drawDemo(ticker.deltaMS);
  // A title screen left alone goes back to the demo.
  if (mode === 'menu' && !reducedMotion.matches && screenEl.querySelector('.page.title') && performance.now() - lastInput > ATTRACT_AFTER_MS) {
    return showAttract();
  }
  if (demo) {
    demo = null;
    previous = sim() ? snapshot(sim()!) : { atoms: [], halves: { a: null, b: null } };
  }
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

/** Steps and draws the title demo; a finished board makes way for a new one after a short pause. */
function drawDemo(deltaMS: number): void {
  if (!demo || (demo.endedAt !== null && performance.now() - demo.endedAt > 2000)) newDemo();
  const d = demo!;
  if (d.sim.status === 'playing') {
    accumulator += Math.min(deltaMS, 250);
    while (accumulator >= d.sim.rules.stepMs && d.sim.status === 'playing') {
      previous = snapshot(d.sim);
      d.bot.act(d.sim);
      d.sim.step();
      accumulator -= d.sim.rules.stepMs;
    }
    if (d.sim.status !== 'playing') d.endedAt = performance.now();
  }
  renderer.draw(d.sim, previous, d.sim.status === 'playing' ? accumulator / d.sim.rules.stepMs : 1);
  updateHud();
  audio.setGrowing(0);
}

/** Arcade feedback (ADR-0018): points rising where cells filled, implosions, and shakes. */
let lastFill = { x: 0, y: 0 };
function arcadeFeedback(s: Simulation, e: GameEvent): void {
  const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
  // How much a catch matters: a thin wall (~100 points) is light, 5,000 points or more is the top.
  const weight = (points: number) => Math.log10(Math.max(points, 100) / 100) / Math.log10(50);
  if (e.type === 'cells-removed') {
    lastFill = { x: e.x, y: e.y };
    renderer.popup(`+${fmt(e.points)}${s.chainMultiplier > 1 ? ` ×${s.chainMultiplier}` : ''}`, e.x, e.y, weight(e.points));
  } else if (e.type === 'atom-captured') {
    renderer.implode(e.x, e.y);
    renderer.popup(`Captured +${fmt(e.points)}`, e.x, e.y - 1, 1);
  } else if (e.type === 'big-catch') {
    renderer.popup('Big catch ×2', lastFill.x, lastFill.y + 1.5, 0.8);
    renderer.shake(0.3);
  }
}

/** Lives show as dots up to this many; above it, as a number. */
const MAX_LIFE_DOTS = 8;
let shownLives = '';
let shownScore = 0;
let shownStars = -1;

function updateHud(): void {
  const s = sim();
  hud.mode.textContent = puzzle?.daily ? 'Daily' : puzzle ? 'Puzzle' : run?.mode === 'arcade' ? 'Arcade' : 'Classic';
  hud.level.textContent = puzzle?.daily ? `#${dayNumber(puzzle.daily.key)}` : String(puzzle ? puzzle.index! + 1 : (run?.level ?? progress.highestLevel));
  const lives = s?.lives ?? 0;
  // A +1 life power-up can take lives above the level's start.
  const maxLives = Math.max(s?.rules.lives ?? 0, lives);
  const livesKey = `${lives}/${maxLives}`;
  if (livesKey !== shownLives) {
    shownLives = livesKey;
    const dots = maxLives > 0 && maxLives <= MAX_LIFE_DOTS;
    hud.dots.innerHTML = dots ? Array.from({ length: maxLives }, (_, i) => `<i${i < lives ? ' class="on"' : ''}></i>`).join('') : '';
    hud.lives.textContent = String(lives);
    hud.lives.classList.toggle('sr-only', dots);
  }
  const coverage = Math.floor((s?.coverage ?? 0) * 100);
  const target = Math.round((s?.rules.targetCoverage ?? 0.75) * 100);
  hud.coverage.textContent = `${coverage}%`;
  hud.coverageBar.style.width = `${coverage}%`;
  hud.target.textContent = `/ ${target}%`;
  hud.targetMark.style.left = `${target}%`;
  // Puzzles show walls used against par, and the stars still within reach, instead of a score.
  hud.scoreLabel.textContent = puzzle ? `Walls · par ${puzzle.def.par[0]}` : 'Score';
  // Arcade's chain: the multiplier, and a bar draining until the chain ends.
  hud.chain.hidden = run?.mode !== 'arcade';
  if (run?.mode === 'arcade' && s) {
    const active = s.chain > 0;
    const left = active ? (s.chainEndsAt - s.steps + 1 - accumulator / s.rules.stepMs) / s.rules.chainWindow : 0;
    hud.chainValue.textContent = `×${s.chainMultiplier}`;
    // Pips: progress towards the next multiplier (all lit at the top).
    const atTop = s.chainMultiplier === s.rules.chainMultipliers[s.rules.chainMultipliers.length - 1];
    const lit = atTop ? s.rules.chainStep : s.chainProgress;
    if (hud.chainPips.childElementCount !== s.rules.chainStep || hud.chainPips.dataset.lit !== String(lit)) {
      hud.chainPips.dataset.lit = String(lit);
      hud.chainPips.innerHTML = Array.from({ length: s.rules.chainStep }, (_, i) => `<i${i < lit ? ' class="on"' : ''}></i>`).join('');
    }
    hud.chainBar.style.width = `${Math.max(0, Math.min(1, left)) * 100}%`;
    hud.chain.classList.toggle('on', active);
  }
  // The score counts up to its new value, so each catch visibly adds to it.
  const score = run?.score ?? 0;
  shownScore = Math.abs(score - shownScore) < 1 || score < shownScore ? score : shownScore + (score - shownScore) * 0.15;
  hud.score.textContent = puzzle ? String(s?.wallsPlaced ?? 0) : Math.round(shownScore).toLocaleString('en-US');
  hud.score.classList.toggle('counting', score - shownScore >= 1);
  const reachable = puzzle && s ? starsFor(puzzle.def, s.wallsPlaced) : -1;
  if (reachable !== shownStars) {
    shownStars = reachable;
    hud.stars.innerHTML = reachable < 0 ? '' : [0, 1, 2].map((i) => `<i${i < reachable ? ' class="on"' : ''}>★</i>`).join('');
    hud.stars.setAttribute('aria-label', reachable < 0 ? '' : `${reachable} stars within reach`);
  }
  hud.unscored.hidden = run?.kind !== 'continue';
  hud.timeChip.hidden = !!s && !s.rules.timeLimit;
  const time = s?.timeLeft ?? 0;
  hud.time.textContent = String(time);
  hud.timeBar.style.width = `${s ? Math.min(100, (100 * time) / s.rules.timeLimit) : 0}%`;
  hud.timeBar.classList.toggle('low', !!s && time <= s.rules.timeWarningAt);
  hud.pause.hidden = mode !== 'playing' && mode !== 'paused';
  // The HUD belongs to a game; the menus (and the demo behind the title) have none.
  hudEl.hidden = mode === 'menu';
  // Offer a new version only between runs, so reloading never throws away a game in progress.
  updateEl.hidden = !updateReady || (mode !== 'menu' && mode !== 'over');
}

// A new deploy is downloaded in the background; the player chooses when to switch to it.
const updateEl = $('update');
let updateReady = false;
let swRegistration: ServiceWorkerRegistration | undefined;
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh: () => (updateReady = true),
  onRegisteredSW: (_url, registration) => {
    swRegistration = registration;
    // Opening the game checks for a new version; also check hourly while it stays open.
    if (registration) setInterval(() => void checkForUpdate(), 60 * 60 * 1000);
  },
});
updateEl.addEventListener('click', (e) => {
  const action = (e.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action;
  if (action === 'update') void updateSW(true);
  else if (action === 'later') updateReady = false;
});

// Dev-only hook for inspecting the running game from the browser console.
if (import.meta.env.DEV) Object.defineProperty(window, 'atomTrap', {
    // `fakeUpdate()` shows the new-version bar, since the dev server has no service worker.
    // `tryLayout('cross')` swaps the current (or a new, unscored) level for that board layout.
    get: () => ({
      run,
      mode,
      layout,
      progress,
      renderer,
      audio,
      haptics,
      applyTheme,
      fakeUpdate: () => (updateReady = true),
      layouts: LAYOUTS.map((l) => l.id),
      // A table per puzzle of your logged attempts, next to its pars.
      puzzleLog: () => {
        const log = localStore.get<PuzzleAttempt[]>('puzzleLog', []);
        console.table(
          PUZZLES.map((p, i) => {
            const mine = log.filter((a) => a.puzzle === i);
            const walls = mine.filter((a) => a.cleared).map((a) => a.walls).sort((a, b) => a - b);
            return {
              puzzle: `${i + 1} ${p.name}`,
              attempts: mine.length,
              cleared: walls.length,
              best: walls[0] ?? null,
              median: walls.length ? walls[Math.floor((walls.length - 1) / 2)] : null,
              par: p.par.join(' / '),
            };
          }),
        );
      },
      tryLayout: (id: string) => {
        if (!run) startRun('continue');
        run!.sim = createLevel({ level: run!.level, speed: prefsStore.speed, layout: id, seed: (Math.random() * 0xffffffff) >>> 0 });
        beginLevel();
      },
    }),
  });

showAttract();
