import { Application, Graphics } from 'pixi.js';
import type { BoardLayout } from '../game/layout';
import { CELL_GROWING_A, CELL_GROWING_B, CELL_REMOVED, type Atom, type Simulation } from '../sim/simulation';

/**
 * M2 placeholder renderer (ADR-0010): flat shapes only. It reads simulation state and never changes it
 * (ADR-0005). The neon look replaces this in M4.
 */
const COLORS = {
  background: 0x05060f,
  board: 0x0b0e22,
  grid: 0x18203f,
  edge: 0x3ee8ff,
  removed: 0x1d2c55,
  growingA: 0x3ee8ff,
  growingB: 0x8af3ff,
  atom: 0xff40c8,
  atomCore: 0xffffff,
};

export class PlainRenderer {
  private readonly board = new Graphics();
  private readonly grid = new Graphics();
  private readonly atoms = new Graphics();
  private layout: BoardLayout | null = null;

  private constructor(readonly app: Application) {
    app.stage.addChild(this.board, this.grid, this.atoms);
  }

  static async create(host: HTMLElement): Promise<PlainRenderer> {
    const app = new Application();
    await app.init({
      resizeTo: host,
      background: COLORS.background,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });
    host.appendChild(app.canvas);
    return new PlainRenderer(app);
  }

  get canvas(): HTMLCanvasElement {
    return this.app.canvas;
  }

  setLayout(layout: BoardLayout, cols: number, rows: number): void {
    this.layout = layout;
    const g = this.grid.clear();
    for (let x = 1; x < cols; x++) g.moveTo(layout.x + x * layout.cellW, layout.y).lineTo(layout.x + x * layout.cellW, layout.y + layout.height);
    for (let y = 1; y < rows; y++) g.moveTo(layout.x, layout.y + y * layout.cellH).lineTo(layout.x + layout.width, layout.y + y * layout.cellH);
    g.stroke({ width: 1, color: COLORS.grid });
    g.rect(layout.x, layout.y, layout.width, layout.height).stroke({ width: 2, color: COLORS.edge });
  }

  /** `alpha` (0..1) interpolates atoms from their previous to their current cell. */
  draw(sim: Simulation, previous: Atom[], alpha: number): void {
    const l = this.layout;
    if (!l) return;
    const { cols, rows } = sim.rules;

    const b = this.board.clear();
    b.rect(l.x, l.y, l.width, l.height).fill(COLORS.board);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const c = sim.cellAt(x, y);
        if (c === CELL_REMOVED) b.rect(l.x + x * l.cellW, l.y + y * l.cellH, l.cellW + 0.5, l.cellH + 0.5).fill(COLORS.removed);
        else if (c === CELL_GROWING_A || c === CELL_GROWING_B) {
          b.rect(l.x + x * l.cellW + 1, l.y + y * l.cellH + 1, l.cellW - 2, l.cellH - 2).fill(c === CELL_GROWING_A ? COLORS.growingA : COLORS.growingB);
        }
      }
    }

    const a = this.atoms.clear();
    const r = Math.min(l.cellW, l.cellH) * 0.48;
    sim.atoms.forEach((atom, i) => {
      const p = previous[i] ?? atom;
      const cx = l.x + (p.x + (atom.x - p.x) * alpha + 0.5) * l.cellW;
      const cy = l.y + (p.y + (atom.y - p.y) * alpha + 0.5) * l.cellH;
      a.circle(cx, cy, r).fill(COLORS.atom);
      a.circle(cx - r * 0.25, cy - r * 0.25, r * 0.35).fill(COLORS.atomCore);
    });
  }
}
