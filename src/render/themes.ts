/**
 * Colour themes: the board, walls ("lighting"), atoms and the menus/HUD. Every theme keeps the
 * atoms in a contrasting hue to the walls, so the two never blur together (ADR-0004).
 */
export interface Theme {
  id: string;
  name: string;
  /** Page and canvas background. */
  background: number;
  board: number;
  grid: number;
  /** Glow colour of walls, the board edge and growing beams. */
  wall: number;
  /** The white-hot core of lines, wall tips and break sparks. */
  hot: number;
  /** Removed cells alternate between these two shades. */
  removed: [number, number];
  /** Atom glow and trail colour. */
  atom: number;
  /** Atom body gradient, CSS colours: highlight → body. */
  atomBody: [string, string];
  /** Screen flash when a life is lost. */
  flash: number;
  ui: {
    text: string;
    accent: string;
    /** Highlights such as "New high score". */
    highlight: string;
  };
}

export const THEMES: Theme[] = [
  {
    id: 'neon',
    name: 'Neon',
    background: 0x05060f,
    board: 0x080b1d,
    grid: 0x121a38,
    wall: 0x3ee8ff,
    hot: 0xe9fdff,
    removed: [0x0e1c3c, 0x0c1934],
    atom: 0xff40c8,
    atomBody: ['#ffaaeb', '#ff40c8'],
    flash: 0xff2a4d,
    ui: { text: '#cfe9ff', accent: '#3ee8ff', highlight: '#ff40c8' },
  },
  {
    id: 'synthwave',
    name: 'Synthwave',
    background: 0x0d0221,
    board: 0x170532,
    grid: 0x2a0d4f,
    wall: 0xff5fd2,
    hot: 0xffe6f7,
    removed: [0x2b0b4a, 0x250941],
    atom: 0xffb000,
    atomBody: ['#ffe2a0', '#ff9a00'],
    flash: 0xff2a4d,
    ui: { text: '#f3d9ff', accent: '#ff5fd2', highlight: '#ffb000' },
  },
  {
    id: 'toxic',
    name: 'Toxic',
    background: 0x020a04,
    board: 0x06140a,
    grid: 0x0e2614,
    wall: 0x39ff6a,
    hot: 0xeaffee,
    removed: [0x0f2e17, 0x0c2713],
    atom: 0xc04bff,
    atomBody: ['#e6c2ff', '#b23cff'],
    flash: 0xff3a3a,
    ui: { text: '#d8ffe0', accent: '#39ff6a', highlight: '#c04bff' },
  },
  {
    id: 'ember',
    name: 'Ember',
    background: 0x0f0503,
    board: 0x1a0905,
    grid: 0x321309,
    wall: 0xff7a1a,
    hot: 0xfff0dc,
    removed: [0x3a1608, 0x331306],
    atom: 0x4fd2ff,
    atomBody: ['#c8f1ff', '#2fb8ff'],
    flash: 0xff2a2a,
    ui: { text: '#ffe2cc', accent: '#ff7a1a', highlight: '#4fd2ff' },
  },
  {
    id: 'ice',
    name: 'Ice',
    background: 0x060a12,
    board: 0x0b1422,
    grid: 0x17263c,
    wall: 0xbfe8ff,
    hot: 0xffffff,
    removed: [0x1b2c47, 0x182840],
    atom: 0xff4f5e,
    atomBody: ['#ffc2c7', '#ff3b4d'],
    flash: 0xff2a4d,
    ui: { text: '#e6f4ff', accent: '#bfe8ff', highlight: '#ff4f5e' },
  },
];

/** How atoms are drawn, chosen in Settings next to the theme. Colours still come from the theme. */
export type AtomStyle = 'soft' | 'glass' | 'plasma' | 'atom' | 'ring' | 'comet' | 'eclipse' | 'spark' | 'gyro' | 'swarm' | 'irid' | 'pulse';

/** In the order Settings shows them; the first is the default. Drawn by src/render/atomPainter.ts. */
export const ATOM_STYLES: { id: AtomStyle; name: string }[] = [
  { id: 'soft', name: 'Soft orb' },
  { id: 'glass', name: 'Glass' },
  { id: 'plasma', name: 'Plasma' },
  { id: 'irid', name: 'Iridescent' },
  { id: 'gyro', name: 'Gyroscope' },
  { id: 'atom', name: 'Real atom' },
  { id: 'ring', name: 'Neon ring' },
  { id: 'pulse', name: 'Pulse' },
  { id: 'eclipse', name: 'Eclipse' },
  { id: 'comet', name: 'Comet' },
  { id: 'swarm', name: 'Firefly swarm' },
  { id: 'spark', name: 'Spark ball' },
];

export function atomStyleById(id: string): AtomStyle {
  return ATOM_STYLES.find((s) => s.id === id)?.id ?? 'soft';
}

export function themeById(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export function nextTheme(id: string): Theme {
  const i = THEMES.findIndex((t) => t.id === id);
  return THEMES[(i + 1) % THEMES.length];
}

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

const rgba = (css: string, alpha: number) => {
  const n = parseInt(css.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

/** The theme's menu and HUD colours, as CSS custom properties for :root. */
export function cssVariables(t: Theme): Record<string, string> {
  const bg = hex(t.background);
  return {
    '--bg': bg,
    '--surface': hex(t.board),
    '--grid': hex(t.grid),
    '--text': t.ui.text,
    '--text-dim': rgba(t.ui.text, 0.72),
    '--line': rgba(t.ui.accent, 0.22),
    '--accent': t.ui.accent,
    '--accent-soft': rgba(t.ui.accent, 0.4),
    '--accent-faint': rgba(t.ui.accent, 0.08),
    '--highlight': t.ui.highlight,
    '--highlight-soft': rgba(t.ui.highlight, 0.35),
    '--overlay': rgba(bg, 0.82),
  };
}
