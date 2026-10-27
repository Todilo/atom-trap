import type { ShellMode } from './play';

/** What the keyboard can do; the shell decides what each means right now. */
export interface KeyActions {
  mode(): ShellMode;
  pause(): void;
  resume(): void;
  turnWall(): void;
  /** Restarts a puzzle or Daily practice; returns false where there's nothing to restart. */
  restart(): boolean;
  /** Presses the result dialog's main button (next level or puzzle); false if there's none. */
  continueResult(): boolean;
  /** Any key on the attract screen brings up the menu. */
  wake(): boolean;
}

/**
 * Keyboard shortcuts for desktop: Esc or P pauses and resumes, Space turns the next wall, R restarts
 * a puzzle (not a scored Daily try), Enter continues from a result. Ignored while typing a name.
 */
export function listenToKeys(a: KeyActions): void {
  window.addEventListener('keydown', (e) => {
    if (a.wake()) return;
    const typing = e.target instanceof Element && e.target.closest('input, textarea');
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    const key = e.key.toLowerCase();
    const mode = a.mode();
    if ((key === 'escape' || key === 'p') && (mode === 'playing' || mode === 'paused')) {
      e.preventDefault();
      return mode === 'paused' ? a.resume() : a.pause();
    }
    if (key === ' ' && mode === 'playing') {
      e.preventDefault();
      return a.turnWall();
    }
    if (key === 'r' && a.restart()) return e.preventDefault();
    if (key === 'enter' && mode === 'cleared' && a.continueResult()) e.preventDefault();
  });
}
