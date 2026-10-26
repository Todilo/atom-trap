import type { KeyValueStore } from '../shell/storage';
import { LAYOUTS } from '../sim/layouts';
import { createRng } from '../sim/rng';
import { CASUAL, EXPERT, parFromRuns, playPuzzleBot } from './bot';
import { starsFor, type Puzzle } from './puzzles';

/**
 * Daily: one board per day, the same for everyone, played like a puzzle (untimed, three lives, as few
 * walls as you can). The board comes from the date; its par comes from the bot playing it on the
 * device (deterministic, so every device gets the same par). One scored try a day, then practice.
 */

/** Day 1 of the Daily. */
const FIRST_DAY = Date.UTC(2026, 9, 26);
const DAY_MS = 24 * 60 * 60 * 1000;

/** The player's local calendar date as `YYYY-MM-DD`: a new board arrives at local midnight. */
export function dayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The Daily's number, counting from day 1. */
export function dayNumber(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - FIRST_DAY) / DAY_MS) + 1;
}

/** The day before, as a key. */
function previousDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d - 1));
}

/** A seed from the date (FNV-1a over the key), the same on every device. */
function seedFor(key: string): number {
  let h = 0x811c9dc5;
  for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193);
  return h >>> 0;
}

/** The day's board without its par (which the bot works out): a layout or an empty board, 3–5 atoms. */
export function dailyBoard(key: string): Omit<Puzzle, 'par'> {
  const seed = seedFor(key);
  const rng = createRng(seed);
  const layouts = [undefined, ...LAYOUTS.map((l) => l.id)];
  return {
    id: `daily-${key}`,
    name: `Daily #${dayNumber(key)}`,
    layout: layouts[Math.floor(rng() * layouts.length)],
    atoms: 3 + Math.floor(rng() * 3),
    seed,
  };
}

/** Bot games per skill for the day's par: enough to settle the medians, quick enough for a phone. */
export const DAILY_PAR_RUNS = 30;

/**
 * The day's par, from the bot playing the board (ADR-0015). Runs in small slices so the page stays
 * responsive; the result is the same on every device.
 */
export async function dailyPar(board: Omit<Puzzle, 'par'>, runs = DAILY_PAR_RUNS): Promise<[number, number]> {
  const p: Puzzle = { ...board, par: [0, 0] };
  const expert: number[] = [];
  const casual: number[] = [];
  for (let r = 0; r < runs; r++) {
    for (const [options, walls] of [
      [EXPERT, expert],
      [CASUAL, casual],
    ] as const) {
      const result = playPuzzleBot(p, 5000 + r, options);
      if (result.cleared) walls.push(result.walls);
    }
    // Let the page draw between games: on a phone each one takes a few milliseconds.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return parFromRuns(expert, casual);
}

/** One day's scored try. `walls` is null if the board wasn't cleared (lost, or left unfinished). */
export interface DailyResult {
  cleared: boolean;
  walls: number | null;
  par: [number, number];
}

export function dailyStars(result: DailyResult): number {
  if (!result.cleared || result.walls === null) return 0;
  return starsFor({ par: result.par } as Puzzle, result.walls);
}

/** Daily results by day, the streak, and the cached par for today. */
export class DailyProgress {
  constructor(private readonly store: KeyValueStore) {}

  private get all(): Record<string, DailyResult & { finished: boolean }> {
    return this.store.get('daily', {});
  }

  result(key: string): DailyResult | null {
    return this.all[key] ?? null;
  }

  /**
   * Starting the scored try uses it up: it counts as unfinished until `finish`, so leaving halfway
   * can't be used to try again. Returns false if today's try was already used.
   */
  start(key: string, par: [number, number]): boolean {
    const all = this.all;
    if (all[key]) return false;
    this.store.set('daily', { ...all, [key]: { cleared: false, walls: null, par, finished: false } });
    return true;
  }

  /** Records how the scored try ended; later games that day are practice. */
  finish(key: string, cleared: boolean, walls: number): void {
    const all = this.all;
    const entry = all[key];
    if (!entry || entry.finished) return;
    this.store.set('daily', { ...all, [key]: { ...entry, cleared, walls: cleared ? walls : null, finished: true } });
  }

  /** Days in a row with a try, up to today (or up to yesterday while today is still unplayed). */
  streak(today: string): number {
    const all = this.all;
    let day = all[today] ? today : previousDay(today);
    let n = 0;
    while (all[day]) {
      n++;
      day = previousDay(day);
    }
    return n;
  }

  /** The most recent days played, newest first. */
  history(limit = 14): { key: string; result: DailyResult }[] {
    return Object.entries(this.all)
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .slice(0, limit)
      .map(([key, result]) => ({ key, result }));
  }

  /** The par worked out for a day, kept so it's computed once per device and day. */
  cachedPar(key: string): [number, number] | null {
    const cached = this.store.get<{ key: string; par: [number, number] } | null>('dailyPar', null);
    return cached?.key === key ? cached.par : null;
  }

  cachePar(key: string, par: [number, number]): void {
    this.store.set('dailyPar', { key, par });
  }
}

export const SHARE_URL = 'https://todilo.github.io/atom-trap/';

/** The text to paste in a chat: day, stars, walls against par, and the streak. */
export function shareText(key: string, result: DailyResult, streak: number): string {
  const stars = dailyStars(result);
  const outcome = result.cleared ? `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)} · ${result.walls} walls (par ${result.par[0]})` : 'Not cleared';
  return `Atom Trap Daily #${dayNumber(key)}\n${outcome}${streak > 1 ? `\nStreak ${streak}` : ''}\n${SHARE_URL}`;
}
