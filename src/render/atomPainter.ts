import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { AtomStyle, Theme } from './themes';

/**
 * Draws atoms in one of the atom styles: a soft halo, a body texture and, for the animated styles,
 * strokes redrawn every frame. Both the game board and the Settings previews use it, so the previews
 * show exactly what plays. Styles keep a round edge one cell across, so collisions still read as touches.
 */

/** The soft white radial used for halos, trails and sparks; tinted per use. */
export function glowTexture(size = 64): Texture {
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

type TrailKind = 'dots' | 'rings' | 'streak';

/** Per style: halo strength, and how the trail behind the atom is drawn. */
const LOOKS: Record<AtomStyle, { glow: number; trail: TrailKind; trailLength: number; trailMs: number }> = {
  soft: { glow: 0.45, trail: 'dots', trailLength: 7, trailMs: 280 },
  glass: { glow: 0.3, trail: 'rings', trailLength: 7, trailMs: 280 },
  plasma: { glow: 0.6, trail: 'dots', trailLength: 7, trailMs: 280 },
  atom: { glow: 0.35, trail: 'dots', trailLength: 6, trailMs: 240 },
  ring: { glow: 0.25, trail: 'rings', trailLength: 7, trailMs: 280 },
  comet: { glow: 0.5, trail: 'streak', trailLength: 16, trailMs: 520 },
  eclipse: { glow: 0.4, trail: 'dots', trailLength: 7, trailMs: 280 },
  spark: { glow: 0.4, trail: 'dots', trailLength: 6, trailMs: 240 },
  gyro: { glow: 0.35, trail: 'dots', trailLength: 6, trailMs: 240 },
  swarm: { glow: 0.35, trail: 'dots', trailLength: 7, trailMs: 280 },
  irid: { glow: 0.35, trail: 'dots', trailLength: 7, trailMs: 280 },
  pulse: { glow: 0.4, trail: 'dots', trailLength: 6, trailMs: 240 },
};

/** Dot trails use sprites; this many per atom covers every style's dot trail. */
const MAX_DOT_TRAIL = 7;

const css = (n: number, a: number) => `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;

const fromHex = (h: string) => parseInt(h.slice(1), 16);

/** Mixes two 0xRRGGBB colours. */
function mix(a: number, b: number, t: number): number {
  const ch = (s: number) => Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * t) << s;
  return ch(16) | ch(8) | ch(0);
}

/** The atom's body, drawn once per theme and style. The texture's radius is the body's radius. */
function bodyTexture(theme: Theme, style: AtomStyle, size = 64): Texture {
  const highlight = fromHex(theme.atomBody[0]);
  const body = fromHex(theme.atomBody[1]);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const r = size / 2;
  const radial = (cx: number, cy: number, r0: number, r1: number, stops: [number, string][]) => {
    const g = ctx.createRadialGradient(cx, cy, r0, r, r, r1);
    for (const [at, color] of stops) g.addColorStop(at, color);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  };
  // A small white-hot core, shared by the styles whose look is mostly drawn per frame.
  const core = (k: number, mid = 0.9) =>
    radial(r, r, 0, r * k, [
      [0, 'rgba(255,255,255,1)'],
      [0.5, css(highlight, mid)],
      [1, css(body, 0)],
    ]);
  switch (style) {
    case 'soft':
      radial(r * 0.85, r * 0.85, 0, r, [
        [0, 'rgba(255,255,255,0.95)'],
        [0.25, css(highlight, 0.75)],
        [0.6, css(body, 0.4)],
        [0.86, css(body, 0.6)],
        [1, css(body, 0)],
      ]);
      break;
    case 'glass':
      radial(r, r, r * 0.2, r, [
        [0, css(body, 0.08)],
        [0.7, css(body, 0.18)],
        [0.92, css(body, 0.8)],
        [1, css(body, 0)],
      ]);
      radial(r, r, 0, r * 0.35, [
        [0, 'rgba(255,255,255,0.8)'],
        [1, 'rgba(255,255,255,0)'],
      ]);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.ellipse(r * 0.62, r * 0.58, r * 0.28, r * 0.14, -0.7, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'ring':
      ctx.fillStyle = css(body, 0.12);
      ctx.beginPath();
      ctx.arc(r, r, r * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = css(theme.hot, 0.9);
      ctx.beginPath();
      ctx.arc(r, r, r * 0.15, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'eclipse':
      // A dark disc in the page colour with a white-hot rim: the corona rays are drawn per frame.
      ctx.fillStyle = css(theme.background, 1);
      ctx.beginPath();
      ctx.arc(r, r, r * 0.86, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = css(theme.hot, 1);
      ctx.lineWidth = r * 0.14;
      ctx.beginPath();
      ctx.arc(r, r, r * 0.86, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case 'irid':
      radial(r, r, 0, r, [
        [0, css(body, 0.06)],
        [0.75, css(body, 0.16)],
        [1, css(body, 0)],
      ]);
      radial(r, r, 0, r * 0.3, [
        [0, 'rgba(255,255,255,1)'],
        [1, 'rgba(255,255,255,0)'],
      ]);
      break;
    case 'pulse':
      radial(r, r, 0, r * 0.8, [
        [0, 'rgba(255,255,255,1)'],
        [0.35, css(highlight, 0.85)],
        [0.8, css(body, 0.35)],
        [1, css(body, 0)],
      ]);
      break;
    case 'swarm':
      radial(r, r, 0, r * 0.7, [
        [0, 'rgba(255,255,255,0.9)'],
        [0.4, css(highlight, 0.6)],
        [1, css(body, 0)],
      ]);
      break;
    case 'plasma':
      core(0.6);
      break;
    case 'comet':
      core(0.75);
      break;
    case 'spark':
      core(0.62);
      break;
    case 'atom':
    case 'gyro':
      core(0.55, 0.8);
      break;
  }
  return Texture.from(canvas);
}

/** One atom's sprites and remembered state. */
interface AtomParts {
  glow: Sprite;
  body: Sprite;
  dots: Sprite[];
  trail: { x: number; y: number; t: number }[];
  last: { x: number; y: number } | null;
  /** The spark style's current tendrils, as offsets from the atom's centre. */
  sparks: [number, number][][];
}

export class AtomPainter {
  /** Add this to the stage; it holds the trails, halos, animated strokes and bodies, back to front. */
  readonly view = new Container();
  private readonly trailLayer = new Container();
  private readonly trailLines = new Graphics();
  private readonly glowLayer = new Container();
  private readonly strokes = new Graphics();
  private readonly bodyLayer = new Container();
  private atoms: AtomParts[] = [];
  private body: Texture;

  constructor(
    private readonly glow: Texture,
    private theme: Theme,
    private style: AtomStyle,
  ) {
    this.body = bodyTexture(theme, style);
    for (const layer of [this.trailLayer, this.trailLines, this.glowLayer, this.strokes]) layer.blendMode = 'add';
    this.view.addChild(this.trailLayer, this.trailLines, this.glowLayer, this.strokes, this.bodyLayer);
  }

  setTheme(theme: Theme): void {
    this.theme = theme;
    this.refreshBody();
    for (const a of this.atoms) for (const s of [a.glow, ...a.dots]) s.tint = theme.atom;
  }

  setStyle(style: AtomStyle): void {
    if (style === this.style) return;
    this.style = style;
    this.refreshBody();
    this.clearTrails();
  }

  /** Makes sprites for `n` atoms (and drops any others), with empty trails. */
  setCount(n: number): void {
    for (const a of this.atoms) for (const s of [a.glow, a.body, ...a.dots]) s.destroy();
    this.atoms = [];
    for (let i = 0; i < n; i++) {
      const dots = Array.from({ length: MAX_DOT_TRAIL }, () => this.glowSprite(this.trailLayer));
      const glow = this.glowSprite(this.glowLayer);
      const body = new Sprite(this.body);
      body.anchor.set(0.5);
      this.bodyLayer.addChild(body);
      this.atoms.push({ glow, body, dots, trail: [], last: null, sparks: [] });
    }
  }

  /** Hides atom `i` (an Arcade capture took it off the board). */
  hideAtom(i: number): void {
    const a = this.atoms[i];
    for (const s of [a.glow, a.body, ...a.dots]) s.visible = false;
  }

  /** Forgets trails, e.g. after the board moved on screen. */
  clearTrails(): void {
    for (const a of this.atoms) {
      a.trail.length = 0;
      a.last = null;
    }
  }

  /** Call once per frame before drawing the atoms. */
  begin(): void {
    this.trailLines.clear();
    this.strokes.clear();
  }

  /** Draws atom `i` centred at (x, y); `diameter` is the body's size, one cell high on the board. */
  drawAtom(i: number, x: number, y: number, diameter: number, now: number): void {
    const a = this.atoms[i];
    a.glow.visible = a.body.visible = true;
    const look = LOOKS[this.style];
    const pulse = this.style === 'pulse' ? 1 + 0.1 * Math.sin(now / 230 + i) : 1;
    a.glow.position.set(x, y);
    a.glow.scale.set(((diameter * 3.2) / 64) * pulse);
    a.glow.alpha = look.glow;
    a.body.position.set(x, y);
    a.body.scale.set(((diameter * 1.15) / 64) * pulse);
    this.drawTrail(a, x, y, diameter, now);
    // R: the body's radius; s: line widths scale with it (the mock-ups were drawn at R = 17).
    const R = diameter * 0.575;
    this.drawStrokes(a, i, x, y, R, R / 17, now);
  }

  private drawTrail(a: AtomParts, x: number, y: number, diameter: number, now: number): void {
    const look = LOOKS[this.style];
    // Sample a new point only when the atom has moved since the last sample (which may have expired).
    if (!a.last || Math.hypot(a.last.x - x, a.last.y - y) > Math.max(1, diameter * 0.25)) {
      a.last = { x, y };
      a.trail.unshift({ x, y, t: now });
      if (a.trail.length > look.trailLength) a.trail.pop();
    }
    while (a.trail.length && now - a.trail[a.trail.length - 1].t > look.trailMs) a.trail.pop();
    const fade = (t: number) => (1 - t / look.trailLength) * (1 - (now - a.trail[t].t) / look.trailMs);
    a.dots.forEach((s, t) => {
      s.visible = look.trail === 'dots' && t < a.trail.length;
      if (!s.visible) return;
      const k = fade(t);
      s.position.set(a.trail[t].x, a.trail[t].y);
      s.scale.set(((diameter * 1.6) / 64) * k);
      s.alpha = 0.35 * k;
    });
    const g = this.trailLines;
    const R = diameter * 0.575;
    if (look.trail === 'rings') {
      a.trail.forEach((p, t) => {
        const k = fade(t);
        g.circle(p.x, p.y, R * 0.9 * k).stroke({ width: (R / 17) * 2, color: this.theme.atom, alpha: 0.25 * k });
      });
    } else if (look.trail === 'streak') {
      let prev = { x, y };
      a.trail.forEach((p, t) => {
        const k = fade(t);
        g.moveTo(prev.x, prev.y).lineTo(p.x, p.y).stroke({ width: R * 1.3 * k, color: this.theme.atom, alpha: 0.5 * k, cap: 'round' });
        prev = p;
      });
    }
  }

  /** The per-frame part of each style. */
  private drawStrokes(a: AtomParts, i: number, x: number, y: number, R: number, s: number, now: number): void {
    const g = this.strokes;
    const { atom, wall, hot } = this.theme;
    const TAU = Math.PI * 2;
    // An ellipse as a polygon, so it can be turned: Graphics.ellipse has no rotation.
    const ellipse = (rx: number, ry: number, rot: number) => {
      const c = Math.cos(rot);
      const n = Math.sin(rot);
      for (let k = 0; k <= 28; k++) {
        const t = (k / 28) * TAU;
        const ex = Math.cos(t) * rx;
        const ey = Math.sin(t) * ry;
        const px = x + ex * c - ey * n;
        const py = y + ex * n + ey * c;
        if (k) g.lineTo(px, py);
        else g.moveTo(px, py);
      }
    };
    switch (this.style) {
      case 'plasma':
        for (let k = 0; k < 3; k++) {
          const start = (now / 260) * (k % 2 ? 1 : -1) + k * 2.1 + i * 1.3;
          const r = R * (0.75 + k * 0.12) + Math.sin(now / 140 + k + i) * 1.5 * s;
          g.moveTo(x + Math.cos(start) * r, y + Math.sin(start) * r)
            .arc(x, y, r, start, start + 2.2)
            .stroke({ width: 2.2 * s, color: k === 1 ? wall : atom, alpha: k === 1 ? 0.7 : 0.8, cap: 'round' });
        }
        break;
      case 'atom':
        for (let o = 0; o < 3; o++) {
          const rot = (o * Math.PI) / 3 + now / 3000 + i;
          ellipse(R * 1.15, R * 0.42, rot);
          g.stroke({ width: 1.3 * s, color: atom, alpha: 0.45 });
          const t = now / (180 + o * 40) + o * 2 + i;
          const ex = Math.cos(t) * R * 1.15;
          const ey = Math.sin(t) * R * 0.42;
          const px = x + ex * Math.cos(rot) - ey * Math.sin(rot);
          const py = y + ex * Math.sin(rot) + ey * Math.cos(rot);
          g.circle(px, py, 4.5 * s).fill({ color: wall, alpha: 0.35 });
          g.circle(px, py, 2 * s).fill({ color: hot, alpha: 0.95 });
        }
        break;
      case 'ring': {
        const r = R * 0.85 * (1 + Math.sin(now / 220 + i) * 0.06);
        for (const [w, alpha, color] of [
          [9, 0.12, atom],
          [5, 0.3, atom],
          [2, 1, hot],
        ] as const) {
          g.circle(x, y, r).stroke({ width: w * s, color, alpha });
        }
        break;
      }
      case 'eclipse':
        for (let k = 0; k < 14; k++) {
          const t = (k / 14) * TAU + now / 900 + i;
          const len = R * (1.25 + 0.3 * Math.sin(now / 150 + k * 1.7));
          g.moveTo(x + Math.cos(t) * R * 0.95, y + Math.sin(t) * R * 0.95)
            .lineTo(x + Math.cos(t) * len, y + Math.sin(t) * len)
            .stroke({ width: 1.5 * s, color: atom, alpha: 0.4 });
        }
        break;
      case 'spark':
        // New tendrils now and then, so they crackle rather than crawl.
        if (!a.sparks.length || Math.random() < 0.35) {
          a.sparks = [0, 1, 2].map(() => {
            let t = Math.random() * TAU;
            let px = 0;
            let py = 0;
            const pts: [number, number][] = [[0, 0]];
            for (let k = 0; k < 5; k++) {
              t += (Math.random() - 0.5) * 1.4;
              px += Math.cos(t) * R * 0.38;
              py += Math.sin(t) * R * 0.38;
              pts.push([px, py]);
            }
            return pts;
          });
        }
        for (const [w, alpha, color] of [
          [4, 0.35, wall],
          [1.4, 0.95, hot],
        ] as const) {
          for (const pts of a.sparks) {
            pts.forEach(([px, py], k) => (k ? g.lineTo(x + px, y + py) : g.moveTo(x + px, y + py)));
            g.stroke({ width: w * s, color, alpha, cap: 'round', join: 'round' });
          }
        }
        break;
      case 'gyro':
        for (const [k, phase, tilt] of [
          [0, now / 700, 0],
          [1, now / 520 + 1.6, 1.1],
        ] as const) {
          const squash = Math.abs(Math.cos(phase + i)) * 0.95 + 0.05;
          const rot = tilt + now / 4000 + i;
          ellipse(R, R * squash, rot);
          g.stroke({ width: 5 * s, color: k ? wall : atom, alpha: 0.25 });
          ellipse(R, R * squash, rot);
          g.stroke({ width: 1.6 * s, color: k ? wall : hot, alpha: 0.95 });
        }
        break;
      case 'swarm':
        for (let k = 0; k < 9; k++) {
          const t = (now / (300 + k * 37)) * (k % 2 ? 1 : -1) + k * 0.7 + i;
          const r = R * (0.75 + 0.35 * Math.sin(now / 400 + k * 2.3));
          const px = x + Math.cos(t) * r;
          const py = y + Math.sin(t) * r * 0.85;
          const color = k % 3 ? hot : wall;
          g.circle(px, py, 4.5 * s).fill({ color, alpha: 0.2 });
          g.circle(px, py, 1.8 * s).fill({ color, alpha: 0.9 });
        }
        break;
      case 'irid': {
        // The rim drifts between the atom colour and the wall colour.
        const color = mix(atom, wall, (Math.sin(now / 500 + i) + 1) / 2);
        g.circle(x, y, R * 0.9).stroke({ width: 7 * s, color, alpha: 0.2 });
        g.circle(x, y, R * 0.9).stroke({ width: 2.5 * s, color, alpha: 0.9 });
        const t = now / 300 + i;
        g.moveTo(x + Math.cos(t) * R * 0.9, y + Math.sin(t) * R * 0.9)
          .arc(x, y, R * 0.9, t, t + 2)
          .stroke({ width: 2 * s, color: wall, alpha: 0.5 });
        break;
      }
      case 'pulse': {
        const b = ((now + i * 400) % 1400) / 1400;
        for (const q of [b, (b + 0.5) % 1]) g.circle(x, y, R * (0.9 + q * 1.4)).stroke({ width: 2 * s, color: atom, alpha: 0.6 * (1 - q) });
        break;
      }
    }
  }

  private refreshBody(): void {
    const old = this.body;
    this.body = bodyTexture(this.theme, this.style);
    for (const a of this.atoms) a.body.texture = this.body;
    old.destroy(true);
  }

  private glowSprite(parent: Container): Sprite {
    const s = new Sprite(this.glow);
    s.anchor.set(0.5);
    s.tint = this.theme.atom;
    s.blendMode = 'add';
    parent.addChild(s);
    return s;
  }
}
