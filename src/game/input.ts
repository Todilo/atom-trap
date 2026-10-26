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

const portrait = typeof window === 'undefined' ? null : window.matchMedia('(orientation: portrait)');

/**
 * Screen point → element-local point. In portrait the whole game is drawn turned 90° clockwise
 * (ADR-0013), so the element's x axis runs down the screen and its y axis runs right to left.
 */
export function toLocal(clientX: number, clientY: number, rect: { left: number; top: number; right: number }, rotated: boolean): { x: number; y: number } {
  if (!rotated) return { x: clientX - rect.left, y: clientY - rect.top };
  return { x: clientY - rect.top, y: rect.right - clientX };
}

export interface InputHandlers {
  /** Origin in CSS pixels relative to the element. */
  place(x: number, y: number, orientation: Orientation): void;
  /** Any tap or click, e.g. to dismiss a message. Return true to consume it so no wall is placed. */
  tap?(): boolean;
}

export class PointerInput {
  private orientation: Orientation = 'vertical';
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

  /** The mouse's current wall orientation; each level starts on vertical, as in the original. */
  get mouseOrientation(): Orientation {
    return this.orientation;
  }

  set mouseOrientation(o: Orientation) {
    this.orientation = o;
    this.updateCursor();
  }

  private local(e: PointerEvent): { x: number; y: number } {
    const r = this.el.getBoundingClientRect();
    return toLocal(e.clientX, e.clientY, r, portrait?.matches ?? false);
  }

  private onDown = (e: PointerEvent): void => {
    const p = this.local(e);
    if (e.pointerType === 'mouse') {
      if (e.button === 2) {
        this.mouseOrientation = this.mouseOrientation === 'vertical' ? 'horizontal' : 'vertical';
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

  /** The cursor is a CSS class (see style.css), so nothing else writing the inline cursor can override it. */
  private updateCursor(): void {
    this.el.classList.toggle('cursor-vertical', this.orientation === 'vertical');
    this.el.classList.toggle('cursor-horizontal', this.orientation === 'horizontal');
  }
}
