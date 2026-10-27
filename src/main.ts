import '@fontsource/chakra-petch/latin-500.css';
import '@fontsource/chakra-petch/latin-600.css';
import '@fontsource/chakra-petch/latin-700.css';
import './style.css';
import { dailyBoard, dayKey, dayNumber, shareText } from './game/daily';
import { PointerInput } from './game/input';
import { layoutBoard, wallOriginAt } from './game/layout';
import { modeById, type GameModeId } from './game/modes';
import { PUZZLES, startPuzzle, starsFor, type Puzzle } from './game/puzzles';
import { Run, type RunKind, type RunMode } from './game/run';
import { AtomPreview } from './render/atomPreview';
import { NeonRenderer, snapshot, type Snapshot } from './render/neonRenderer';
import { ATOM_STYLES, atomStyleById, cssVariables, themeById, type AtomStyle, type Theme } from './render/themes';
import { AudioEngine, type AudioSettings } from './shell/audio';
import { Demo } from './shell/demo';
import { ArcadeFeedback, countUp } from './shell/feedback';
import { Haptics } from './shell/haptics';
import { watchTurn } from './shell/turn';
import { Hud } from './shell/hud';
import { Install } from './shell/install';
import { listenToKeys } from './shell/keyboard';
import type { PuzzlePlay, ShellMode } from './shell/play';
import { logPuzzleAttempt, printPuzzleLog } from './shell/puzzleLog';
import { Records } from './shell/records';
import {
  achievementsScreen,
  arcadeClearedBanner,
  ATOM_PAGE_SIZE,
  attractScreen,
  dailyResultScreen,
  gameOverScreen,
  highScoresScreen,
  introScreen,
  levelClearedScreen,
  pauseScreen,
  puzzleClearedScreen,
  puzzleFailedScreen,
  puzzlesScreen,
  settingsScreen,
  titleScreen,
  type IntroMode,
  type Prefs,
} from './shell/screens';
import type { Achievement } from './game/achievements';
import { localStore } from './shell/storage';
import { Updates } from './shell/updates';
import { LAYOUTS } from './sim/layouts';
import { createLevel } from './sim/levels';
import type { ClassicSpeed } from './sim/ruleset';
import type { GameEvent, Simulation } from './sim/simulation';

/*
 * The shell: menus and screens, starting and ending games in each mode (ADR-0014), and the frame
 * loop that steps the simulation (ADR-0005) and draws it (ADR-0004). The parts with a job of their
 * own live in src/shell/: the HUD, records, updates, install, the demo, feedback and keys.
 */

// Best effort only: browsers allow the orientation lock just in fullscreen / installed mode.
const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
orientation.lock?.('landscape').catch(() => {});
watchTurn();

const screenEl = document.getElementById('screen')!;
const host = document.getElementById('app')!;

// ---- Look, sound and preferences ----

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

const audio = new AudioEngine({ music: true, sfx: true, musicVolume: 1, sfxVolume: 1, ...localStore.get<Partial<AudioSettings>>('audio', {}) });
const saveAudio = () => localStore.set('audio', audio.settings);
// Audio unlock: browsers only allow sound after a user gesture, so start it on the first tap or click.
window.addEventListener('pointerdown', () => audio.unlock(), { capture: true });

const prefsStore = {
  haptics: true,
  speed: 'fast' as ClassicSpeed,
  mode: 'classic' as GameModeId,
  // Calmer effects: no shake, demo or pop-ins. On by default when the device asks for reduced motion.
  reduceMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  ...localStore.get<{ haptics?: boolean; speed?: ClassicSpeed; mode?: GameModeId; reduceMotion?: boolean }>('prefs', {}),
};
const haptics = new Haptics(prefsStore.haptics);
const savePrefs = () =>
  localStore.set('prefs', { haptics: haptics.enabled, speed: prefsStore.speed, mode: prefsStore.mode, reduceMotion: prefsStore.reduceMotion });
const prefs = (): Prefs => ({
  ...audio.settings,
  haptics: haptics.enabled,
  speed: prefsStore.speed,
  theme: theme.id,
  atomStyle,
  mode: prefsStore.mode,
  reduceMotion: prefsStore.reduceMotion,
});
const motionReduced = () => prefsStore.reduceMotion;

/** Applies Reduce motion to the effects and to the page's CSS animations. */
function applyMotion(): void {
  renderer.setReducedMotion(prefsStore.reduceMotion);
  document.documentElement.classList.toggle('reduce-motion', prefsStore.reduceMotion);
}
applyMotion();

// ---- State ----

let mode: ShellMode = 'menu';
/** The Classic or Arcade run in progress, if any; at most one of `run` and `puzzle` is set. */
let run: Run | null = null;
let puzzle: PuzzlePlay | null = null;
/** The game being played (the attract demo is separate). */
const sim = (): Simulation | null => run?.sim ?? puzzle?.sim ?? null;
/** The simulation before its latest step, for drawing smoothly between steps. */
let previous: Snapshot = { atoms: [], halves: { a: null, b: null } };
let accumulator = 0;
/** The game-over screen's state, so it can be redrawn after the name is saved. */
let gameOver: { reason: 'lives' | 'time' | 'walls'; rank: number | null; savedName: string | null } | null = null;

const records = new Records(localStore, () => redrawTitle());
const hud = new Hud();
const updates = new Updates(document.getElementById('update')!, () => redraw?.());
const installer = new Install(() => redrawTitle());
const arcadeFeedback = new ArcadeFeedback(renderer);

// ---- Screens ----

/** Redraws the screen on show, for switches and tabs that change it in place. */
let redraw: (() => void) | null = null;
const redrawTitle = () => screenEl.querySelector('.page.title') && redraw?.();

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

const hintEl = document.getElementById('hint')!;
const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
hintEl.classList.add(coarsePointer ? 'touch' : 'mouse');
document.getElementById('hint-text')!.innerHTML = coarsePointer
  ? 'Touch where a wall should start, then swipe:<br>sideways for horizontal, up or down for vertical.<br><small>The atoms wait for your first wall.</small>'
  : 'Click to build a wall. Right-click turns it<br>between vertical and horizontal.<br><small>The atoms wait for your first wall.</small>';
/** While the first-play hint shows, the level waits for the player's first wall. */
let hintActive = false;

function setHint(show: boolean): void {
  hintActive = show;
  hintEl.hidden = !show;
}

/** The attract demo, while the attract screen shows (ADR-0017). */
let demo: Demo | null = null;
const demoShowing = () => mode === 'menu' && !run && !puzzle && screenEl.classList.contains('attract-screen');
/** Back to the demo after this long on the title screen without any input. */
const ATTRACT_AFTER_MS = 20_000;
let lastInput = performance.now();
for (const type of ['pointerdown', 'pointermove', 'keydown'] as const) window.addEventListener(type, () => (lastInput = performance.now()), { capture: true });

function showAttract(): void {
  if (motionReduced()) return showMenu();
  mode = 'menu';
  run = null;
  puzzle = null;
  setHint(false);
  demo = null;
  showScreen(attractScreen(coarsePointer), 'attract-screen');
}

function showMenu(): void {
  mode = 'menu';
  setHint(false);
  void updates.check().catch(() => {});
  const draw = () => showScreen(titleScreen(prefs(), records.scoreTables(), records.puzzleSummary(), records.dailySummary(), installer.available), 'page', draw);
  draw();
}

function showScores(tab: GameModeId): void {
  const draw = () => showScreen(highScoresScreen(records.scoreTables(), tab, records.puzzleSummary(), records.dailySummary()), 'page', draw);
  draw();
}

function showAchievements(): void {
  showScreen(achievementsScreen(records.achievements.list(records.achievementView())), 'page');
}

function showPuzzles(): void {
  mode = 'menu';
  run = null;
  puzzle = null;
  setHint(false);
  showScreen(puzzlesScreen(records.puzzleSummary()), 'page');
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
    const update = { version: import.meta.env.VITE_APP_VERSION ?? 'local build', status: updates.status };
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

function showGameOver(): void {
  const g = gameOver!;
  showScreen(gameOverScreen(g.reason, run!.score, run!.level, run!.kind === 'scored', g.rank, records.classic.playerName, g.savedName));
}

function saveName(): void {
  if (!gameOver?.rank) return;
  const value = (document.getElementById('name-input') as HTMLInputElement | null)?.value ?? '';
  const table = records.progressFor(run!.mode);
  table.nameScore(gameOver.rank, value);
  gameOver.savedName = table.highScores[gameOver.rank - 1]?.name ?? '';
  showGameOver();
}

// ---- Starting and playing games ----

/** A game waiting for the player to read its mode's intro. */
let afterIntro: (() => void) | null = null;
const introSeen = (m: IntroMode) => !!localStore.get<Partial<Record<IntroMode, boolean>>>('introSeen', {})[m];

/** The first game of Puzzle, Daily or Arcade starts with a short explanation of the mode. */
function withIntro(m: IntroMode, start: () => void): void {
  afterIntro = () => {
    localStore.set('introSeen', { ...localStore.get('introSeen', {}), [m]: true });
    start();
  };
  showScreen(introScreen(m), 'dialog');
}

/** Starts a Classic or Arcade run, as selected on the title screen (Arcade plays at Fast). */
function startRun(kind: RunKind): void {
  const runMode: RunMode = prefsStore.mode === 'arcade' ? 'arcade' : 'classic';
  if (runMode === 'arcade' && mode === 'menu' && !introSeen('arcade')) return withIntro('arcade', () => startRun(kind));
  puzzle = null;
  run = new Run(kind, records.progressFor(runMode), runMode === 'arcade' ? 'fast' : prefsStore.speed);
  beginLevel();
}

function playPuzzle(index: number): void {
  if (!records.puzzles.unlocked(index) || !PUZZLES[index]) return;
  if (!introSeen('puzzle')) return withIntro('puzzle', () => playPuzzle(index));
  run = null;
  puzzle = { def: PUZZLES[index], index, daily: null, sim: startPuzzle(PUZZLES[index]) };
  beginLevel();
}

/** Today's Daily: the scored try if it's still unused, otherwise practice. */
function playDaily(practice: boolean): void {
  const key = dayKey(new Date());
  const par = records.parFor(key);
  if (!par) return;
  // Before the try is used up, so reading about it doesn't cost it.
  if (!introSeen('daily')) return withIntro('daily', () => playDaily(practice));
  const def: Puzzle = { ...dailyBoard(key), par };
  const scored = !practice && records.daily.start(key, def.par);
  run = null;
  puzzle = { def, index: null, daily: { key, scored }, sim: startPuzzle(def) };
  beginLevel();
}

async function shareDaily(button: HTMLElement): Promise<void> {
  const key = dayKey(new Date());
  const result = records.daily.result(key);
  if (!result) return;
  const text = shareText(key, result, records.daily.streak(key));
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
  // Stats for achievements: how far runs get.
  if (run?.mode === 'arcade') records.achievements.record({ best: { bestArcadeBoard: run.level } });
  else if (run) records.achievements.record({ best: { bestClassicLevel: run.level } });
  capturesOnBoard = 0;
  trappedThisLevel.clear();
  previous = snapshot(sim()!);
  accumulator = 0;
  input.mouseOrientation = 'vertical';
  mode = 'playing';
  showScreen(null);
  if (!localStore.get('hintSeen', false)) setHint(true);
}

function nextLevel(): void {
  run!.nextLevel();
  beginLevel();
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

/** Restarts a puzzle or Daily practice (never a scored Daily try). */
function restartPuzzle(): boolean {
  if (!puzzle || mode === 'menu' || puzzle.daily?.scored) return false;
  if (puzzle.daily) playDaily(true);
  else playPuzzle(puzzle.index!);
  return true;
}

// ---- Input ----

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
      restartPuzzle();
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
      return redraw?.();
    case 'speed':
      prefsStore.speed = arg === 'slow' ? 'slow' : 'fast';
      savePrefs();
      return redraw?.();
    case 'scores':
      return showScores(arg ? modeById(arg).id : 'classic');
    case 'achievements':
      return showAchievements();
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
      return redraw?.();
    case 'theme':
      applyTheme(themeById(arg));
      localStore.set('theme', theme.id);
      return redraw?.();
    case 'check-update':
      return void updates.checkNow();
    case 'apply-update':
      return updates.apply();
    case 'show-hint':
      localStore.set('hintSeen', false);
      localStore.set('introSeen', {});
      (e.target as HTMLElement).closest('button')!.textContent = 'Tutorials show again on your next games';
      return;
    case 'install':
      return void installer.install();
    case 'intro-ok': {
      const start = afterIntro;
      afterIntro = null;
      return start?.();
    }
    case 'menu':
      return showMenu();
    case 'resume':
      return resume();
    case 'toggle-music':
      audio.setMusic(!audio.settings.music);
      saveAudio();
      return redraw?.();
    case 'toggle-sfx':
      audio.setSfx(!audio.settings.sfx);
      saveAudio();
      return redraw?.();
    case 'toggle-motion':
      prefsStore.reduceMotion = !prefsStore.reduceMotion;
      savePrefs();
      applyMotion();
      return redraw?.();
    case 'toggle-haptics':
      haptics.enabled = !haptics.enabled;
      savePrefs();
      haptics.event({ type: 'wall-completed', slot: 'a' });
      return redraw?.();
    case 'save-name':
      return saveName();
    case 'quit':
      run = null;
      puzzle = null;
      setHint(false);
      return showMenu();
  }
});

// Volume sliders in Settings: heard while dragging, saved when let go.
screenEl.addEventListener('input', (e) => {
  const slider = e.target as HTMLInputElement;
  const v = Number(slider.value) / 100;
  if (slider.dataset.volume === 'music') audio.setMusicVolume(v);
  else if (slider.dataset.volume === 'sfx') audio.setSfxVolume(v);
});
screenEl.addEventListener('change', (e) => {
  const slider = e.target as HTMLInputElement;
  if (!slider.dataset.volume) return;
  saveAudio();
  // A sample of the effects at the new volume.
  if (slider.dataset.volume === 'sfx') audio.event({ type: 'wall-completed', slot: 'a' });
});

// Enter in the name field saves too.
screenEl.addEventListener('submit', (e) => {
  e.preventDefault();
  saveName();
});

listenToKeys({
  mode: () => mode,
  pause,
  resume,
  turnWall: () => (input.mouseOrientation = input.mouseOrientation === 'vertical' ? 'horizontal' : 'vertical'),
  restart: restartPuzzle,
  continueResult: () => {
    // A Daily's main button would share, so not that one.
    const next = puzzle?.daily ? null : screenEl.querySelector<HTMLElement>('.dialog .primary');
    next?.click();
    return !!next;
  },
  wake: () => {
    if (!demoShowing()) return false;
    showMenu();
    return true;
  },
});

hud.pause.addEventListener('click', () => (mode === 'paused' ? resume() : pause()));

let layout = layoutBoard(28, 20, 0, 0, 1, 1);
function relayout(): void {
  // Layout size, not the on-screen box: in portrait the stage is drawn rotated (ADR-0013).
  const pad = 8;
  layout = layoutBoard(28, 20, pad, pad, host.clientWidth - 2 * pad, host.clientHeight - 2 * pad);
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
    void updates.check().catch(() => {});
  }
});

// ---- Game events and results ----

/**
 * A cleared board gets a moment of its own before the result: the board flashes and sparks fly,
 * then the dialog opens with its stars popping in and its totals counting up. Reduce motion skips it.
 */
function celebrate(show: () => void): void {
  const done = () => {
    show();
    if (!motionReduced()) countUp(screenEl);
  };
  if (motionReduced()) return done();
  renderer.celebrate();
  const s = sim();
  setTimeout(() => {
    if (sim() === s && mode === 'cleared') done();
  }, 800);
}

/** Atoms captured on the current Arcade board (for Hat trick). */
let capturesOnBoard = 0;
/** Classic atoms already counted as trapped on this level (for Atom trap), so each counts once. */
const trappedThisLevel = new Set<number>();

/** Keeps the lifetime stats achievements count from (src/game/achievements.ts). */
function trackStats(s: Simulation, events: GameEvent[]): void {
  const t = records.achievements;
  if (events.some((e) => e.type === 'wall-started')) t.record({ add: { wallsPlaced: 1 } });
  for (const e of events) {
    if (e.type === 'atom-captured') {
      capturesOnBoard++;
      t.record({ add: { atomsCaptured: 1 }, best: { bestCapturesOnBoard: capturesOnBoard } });
    } else if (e.type === 'cells-removed' && run?.mode === 'classic') {
      // A wall completed: is any atom now walled in so tightly it can't move?
      s.atoms.forEach((_, i) => {
        if (trappedThisLevel.has(i) || !s.atomStuck(i)) return;
        trappedThisLevel.add(i);
        t.record({ add: { classicTraps: 1 } });
      });
    } else if (e.type === 'chain') {
      t.record({ best: { bestChain: s.chainMultiplier } });
    } else if (e.type === 'level-cleared' && run?.mode === 'arcade' && s.liveAtoms === 0) {
      t.record({ add: { cleanSweeps: 1 } });
    } else if ((e.type === 'level-cleared' || e.type === 'game-over') && run?.mode === 'classic' && run.kind === 'scored') {
      t.record({ best: { bestClassicScore: Math.round(run.score) } });
    }
  }
}

/** Unlocks newly earned achievements and announces them, one notice at a time. */
const toastEl = document.getElementById('toast')!;
const toastQueue: Achievement[] = [];
function checkAchievements(): void {
  const fresh = records.achievements.check(records.achievementView());
  if (!fresh.length) return;
  const idle = toastQueue.length === 0;
  toastQueue.push(...fresh);
  if (idle) nextToast();
}
function nextToast(): void {
  const a = toastQueue[0];
  if (!a) {
    toastEl.hidden = true;
    return;
  }
  toastEl.innerHTML = `<span class="toast-kicker">Achievement unlocked</span><b>${a.name}</b><span class="dim">${a.description}</span>`;
  toastEl.hidden = false;
  audio.chime();
  setTimeout(() => {
    toastQueue.shift();
    nextToast();
  }, 5000);
}

function handleStepEvents(s: Simulation): void {
  const events = s.step();
  if (events.length) {
    trackStats(s, events);
    // After this step's results are saved (puzzle bests, Daily tries), below.
    queueMicrotask(checkAchievements);
  }
  for (const e of events) {
    audio.event(e);
    haptics.event(e);
    if (run?.mode === 'arcade') arcadeFeedback.event(s, e);
    if (puzzle?.daily && (e.type === 'level-cleared' || e.type === 'game-over')) {
      const cleared = e.type === 'level-cleared';
      mode = cleared ? 'cleared' : 'over';
      const { key, scored } = puzzle.daily;
      if (scored) records.daily.finish(key, cleared, s.wallsPlaced);
      const result = dailyResultScreen({ number: dayNumber(key), cleared, walls: s.wallsPlaced, par: puzzle.def.par, scored, streak: records.daily.streak(key) });
      if (cleared) celebrate(() => showScreen(result));
      else showScreen(result);
    } else if (puzzle?.index != null && e.type === 'level-cleared') {
      mode = 'cleared';
      logPuzzleAttempt(localStore, puzzle.index, s, true);
      const stars = starsFor(puzzle.def, s.wallsPlaced);
      const improved = records.puzzles.record(puzzle.index, s.wallsPlaced);
      const best = records.puzzles.bestWalls[puzzle.index] ?? s.wallsPlaced;
      const result = puzzleClearedScreen({ index: puzzle.index, stars, improved, wallsUsed: s.wallsPlaced, best, hasNext: puzzle.index + 1 < PUZZLES.length });
      celebrate(() => showScreen(result));
    } else if (puzzle?.index != null && e.type === 'game-over') {
      logPuzzleAttempt(localStore, puzzle.index, s, false);
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
      const result = levelClearedScreen({
        mode: modeById(prefsStore.mode).name,
        level: run!.level,
        coverage: Math.floor(s.coverage * 100),
        livesLeft: s.lives,
        bonus: e.bonus,
        levelScore: s.score,
        total: run!.score,
        scored: run!.kind === 'scored',
      });
      celebrate(() => showScreen(result));
    } else if (e.type === 'game-over') {
      mode = 'over';
      gameOver = { reason: e.reason, rank: run!.finish(), savedName: null };
      showGameOver();
    }
  }
}

// ---- Frame loop ----

renderer.app.ticker.add((ticker) => {
  if (demoShowing()) {
    demo ??= new Demo();
    // Step first: a step (or a new board) replaces `sim` and `previous`, which the draw must then use.
    const stepPart = demo.tick(ticker.deltaMS);
    renderer.draw(demo.sim, demo.previous, stepPart);
    return finishFrame(null, 0);
  }
  // A title screen left alone goes back to the demo.
  if (mode === 'menu' && !motionReduced() && screenEl.querySelector('.page.title') && performance.now() - lastInput > ATTRACT_AFTER_MS) {
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
  finishFrame(s, mode === 'playing' && s ? (s.halves.a?.cells.length ?? 0) + (s.halves.b?.cells.length ?? 0) : 0);
});

/** The HUD, the update bar and the wall hum, every frame. */
function finishFrame(s: Simulation | null, growing: number): void {
  hud.update(mode, { run, puzzle }, s, s ? accumulator / s.rules.stepMs : 0, records.classic.highestLevel);
  // Offer a new version only between games, so reloading never throws one away.
  updates.showBar(mode === 'menu' || mode === 'over');
  audio.setGrowing(growing);
}

// Dev-only hook for inspecting the running game from the browser console.
if (import.meta.env.DEV) {
  Object.defineProperty(window, 'atomTrap', {
    // `fakeUpdate()` shows the new-version bar, since the dev server has no service worker.
    // `tryLayout('cross')` swaps the current (or a new, unscored) level for that board layout.
    // `puzzleLog()` prints your logged puzzle attempts next to the pars.
    get: () => ({
      run,
      mode,
      layout,
      records,
      renderer,
      audio,
      haptics,
      applyTheme,
      fakeUpdate: () => (updates.ready = true),
      layouts: LAYOUTS.map((l) => l.id),
      puzzleLog: () => printPuzzleLog(localStore),
      tryLayout: (id: string) => {
        if (!run) startRun('continue');
        run!.sim = createLevel({ level: run!.level, speed: prefsStore.speed, layout: id, seed: (Math.random() * 0xffffffff) >>> 0 });
        beginLevel();
      },
    }),
  });
}

// Achievements earned before they existed (or on another version) unlock quietly at start.
records.achievements.check(records.achievementView());

showAttract();
