import { BotPlayer } from '../game/bot';
import { snapshot, type Snapshot } from '../render/neonRenderer';
import { LAYOUTS } from '../sim/layouts';
import { createLevel } from '../sim/levels';
import type { Simulation } from '../sim/simulation';

/** A lighter bot than the tuner's, so its look-ahead never makes a frame stutter on a phone. */
const DEMO_BOT = { candidates: 10, sloppiness: 0.3 };
/** How long a finished board stays before the next one. */
const PAUSE_MS = 2000;

/**
 * The demo on the attract screen (ADR-0017): the bot (src/game/bot.ts) plays a Classic board,
 * sometimes on a layout, like the original's demo, and starts a new one after each board ends.
 * It keeps its own step timing, so it never touches the game's.
 */
export class Demo {
  sim: Simulation;
  previous: Snapshot;
  private bot: BotPlayer;
  private accumulator = 0;
  private endedAt: number | null = null;

  constructor() {
    [this.sim, this.bot] = Demo.board();
    this.previous = snapshot(this.sim);
  }

  /** Advances by a frame's time; returns how far into the current step it is, for drawing. */
  tick(deltaMS: number): number {
    if (this.endedAt !== null && performance.now() - this.endedAt > PAUSE_MS) {
      [this.sim, this.bot] = Demo.board();
      this.previous = snapshot(this.sim);
      this.accumulator = 0;
      this.endedAt = null;
    }
    const s = this.sim;
    if (s.status !== 'playing') return 1;
    this.accumulator += Math.min(deltaMS, 250);
    while (this.accumulator >= s.rules.stepMs && s.status === 'playing') {
      this.previous = snapshot(s);
      this.bot.act(s);
      s.step();
      this.accumulator -= s.rules.stepMs;
    }
    if (s.status !== 'playing') this.endedAt = performance.now();
    return s.status === 'playing' ? this.accumulator / s.rules.stepMs : 1;
  }

  private static board(): [Simulation, BotPlayer] {
    const seed = (Math.random() * 0xffffffff) >>> 0;
    // Half the demos show off a layout.
    const layout = Math.random() < 0.5 ? LAYOUTS[Math.floor(Math.random() * LAYOUTS.length)].id : undefined;
    const sim = createLevel({ level: 2 + Math.floor(Math.random() * 3), layout, seed });
    return [sim, new BotPlayer(seed, DEMO_BOT)];
  }
}
