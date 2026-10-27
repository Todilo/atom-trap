import type { NeonRenderer } from '../render/neonRenderer';
import type { GameEvent, Simulation } from '../sim/simulation';

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

/** How much a catch matters, 0 to 1: a thin wall (~100 points) is light, 5,000 points or more is the top. */
const weight = (points: number) => Math.log10(Math.max(points, 100) / 100) / Math.log10(50);

/** Arcade feedback (ADR-0018): points rising where cells filled, implosions, and shakes. */
export class ArcadeFeedback {
  private lastFill = { x: 0, y: 0 };

  constructor(private readonly renderer: NeonRenderer) {}

  event(s: Simulation, e: GameEvent): void {
    if (e.type === 'cells-removed') {
      this.lastFill = { x: e.x, y: e.y };
      this.renderer.popup(`+${fmt(e.points)}${s.chainMultiplier > 1 ? ` ×${s.chainMultiplier}` : ''}`, e.x, e.y, weight(e.points));
    } else if (e.type === 'atom-captured') {
      this.renderer.implode(e.x, e.y);
      this.renderer.popup(`Captured +${fmt(e.points)}`, e.x, e.y - 1, 1);
    } else if (e.type === 'big-catch') {
      this.renderer.popup('Big catch ×2', this.lastFill.x, this.lastFill.y + 1.5, 0.8);
      this.renderer.shake(0.3);
    }
  }
}

/** Counts each `[data-count]` number in `root` up from zero (result dialogs). */
export function countUp(root: HTMLElement): void {
  for (const el of root.querySelectorAll<HTMLElement>('[data-count]')) {
    const to = Number(el.dataset.count);
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / 900);
      el.textContent = fmt(to * (1 - (1 - k) ** 3));
      if (k < 1 && el.isConnected) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}
