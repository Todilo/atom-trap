import { Application, Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { BoardLayout } from '../game/layout';
import { CELL_GROWING_A, CELL_GROWING_B, CELL_OPEN, CELL_REMOVED, type Atom, type Simulation } from '../sim/simulation';

/**
 * The neon look (ADR-0004). Glow is faked cheaply for mobile GPUs: additive blending, layered strokes
 * and one soft radial texture, with no blur filters. It reads simulation state and never changes it
 * (ADR-0005). Effects come from comparing the grid between frames.
 */
const C = {
  background: 0x05060f,
  board: 0x080b1d,
  grid: 0x121a38,
  cyan: 0x3ee8ff,
  hot: 0xe9fdff,
  removedA: 0x0e1c3c,
  removedB: 0x0c1934,
  magenta: 0xff40c8,
  red: 0xff2a4d,
};

const TRAIL_LENGTH = 7;
/** Delay per cell of the fill sweep, spreading out from the wall that closed the area. */
const SWEEP_MS_PER_CELL = 16;
const FILL_FLASH_MS = 450;

interface Particle {
  sprite: Sprite;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

function glowTexture(size = 64): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.18, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.25)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return Texture.from(canvas);
}

export class NeonRenderer {
  private readonly bg = new Graphics();
  private readonly removed = new Graphics();
  private readonly edges = new Graphics();
  private readonly walls = new Graphics();
  private readonly trailLayer = new Container();
  private readonly atomLayer = new Container();
  private readonly fxLayer = new Container();
  private readonly flash = new Graphics();
  private readonly glow = glowTexture();

  private layout: BoardLayout | null = null;
  private sim: Simulation | null = null;
  private prevGrid = new Uint8Array(0);
  /** When each removed cell becomes visible (ms, performance.now clock); -1 if not removed. */
  private removedAt = new Float64Array(0);
  private edgesDirty = true;
  private prevLives = 0;
  private flashAlpha = 0;
  private lastTime = performance.now();

  private atomSprites: Sprite[] = [];
  private coreSprites: Sprite[] = [];
  private trailSprites: Sprite[][] = [];
  private trails: { x: number; y: number }[][] = [];
  private tipSprites: Sprite[] = [];
  private particles: Particle[] = [];
  private spritePool: Sprite[] = [];

  private constructor(readonly app: Application) {
    this.edges.blendMode = 'add';
    this.walls.blendMode = 'add';
    this.trailLayer.blendMode = 'add';
    this.atomLayer.blendMode = 'add';
    this.fxLayer.blendMode = 'add';
    app.stage.addChild(this.bg, this.removed, this.edges, this.walls, this.trailLayer, this.atomLayer, this.fxLayer, this.flash);
    for (let i = 0; i < 2; i++) {
      const tip = this.makeSprite(C.hot);
      this.tipSprites.push(tip);
      this.fxLayer.addChild(tip);
    }
  }

  static async create(host: HTMLElement): Promise<NeonRenderer> {
    const app = new Application();
    await app.init({
      resizeTo: host,
      background: C.background,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });
    host.appendChild(app.canvas);
    return new NeonRenderer(app);
  }

  get canvas(): HTMLCanvasElement {
    return this.app.canvas;
  }

  setLayout(layout: BoardLayout, cols: number, rows: number): void {
    this.layout = layout;
    this.edgesDirty = true;
    for (const t of this.trails) t.length = 0;
    const g = this.bg.clear();
    g.rect(layout.x, layout.y, layout.width, layout.height).fill(C.board);
    for (let x = 1; x < cols; x++) g.moveTo(layout.x + x * layout.cellW, layout.y).lineTo(layout.x + x * layout.cellW, layout.y + layout.height);
    for (let y = 1; y < rows; y++) g.moveTo(layout.x, layout.y + y * layout.cellH).lineTo(layout.x + layout.width, layout.y + y * layout.cellH);
    g.stroke({ width: 1, color: C.grid });
    this.flash.clear().rect(0, 0, 4096, 4096).fill(C.red);
    this.flash.alpha = 0;
  }

  /** `alpha` (0..1) interpolates atoms from their previous to their current cell. */
  draw(sim: Simulation | null, previous: Atom[], alpha: number): void {
    const now = performance.now();
    const dt = Math.min(now - this.lastTime, 100) / 1000;
    this.lastTime = now;
    const l = this.layout;
    if (!l) return;
    if (sim !== this.sim) this.reset(sim);

    if (sim) {
      this.diffGrid(sim, now);
      this.drawRemoved(sim, now);
      if (this.edgesDirty) this.drawEdges(sim);
      this.drawWalls(sim, now);
      this.drawAtoms(sim, previous, alpha);
      if (sim.lives < this.prevLives) this.flashAlpha = 0.35;
      this.prevLives = sim.lives;
    } else {
      this.removed.clear();
      this.edges.clear();
      this.walls.clear();
      this.edgesDirty = true;
      this.drawBoardEdge();
    }

    this.updateParticles(dt);
    this.flashAlpha = Math.max(0, this.flashAlpha - dt * 0.9);
    this.flash.alpha = this.flashAlpha;
  }

  private reset(sim: Simulation | null): void {
    this.sim = sim;
    const n = sim ? sim.rules.cols * sim.rules.rows : 0;
    this.prevGrid = new Uint8Array(n);
    this.removedAt = new Float64Array(n).fill(-1);
    this.edgesDirty = true;
    this.prevLives = sim?.lives ?? 0;
    for (const s of [...this.atomSprites, ...this.coreSprites, ...this.trailSprites.flat()]) s.destroy();
    this.atomSprites = [];
    this.coreSprites = [];
    this.trailSprites = [];
    this.trails = [];
    if (!sim) return;
    for (let i = 0; i < sim.atoms.length; i++) {
      const trail: Sprite[] = [];
      for (let t = 0; t < TRAIL_LENGTH; t++) {
        const s = this.makeSprite(C.magenta);
        trail.push(s);
        this.trailLayer.addChild(s);
      }
      this.trailSprites.push(trail);
      this.trails.push([]);
      const glow = this.makeSprite(C.magenta);
      const core = this.makeSprite(0xffffff);
      this.atomSprites.push(glow);
      this.coreSprites.push(core);
      this.atomLayer.addChild(glow, core);
    }
  }

  /** Finds walls that broke (growing → open) and newly removed cells, and schedules their effects. */
  private diffGrid(sim: Simulation, now: number): void {
    const { cols, rows } = sim.rules;
    const fresh: number[] = [];
    const seeds: number[] = [];
    for (let i = 0; i < cols * rows; i++) {
      const x = i % cols;
      const y = (i - x) / cols;
      const cur = sim.cellAt(x, y);
      const prev = this.prevGrid[i];
      if (cur === prev) continue;
      this.edgesDirty = true;
      const wasGrowing = prev === CELL_GROWING_A || prev === CELL_GROWING_B;
      if (wasGrowing && cur === CELL_OPEN) this.burst(x, y, C.hot, 4, 1);
      if (cur === CELL_REMOVED) {
        fresh.push(i);
        if (wasGrowing) seeds.push(i);
      }
      this.prevGrid[i] = cur;
    }
    if (!fresh.length) return;
    // Sweep: breadth-first distance through the fresh cells, starting at the wall that closed them.
    const dist = new Map<number, number>();
    const queue = seeds.length ? seeds : [fresh[0]];
    const freshSet = new Set(fresh);
    for (const s of queue) dist.set(s, 0);
    for (let q = 0; q < queue.length; q++) {
      const i = queue[q];
      const x = i % cols;
      const d = dist.get(i)! + 1;
      for (const n of [x > 0 ? i - 1 : -1, x < cols - 1 ? i + 1 : -1, i - cols, i + cols]) {
        if (n < 0 || !freshSet.has(n) || dist.has(n)) continue;
        dist.set(n, d);
        queue.push(n);
      }
    }
    for (const i of fresh) this.removedAt[i] = now + (dist.get(i) ?? 0) * SWEEP_MS_PER_CELL;
  }

  private drawRemoved(sim: Simulation, now: number): void {
    const l = this.layout!;
    const { cols, rows } = sim.rules;
    const g = this.removed.clear();
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        const t = now - this.removedAt[i];
        if (this.removedAt[i] < 0 || t < 0 || sim.cellAt(x, y) !== CELL_REMOVED) continue;
        const px = l.x + x * l.cellW;
        const py = l.y + y * l.cellH;
        g.rect(px, py, l.cellW + 0.5, l.cellH + 0.5).fill((x + y) % 2 ? C.removedA : C.removedB);
        if (t < FILL_FLASH_MS) g.rect(px, py, l.cellW + 0.5, l.cellH + 0.5).fill({ color: C.cyan, alpha: 0.55 * (1 - t / FILL_FLASH_MS) });
      }
    }
  }

  /** Glowing outline around the open play area: board edges plus every completed wall. */
  private drawEdges(sim: Simulation): void {
    this.edgesDirty = false;
    const l = this.layout!;
    const { cols, rows } = sim.rules;
    const g = this.edges.clear();
    const solid = (x: number, y: number) => x < 0 || y < 0 || x >= cols || y >= rows || sim.cellAt(x, y) === CELL_REMOVED;
    // An edge lies between an open cell and a solid one. Collect them as continuous runs, so the
    // additive glow doesn't brighten at every cell joint.
    const runs: [number, number, number, number][] = [];
    for (let y = 0; y <= rows; y++) {
      let start = -1;
      for (let x = 0; x <= cols; x++) {
        const edge = x < cols && solid(x, y - 1) !== solid(x, y);
        if (edge && start < 0) start = x;
        if (!edge && start >= 0) {
          runs.push([l.x + start * l.cellW, l.y + y * l.cellH, l.x + x * l.cellW, l.y + y * l.cellH]);
          start = -1;
        }
      }
    }
    for (let x = 0; x <= cols; x++) {
      let start = -1;
      for (let y = 0; y <= rows; y++) {
        const edge = y < rows && solid(x - 1, y) !== solid(x, y);
        if (edge && start < 0) start = y;
        if (!edge && start >= 0) {
          runs.push([l.x + x * l.cellW, l.y + start * l.cellH, l.x + x * l.cellW, l.y + y * l.cellH]);
          start = -1;
        }
      }
    }
    const path = () => {
      for (const [x0, y0, x1, y1] of runs) g.moveTo(x0, y0).lineTo(x1, y1);
    };
    const unit = Math.min(l.cellW, l.cellH);
    for (const [width, alpha, color] of [
      [unit * 0.9, 0.08, C.cyan],
      [unit * 0.4, 0.22, C.cyan],
      [Math.max(1.5, unit * 0.1), 0.95, C.hot],
    ] as const) {
      path();
      g.stroke({ width, color, alpha, cap: 'butt' });
    }
  }

  private drawBoardEdge(): void {
    const l = this.layout!;
    const unit = Math.min(l.cellW, l.cellH);
    const g = this.edges;
    g.rect(l.x, l.y, l.width, l.height).stroke({ width: unit * 0.4, color: C.cyan, alpha: 0.2 });
    g.rect(l.x, l.y, l.width, l.height).stroke({ width: Math.max(1.5, unit * 0.1), color: C.hot, alpha: 0.9 });
  }

  /** Growing halves: flickering beams with a bright tip, so a vulnerable wall never looks finished. */
  private drawWalls(sim: Simulation, now: number): void {
    const l = this.layout!;
    const g = this.walls.clear();
    const unit = Math.min(l.cellW, l.cellH);
    let tip = 0;
    for (const half of [sim.halves.a, sim.halves.b]) {
      if (!half) continue;
      const first = half.cells[0];
      const head = half.cells[half.cells.length - 1];
      const cx = (c: { x: number }) => l.x + (c.x + 0.5) * l.cellW;
      const cy = (c: { y: number }) => l.y + (c.y + 0.5) * l.cellH;
      // Start at the cell edge the wall grows away from, end at the head's centre.
      const sx = cx(first) - half.dx * l.cellW * 0.5;
      const sy = cy(first) - half.dy * l.cellH * 0.5;
      const flicker = 0.65 + 0.35 * Math.sin(now / 37 + head.x * 3 + head.y * 5) * Math.sin(now / 23);
      for (const [width, alpha, color] of [
        [unit * 1.1, 0.12, C.cyan],
        [unit * 0.5, 0.35, C.cyan],
        [unit * 0.16, flicker, C.hot],
      ] as const) {
        g.moveTo(sx, sy).lineTo(cx(head), cy(head)).stroke({ width, color, alpha, cap: 'round' });
      }
      const s = this.tipSprites[tip++];
      s.visible = true;
      s.position.set(cx(head), cy(head));
      s.scale.set(((unit * 2.4) / 64) * (0.85 + 0.25 * Math.sin(now / 60)));
      s.alpha = 0.9;
    }
    for (; tip < this.tipSprites.length; tip++) this.tipSprites[tip].visible = false;
  }

  private drawAtoms(sim: Simulation, previous: Atom[], alpha: number): void {
    const l = this.layout!;
    const unit = Math.min(l.cellW, l.cellH);
    sim.atoms.forEach((atom, i) => {
      const p = previous[i] ?? atom;
      const x = l.x + (p.x + (atom.x - p.x) * alpha + 0.5) * l.cellW;
      const y = l.y + (p.y + (atom.y - p.y) * alpha + 0.5) * l.cellH;
      const glow = this.atomSprites[i];
      glow.position.set(x, y);
      glow.scale.set((unit * 2.6) / 64);
      const core = this.coreSprites[i];
      core.position.set(x, y);
      core.scale.set((unit * 0.9) / 64);

      const trail = this.trails[i];
      const last = trail[0];
      if (!last || Math.hypot(last.x - x, last.y - y) > unit * 0.25) {
        trail.unshift({ x, y });
        if (trail.length > TRAIL_LENGTH) trail.pop();
      }
      this.trailSprites[i].forEach((s, t) => {
        const pt = trail[t];
        s.visible = !!pt;
        if (!pt) return;
        const k = 1 - t / TRAIL_LENGTH;
        s.position.set(pt.x, pt.y);
        s.scale.set(((unit * 1.6) / 64) * k);
        s.alpha = 0.35 * k;
      });
    });
  }

  private burst(cx: number, cy: number, color: number, count: number, speed: number): void {
    const l = this.layout!;
    const unit = Math.min(l.cellW, l.cellH);
    const x = l.x + (cx + 0.5) * l.cellW;
    const y = l.y + (cy + 0.5) * l.cellH;
    for (let i = 0; i < count; i++) {
      const sprite = this.spritePool.pop() ?? this.makeSprite(color);
      sprite.tint = color;
      sprite.visible = true;
      sprite.position.set(x, y);
      sprite.scale.set((unit * 0.9) / 64);
      this.fxLayer.addChild(sprite);
      const angle = Math.random() * Math.PI * 2;
      const v = unit * (4 + Math.random() * 8) * speed;
      const maxLife = 0.35 + Math.random() * 0.35;
      this.particles.push({ sprite, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v, life: maxLife, maxLife });
    }
  }

  private updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.sprite.visible = false;
        this.fxLayer.removeChild(p.sprite);
        this.spritePool.push(p.sprite);
        this.particles.splice(i, 1);
        continue;
      }
      p.sprite.x += p.vx * dt;
      p.sprite.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
      p.sprite.alpha = p.life / p.maxLife;
    }
  }

  private makeSprite(tint: number): Sprite {
    const s = new Sprite(this.glow);
    s.anchor.set(0.5);
    s.tint = tint;
    s.blendMode = 'add';
    return s;
  }
}
