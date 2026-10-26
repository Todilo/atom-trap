import type { GameEvent } from '../sim/simulation';

/**
 * Short vibrations for the key moments, via the Vibration API (Android browsers and the installed PWA;
 * silently unsupported elsewhere, e.g. iOS and desktops).
 */
const PATTERNS: Partial<Record<GameEvent['type'], number | number[]>> = {
  'wall-completed': 18,
  'wall-broken': [45, 40, 70],
  'level-cleared': [30, 50, 30, 50, 90],
  'game-over': 250,
  'atom-captured': [40, 30, 80],
  'big-catch': [25, 25, 60],
};

export class Haptics {
  constructor(public enabled: boolean) {}

  /** Desktop browsers expose the API too but have nothing to vibrate, so require a touch screen. */
  get supported(): boolean {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false;
    return window.matchMedia('(pointer: coarse)').matches;
  }

  event(e: GameEvent): void {
    const pattern = PATTERNS[e.type];
    if (!this.enabled || !this.supported || pattern === undefined) return;
    try {
      navigator.vibrate(pattern);
    } catch {
      // Some browsers throw when vibration isn't allowed yet (no user gesture); just skip it.
    }
  }
}
