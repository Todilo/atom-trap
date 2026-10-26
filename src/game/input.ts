import type { Orientation } from '../sim/simulation';

/**
 * Turns pointer input into "place wall (origin, orientation)" commands (ADR-0003).
 * Touch/pen: touch the origin, then swipe; the swipe's main axis picks the orientation.
 * Mouse: left-click places with the current orientation, right-click toggles it (as in the original).
 */

/** Minimum swipe distance in CSS pixels before a touch counts as placing a wall. To be tuned on a phone. */
export const SWIPE_THRESHOLD = 18;

export function classifySwipe(dx: number, dy: number, threshold = SWIPE_THRESHOLD): Orientation | null {
  if (Math.hypot(dx, dy) < threshold) return null;
  return Math.abs(dx) >= Math.abs(dy) ? 'horizontal' : 'vertical';
}

export interface InputHandlers {
  /** Origin in CSS pixels relative to the element. */
  place(x: number, y: number, orientation: Orientation): void;
  /** Any tap or click, e.g. to dismiss a message. Return true to consume it so no wall is placed. */
  tap?(): boolean;
}

export class PointerInput {
  /** The mouse's current wall orientation; each level starts on vertical, as in the original. */
  mouseOrientation: Orientation = 'vertical';
  private touches = new Map<number, { x: number; y: number; placed: boolean }>();

  constructor(
    private readonly el: HTMLElement,
    private readonly handlers: InputHandlers,
  ) {
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointercancel', this.onCancel);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    this.updateCursor();
  }

  private local(e: PointerEvent): { x: number; y: number } {
    const r = this.el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private onDown = (e: PointerEvent): void => {
    const p = this.local(e);
    if (e.pointerType === 'mouse') {
      if (e.button === 2) {
        this.mouseOrientation = this.mouseOrientation === 'vertical' ? 'horizontal' : 'vertical';
        this.updateCursor();
      } else if (e.button === 0 && !this.handlers.tap?.()) {
        this.handlers.place(p.x, p.y, this.mouseOrientation);
      }
      return;
    }
    e.preventDefault();
    this.touches.set(e.pointerId, { ...p, placed: false });
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch {
      // Capture is only a convenience (keeps the swipe tracked off-canvas); ignore inactive pointers.
    }
  };

  private onMove = (e: PointerEvent): void => {
    const t = this.touches.get(e.pointerId);
    if (!t || t.placed) return;
    const p = this.local(e);
    const orientation = classifySwipe(p.x - t.x, p.y - t.y);
    if (!orientation) return;
    t.placed = true;
    this.handlers.place(t.x, t.y, orientation);
  };

  private onUp = (e: PointerEvent): void => {
    const t = this.touches.get(e.pointerId);
    this.touches.delete(e.pointerId);
    if (t && !t.placed) this.handlers.tap?.();
  };

  private onCancel = (e: PointerEvent): void => {
    this.touches.delete(e.pointerId);
  };

  private updateCursor(): void {
    this.el.style.cursor = this.mouseOrientation === 'vertical' ? 'ns-resize' : 'ew-resize';
  }
}
