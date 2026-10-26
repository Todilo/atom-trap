import { Application, Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { BoardLayout } from '../game/layout';
import type { Theme } from './themes';
import { CELL_GROWING_A, CELL_GROWING_B, CELL_OPEN, CELL_REMOVED, type Atom, type Simulation } from '../sim/simulation';

/**
 * The neon look (ADR-0004). Glow is faked cheaply for mobile GPUs: additive blending, layered strokes
 * and one soft radial texture, with no blur filters. It reads simulation state and never changes it
 * (ADR-0005). Effects come from comparing the grid between frames. Colours come from the active theme.
 */

const TRAIL_LENGTH = 7;
/** Trail points fade out over this time, so an atom that stops (or is stuck) loses its trail. */
const TRAIL_MS = 280;
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

/** The atom's body: a solid orb in the theme's atom colour, with a hot white centre and a thin soft rim. */
function orbTexture(theme: Theme, size = 64): Texture {
  const [highlight, body] = theme.atomBody;
  const fade = (css: string, a: number) => {
    const n = parseInt(css.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const r = size / 2;
  const g = ctx.createRadialGradient(r * 0.8, r * 0.8, 0, r, r, r);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, fade(highlight, 1));
  g.addColorStop(0.78, fade(body, 1));
  g.addColorStop(0.87, fade(body, 0.5));
  g.addColorStop(1, fade(body, 0));
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
  private orb: Texture;
  private cols = 28;
  private rows = 20;

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
  private trails: { x: number; y: number; t: number }[][] = [];
  private trailLast: ({ x: number; y: number } | null)[] = [];
  private tipSprites: Sprite[] = [];
  private particles: Particle[] = [];
  private spritePool: Sprite[] = [];

  private constructor(
    readonly app: Application,
    private theme: Theme,
  ) {
    this.orb = orbTexture(theme);
    this.edges.blendMode = 'add';
    this.walls.blendMode = 'add';
    this.trailLayer.blendMode = 'add';
    this.atomLayer.blendMode = 'add';
    this.fxLayer.blendMode = 'add';
    app.stage.addChild(this.bg, this.removed, this.edges, this.walls, this.trailLayer, this.atomLayer, this.fxLayer, this.flash);
    for (let i = 0; i < 2; i++) {
      const tip = this.makeSprite(theme.hot);
      tip.visible = false;
      this.tipSprites.push(tip);
      this.fxLayer.addChild(tip);
    }
  }

  static async create(host: HTMLElement, theme: Theme): Promise<NeonRenderer> {
    const app = new Application();
    await app.init({
      resizeTo: host,
      // Input is handled by src/game/input.ts. Pixi's own pointer handling would only reset the cursor.
      eventFeatures: { move: false, globalMove: false, click: false, wheel: false },
      background: theme.background,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });
    host.appendChild(app.canvas);
    return new NeonRenderer(app, theme);
  }

  get canvas(): HTMLCanvasElement {
    return this.app.canvas;
  }

  /** Switches colours live: background, board, walls, atoms and effects. */
  setTheme(theme: Theme): void {
    this.theme = theme;
    this.app.renderer.background.color = theme.background;
    const old = this.orb;
    this.orb = orbTexture(theme);
    for (const core of this.coreSprites) core.texture = this.orb;
    old.destroy(true);
    for (const s of [...this.atomSprites, ...this.trailSprites.flat()]) s.tint = theme.atom;
    for (const tip of this.tipSprites) tip.tint = theme.hot;
    if (this.layout) this.setLayout(this.layout, this.cols, this.rows);
  }

  setLayout(layout: BoardLayout, cols: number, rows: number): void {
    this.layout = layout;
    this.cols = cols;
    this.rows = rows;
    const C = this.theme;
    this.edgesDirty = true;
    for (const t of this.trails) t.length = 0;
    this.trailLast.fill(null);
    const g = this.bg.clear();
    g.rect(layout.x, layout.y, layout.width, layout.height).fill(C.board);
    for (let x = 1; x < cols; x++) g.moveTo(layout.x + x * layout.cellW, layout.y).lineTo(layout.x + x * layout.cellW, layout.y + layout.height);
    for (let y = 1; y < rows; y++) g.moveTo(layout.x, layout.y + y * layout.cellH).lineTo(layout.x + layout.width, layout.y + y * layout.cellH);
    g.stroke({ width: 1, color: C.grid });
    this.flash.clear().rect(0, 0, 4096, 4096).fill(C.flash);
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
      for (const tip of this.tipSprites) tip.visible = false;
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
    this.trailLast = [];
    if (!sim) return;
    for (let i = 0; i < sim.atoms.length; i++) {
      const trail: Sprite[] = [];
      for (let t = 0; t < TRAIL_LENGTH; t++) {
        const s = this.makeSprite(this.theme.atom);
        trail.push(s);
        this.trailLayer.addChild(s);
      }
      this.trailSprites.push(trail);
      this.trails.push([]);
      const glow = this.makeSprite(this.theme.atom);
      const core = this.makeSprite(0xffffff);
      core.texture = this.orb;
      core.blendMode = 'normal';
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
      if (wasGrowing && cur === CELL_OPEN) this.burst(x, y, this.theme.hot, 4, 1);
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
        g.rect(px, py, l.cellW + 0.5, l.cellH + 0.5).fill((x + y) % 2 ? this.theme.removed[0] : this.theme.removed[1]);
        if (t < FILL_FLASH_MS) g.rect(px, py, l.cellW + 0.5, l.cellH + 0.5).fill({ color: this.theme.wall, alpha: 0.55 * (1 - t / FILL_FLASH_MS) });
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
      [unit * 0.9, 0.08, this.theme.wall],
      [unit * 0.4, 0.22, this.theme.wall],
      [Math.max(1.5, unit * 0.1), 0.95, this.theme.hot],
    ] as const) {
      path();
      g.stroke({ width, color, alpha, cap: 'butt' });
    }
  }

  private drawBoardEdge(): void {
    const l = this.layout!;
    const unit = Math.min(l.cellW, l.cellH);
    const g = this.edges;
    g.rect(l.x, l.y, l.width, l.height).stroke({ width: unit * 0.4, color: this.theme.wall, alpha: 0.2 });
    g.rect(l.x, l.y, l.width, l.height).stroke({ width: Math.max(1.5, unit * 0.1), color: this.theme.hot, alpha: 0.9 });
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
        [unit * 1.1, 0.12, this.theme.wall],
        [unit * 0.5, 0.35, this.theme.wall],
        [unit * 0.16, flicker, this.theme.hot],
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
    const now = performance.now();
    const unit = Math.min(l.cellW, l.cellH);
    // The atom's solid body fills a cell's height, as in the original, so neighbours look touching.
    const diameter = unit;
    const px = (cx: number) => l.x + (cx + 0.5) * l.cellW;
    const py = (cy: number) => l.y + (cy + 0.5) * l.cellH;
    const contacts = sim.atoms.map((atom, i) => this.contactOffset(previous[i] ?? atom, previous, i, diameter));
    // A bounce also redirects the atom it hit; animate that one towards the contact too, so both meet.
    contacts.forEach((c, i) => {
      if (c?.mirror && !contacts[c.partner]) contacts[c.partner] = { x: -c.x, y: -c.y, partner: i, mirror: false };
    });
    sim.atoms.forEach((atom, i) => {
      const p = previous[i] ?? atom;
      let x: number;
      let y: number;
      const contact = contacts[i];
      if (contact) {
        // Bounced off another atom this step: keep travelling until the bodies touch, then come back.
        const half = alpha < 0.5;
        const k = half ? alpha / 0.5 : (alpha - 0.5) / 0.5;
        const mx = px(p.x) + contact.x;
        const my = py(p.y) + contact.y;
        x = half ? px(p.x) + contact.x * k : mx + (px(atom.x) - mx) * k;
        y = half ? py(p.y) + contact.y * k : my + (py(atom.y) - my) * k;
      } else {
        x = px(p.x) + (px(atom.x) - px(p.x)) * alpha;
        y = py(p.y) + (py(atom.y) - py(p.y)) * alpha;
      }
      const glow = this.atomSprites[i];
      glow.position.set(x, y);
      glow.scale.set((diameter * 3.2) / 64);
      const core = this.coreSprites[i];
      core.position.set(x, y);
      core.scale.set((diameter * 1.15) / 64);

      const trail = this.trails[i];
      // Sample a new point only when the atom has moved since the last sample (which may have expired).
      const last = this.trailLast[i];
      if (!last || Math.hypot(last.x - x, last.y - y) > Math.max(1, unit * 0.25)) {
        this.trailLast[i] = { x, y };
        trail.unshift({ x, y, t: now });
        if (trail.length > TRAIL_LENGTH) trail.pop();
      }
      while (trail.length && now - trail[trail.length - 1].t > TRAIL_MS) trail.pop();
      this.trailSprites[i].forEach((s, t) => {
        const pt = trail[t];
        s.visible = !!pt;
        if (!pt) return;
        const k = (1 - t / TRAIL_LENGTH) * (1 - (now - pt.t) / TRAIL_MS);
        s.position.set(pt.x, pt.y);
        s.scale.set(((unit * 1.6) / 64) * k);
        s.alpha = 0.35 * k;
      });
    });
  }

  /**
   * If atom `i` bounced off, or was held up by, a neighbouring atom this step, the pixel offset that
   * brings the two bodies into contact. The simulation resolves collisions between neighbouring cells,
   * as the original does; this only makes them look like a touch.
   */
  private contactOffset(p: Atom, previous: Atom[], i: number, diameter: number): { x: number; y: number; partner: number; mirror: boolean } | null {
    const atoms = this.sim!.atoms;
    const now = atoms[i];
    const bounced = now.dx !== p.dx || now.dy !== p.dy;
    // An atom that held still was blocked; if by an atom, that one has just moved into its path.
    const stalled = !bounced && now.x === p.x && now.y === p.y;
    if (!bounced && !stalled) return null;
    const others = bounced ? previous : atoms;
    const l = this.layout!;
    for (let j = 0; j < others.length; j++) {
      if (j === i) continue;
      const o = others[j];
      const ox = o.x - p.x;
      const oy = o.y - p.y;
      const ahead = (ox === p.dx && oy === 0) || (ox === 0 && oy === p.dy) || (ox === p.dx && oy === p.dy);
      if (!ahead) continue;
      const vx = ox * l.cellW;
      const vy = oy * l.cellH;
      const dist = Math.hypot(vx, vy);
      const travel = Math.max(0, (dist - diameter) / 2);
      return { x: (vx / dist) * travel, y: (vy / dist) * travel, partner: j, mirror: bounced };
    }
    return null;
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
