import { Application, Container, Graphics, Texture } from 'pixi.js';
import { AtomPainter, glowTexture } from './atomPainter';
import type { AtomStyle, Theme } from './themes';

/**
 * Live atom previews for Settings, drawn by the same AtomPainter as the board. One small offscreen
 * Pixi app draws every tile side by side, and each tile's own canvas copies its part, so the previews
 * cost a single extra WebGL context however many tiles show.
 */

/** A tile's drawing size in CSS pixels; its canvas is scaled to fit the tile. */
const TILE_W = 180;
const TILE_H = 84;
/** A board cell on a large screen, with the original's 4:3 cells: big enough to see the style. */
const CELL_H = 28;
const CELL_W = (CELL_H * 16) / 12;
/** Slower than the game's one cell per step, so the look is easy to see. */
const SPEED = 70;

interface Tile {
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  painter: AtomPainter;
  style: AtomStyle;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export class AtomPreview {
  private readonly glow: Texture = glowTexture();
  private readonly scene = new Container();
  private tiles: Tile[] = [];
  private frame = 0;
  private last = 0;
  private readonly resolution = Math.min(window.devicePixelRatio || 1, 2);

  private constructor(private readonly app: Application) {
    app.stage.addChild(this.scene);
  }

  static async create(): Promise<AtomPreview> {
    const app = new Application();
    await app.init({
      width: TILE_W,
      height: TILE_H,
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoStart: false,
      eventFeatures: { move: false, globalMove: false, click: false, wheel: false },
    });
    return new AtomPreview(app);
  }

  /** Starts animating these canvases, each showing one style; replaces any earlier tiles. */
  attach(targets: { canvas: HTMLCanvasElement; style: AtomStyle }[], theme: Theme): void {
    // A style still on screen carries on from where it was (e.g. after a theme change), instead of jumping.
    const was = new Map(this.tiles.map((t) => [t.style, t]));
    this.detach();
    if (!targets.length) return;
    this.app.renderer.resize(TILE_W * targets.length, TILE_H);
    targets.forEach(({ canvas, style }, k) => {
      canvas.width = TILE_W * this.resolution;
      canvas.height = TILE_H * this.resolution;
      const tile = new Container();
      tile.x = k * TILE_W;
      const board = new Graphics().rect(0, 0, TILE_W, TILE_H).fill(theme.board);
      for (let x = CELL_W; x < TILE_W; x += CELL_W) board.moveTo(x, 0).lineTo(x, TILE_H);
      for (let y = CELL_H; y < TILE_H; y += CELL_H) board.moveTo(0, y).lineTo(TILE_W, y);
      board.stroke({ width: 1, color: theme.grid });
      const painter = new AtomPainter(this.glow, theme, style);
      painter.setCount(1);
      tile.addChild(board, painter.view);
      this.scene.addChild(tile);
      // Different starting points and directions, so the tiles don't move in step.
      const dir = k % 2 ? 1 : -1;
      const motion = was.get(style) ?? { x: 40 + k * 37, y: 30 + k * 11, vx: SPEED * dir, vy: SPEED * 0.8 };
      const { x, y, vx, vy } = motion;
      this.tiles.push({ ctx: canvas.getContext('2d')!, canvas, painter, style, x, y, vx, vy });
    });
    this.last = performance.now();
    this.frame = requestAnimationFrame(this.tick);
  }

  detach(): void {
    cancelAnimationFrame(this.frame);
    for (const child of this.scene.removeChildren()) child.destroy({ children: true });
    this.tiles = [];
  }

  private tick = (now: number): void => {
    // Stop once the tiles have left the page (another screen replaced Settings).
    if (!this.tiles.every((t) => t.canvas.isConnected)) return this.detach();
    const dt = Math.min(now - this.last, 100) / 1000;
    this.last = now;
    const r = CELL_H / 2;
    for (const t of this.tiles) {
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      if (t.x < r || t.x > TILE_W - r) t.vx = -t.vx;
      if (t.y < r || t.y > TILE_H - r) t.vy = -t.vy;
      t.x = Math.min(Math.max(t.x, r), TILE_W - r);
      t.y = Math.min(Math.max(t.y, r), TILE_H - r);
      t.painter.begin();
      t.painter.drawAtom(0, t.x, t.y, CELL_H, now);
    }
    this.app.render();
    // Copy each tile out of the shared canvas right after rendering, while its pixels are still there.
    const src = this.app.canvas;
    const w = TILE_W * this.resolution;
    const h = TILE_H * this.resolution;
    this.tiles.forEach((t, k) => {
      t.ctx.clearRect(0, 0, w, h);
      t.ctx.drawImage(src, k * w, 0, w, h, 0, 0, w, h);
    });
    this.frame = requestAnimationFrame(this.tick);
  };
}
