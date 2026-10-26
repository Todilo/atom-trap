/**
 * The game modes shown on the title screen. Classic and Puzzle are playable; the others are
 * placeholders so the menu, high scores and HUD are built for more than one mode (ADR-0002).
 * Adding a mode: give it an entry here, then a ruleset and a run kind for it.
 */
export type GameModeId = 'classic' | 'puzzle' | 'daily' | 'arcade';

export interface GameMode {
  id: GameModeId;
  name: string;
  /** One line for the mode card. */
  blurb: string;
  /** Short facts shown as chips when the mode is selected. */
  rules: string[];
  /** Small print at the bottom of the card. */
  footnote: string;
  available: boolean;
  /** What the high-score tab will show, for modes not built yet. */
  scoresNote?: string;
}

export const GAME_MODES: GameMode[] = [
  {
    id: 'classic',
    name: 'Classic',
    blurb: 'The 1992 rules. Clear 75% of the board before time runs out.',
    rules: ['Lives = atoms', 'Clear 75%', 'Timer', 'One more atom per level'],
    footnote: '',
    available: true,
  },
  {
    id: 'puzzle',
    name: 'Puzzle',
    blurb: 'Hand-made boards. Clear each one in as few walls as you can.',
    rules: ['Beat par', 'No timer', '3 lives', 'Stars for fewer walls'],
    footnote: '',
    available: true,
  },
  {
    id: 'daily',
    name: 'Daily',
    blurb: 'One seeded board for everyone, once a day. Share your result.',
    rules: ['One seeded board', 'One attempt', 'Shareable result'],
    footnote: 'A new board every day',
    available: false,
    scoresNote: 'Each day gets its own board and its own table, with your streak beside it.',
  },
  {
    id: 'arcade',
    name: 'Arcade',
    blurb: 'Power-ups and new kinds of atoms.',
    rules: ['Power-ups', 'New atom types', 'Combo multiplier'],
    footnote: 'Combos · score chains',
    available: false,
    scoresNote: 'Arcade scores and longest combos will live here.',
  },
];

export function modeById(id: string): GameMode {
  return GAME_MODES.find((m) => m.id === id) ?? GAME_MODES[0];
}
