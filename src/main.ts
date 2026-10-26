import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { PointerInput } from './game/input';
import { cellAt, layoutBoard } from './game/layout';
import { PlainRenderer } from './render/plainRenderer';
import { classicRuleset } from './sim/ruleset';
import { Simulation, type Atom } from './sim/simulation';

// M2 (ADR-0010): one playable Classic level with placeholder graphics. The full game loop comes in M3.
registerSW({ immediate: true });

// Best effort only: browsers allow the orientation lock just in fullscreen / installed mode.
const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
orientation.lock?.('landscape').catch(() => {});

const $ = (id: string) => document.getElementById(id)!;
const hud = { lives: $('hud-lives'), coverage: $('hud-coverage'), score: $('hud-score'), time: $('hud-time') };
const message = $('message');

const host = $('app');
const renderer = await PlainRenderer.create(host);

let sim = newSimulation();
let previous: Atom[] = snapshot(sim);
let accumulator = 0;
let paused = false;

function newSimulation(): Simulation {
  return new Simulation(classicRuleset(1), { seed: (Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0 });
}

function snapshot(s: Simulation): Atom[] {
  return s.atoms.map((a) => ({ ...a }));
}

function restart(): void {
  sim = newSimulation();
  previous = snapshot(sim);
  accumulator = 0;
  input.mouseOrientation = 'vertical';
  showMessage(null);
}

function showMessage(text: string | null): void {
  message.hidden = text === null;
  message.innerHTML = text === null ? '' : `<div>${text}</div>`;
}

// Dev-only hook for inspecting the running simulation from the browser console.
if (import.meta.env.DEV) Object.defineProperty(window, 'atomTrap', { get: () => ({ sim, layout }) });

let layout = layoutBoard(28, 20, 0, 0, 1, 1);
function relayout(): void {
  const { width, height } = host.getBoundingClientRect();
  const pad = 8;
  layout = layoutBoard(sim.rules.cols, sim.rules.rows, pad, pad, width - 2 * pad, height - 2 * pad);
  renderer.setLayout(layout, sim.rules.cols, sim.rules.rows);
}
new ResizeObserver(relayout).observe(host);
relayout();

const input = new PointerInput(renderer.canvas, {
  place(x, y, o) {
    if (paused || sim.status !== 'playing') return;
    const cell = cellAt(layout, sim.rules.cols, sim.rules.rows, x, y);
    if (cell) sim.placeWall(cell.x, cell.y, o);
  },
  tap() {
    if (paused) {
      paused = false;
      showMessage(null);
      return true;
    }
    if (sim.status !== 'playing') {
      restart();
      return true;
    }
    return false;
  },
});

// Auto-pause when the app goes to the background; resume on the player's tap (ADR-0008).
document.addEventListener('visibilitychange', () => {
  if (document.hidden && sim.status === 'playing') {
    paused = true;
    showMessage('Paused<br><small>Tap to resume</small>');
  }
});

renderer.app.ticker.add((ticker) => {
  if (!paused && sim.status === 'playing') {
    accumulator += Math.min(ticker.deltaMS, 250);
    while (accumulator >= sim.rules.stepMs && sim.status === 'playing') {
      previous = snapshot(sim);
      for (const e of sim.step()) {
        if (e.type === 'level-cleared') {
          showMessage(`Level cleared!<br>Bonus ${Math.round(e.bonus.total)} · Score ${Math.round(sim.score)}<br><small>Tap to play again</small>`);
        } else if (e.type === 'game-over') {
          showMessage(`${e.reason === 'time' ? 'Out of time' : 'Game over'}<br>Score ${Math.round(sim.score)}<br><small>Tap to play again</small>`);
        }
      }
      accumulator -= sim.rules.stepMs;
    }
  }
  renderer.draw(sim, previous, sim.status === 'playing' && !paused ? accumulator / sim.rules.stepMs : 1);
  hud.lives.textContent = String(sim.lives);
  hud.coverage.textContent = `${Math.floor(sim.coverage * 100)}%`;
  hud.score.textContent = String(Math.round(sim.score));
  hud.time.textContent = String(sim.timeLeft);
});
