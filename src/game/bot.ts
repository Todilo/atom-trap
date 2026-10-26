import { createRng } from '../sim/rng';
import { CELL_OPEN, type Orientation, type Simulation } from '../sim/simulation';
import { startPuzzle, type Puzzle } from './puzzles';

/**
 * A simple bot that plays the game: it tunes puzzle pars (`npm run tune-puzzles`, ADR-0015) and plays
 * the demo behind the title screen. It waits for each wall to finish, as a patient player would, then
 * tries a handful of random spots, plays each one forward on a copy of the game, and places the wall
 * that removes the most cells without losing a life. A human can't see ahead like that, but also picks
 * spots far better than at random, so its results are a fair first guess at what a good player does.
 */

export interface BotOptions {
  /** Spots tried per wall. */
  candidates: number;
  /** Chance of taking the second-best spot instead of the best, so runs differ. */
  sloppiness: number;
}

/** A strong player: many spots considered, nearly always the best one. */
export const EXPERT: BotOptions = { candidates: 24, sloppiness: 0.25 };
/** A casual player: few spots considered, often not the best. */
export const CASUAL: BotOptions = { candidates: 5, sloppiness: 0.5 };

export interface BotResult {
  cleared: boolean;
  walls: number;
  livesLost: number;
}

/** Steps a lookahead may run while waiting for a wall to finish growing. */
const LOOKAHEAD_STEPS = 80;
/** How many cells one lost life is worth when comparing spots. */
const LIFE_COST = 120;
/** Give up on a run after this many steps (a stuck bot). */
const MAX_STEPS = 50_000;

/** Plays one game a step at a time: call `act` before each `sim.step()`. */
export class BotPlayer {
  private readonly rng: () => number;
  // Players don't click on the very first step; start after a short, random look at the board.
  private wait: number;

  constructor(
    seed: number,
    private readonly options: BotOptions = EXPERT,
  ) {
    this.rng = createRng(seed);
    this.wait = Math.floor(this.rng() * 20);
  }

  act(sim: Simulation): void {
    if (sim.status !== 'playing' || sim.halves.a || sim.halves.b || this.wait-- > 0) return;
    const spot = chooseSpot(sim, this.rng, this.options);
    if (spot) sim.placeWall(spot.x, spot.y, spot.orientation);
    // A short pause before the next decision, like a player's reaction time.
    this.wait = 2 + Math.floor(this.rng() * 6);
  }
}

/** Plays a puzzle to the end. */
export function playPuzzleBot(p: Puzzle, seed: number, options: BotOptions = EXPERT): BotResult {
  const sim = startPuzzle(p);
  const bot = new BotPlayer(seed, options);
  const startLives = sim.lives;
  while (sim.status === 'playing' && sim.steps < MAX_STEPS) {
    bot.act(sim);
    sim.step();
  }
  return { cleared: sim.status === 'cleared', walls: sim.wallsPlaced, livesLost: startLives - sim.lives };
}

function chooseSpot(sim: Simulation, rng: () => number, options: BotOptions): { x: number; y: number; orientation: Orientation } | null {
  const { cols, rows } = sim.rules;
  const scored: { x: number; y: number; orientation: Orientation; value: number }[] = [];
  for (let tries = 0; scored.length < options.candidates && tries < options.candidates * 10; tries++) {
    const x = Math.floor(rng() * cols);
    const y = Math.floor(rng() * rows);
    if (sim.cellAt(x, y) !== CELL_OPEN) continue;
    const orientation: Orientation = rng() < 0.5 ? 'horizontal' : 'vertical';
    const ahead = sim.clone();
    ahead.placeWall(x, y, orientation);
    ahead.step();
    // The spot was taken by an atom (or blocked), so no wall started.
    if (ahead.wallsPlaced === sim.wallsPlaced) continue;
    for (let s = 0; s < LOOKAHEAD_STEPS && ahead.status === 'playing' && (ahead.halves.a || ahead.halves.b); s++) ahead.step();
    let value = ahead.removedCells - sim.removedCells - (sim.lives - ahead.lives) * LIFE_COST;
    if (ahead.status === 'cleared') value += 10_000;
    if (ahead.status === 'over') value -= 10_000;
    scored.push({ x, y, orientation, value });
  }
  if (!scored.length) return null;
  scored.sort((a, b) => b.value - a.value);
  return scored.length > 1 && rng() < options.sloppiness ? scored[1] : scored[0];
}

/** The middle value of cleared runs' wall counts, or NaN if none cleared. */
export function medianWalls(walls: number[]): number {
  const sorted = [...walls].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : NaN;
}

/**
 * Par from bot runs (ADR-0015): three stars at the expert bot's typical result, two at the casual
 * bot's. The bot sees ahead, so its best results would be out of a human's reach.
 */
export function parFromRuns(expertWalls: number[], casualWalls: number[]): [number, number] {
  const three = medianWalls(expertWalls);
  const casual = medianWalls(casualWalls);
  return [three, Math.max(three + 1, Number.isNaN(casual) ? three * 2 : casual)];
}
