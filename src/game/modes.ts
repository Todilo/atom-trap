/**
 * The game modes shown on the title screen, all playable (ADR-0014). A mode that isn't ready yet can be
 * listed with `available: false`: its card shows "Soon".
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
    blurb: 'A new board every day, the same for everyone. One scored try, then share it.',
    rules: ['One board a day', 'One scored try', 'Beat par', 'Share your result'],
    footnote: '',
    available: true,
  },
  {
    id: 'arcade',
    name: 'Arcade',
    blurb: 'Hunt the atoms: seal each one into a tiny pocket, chain your catches, race one clock.',
    rules: ['Capture atoms', 'Chains up to ×8', 'One clock per run', 'Big catch ×2'],
    footnote: '',
    available: true,
  },
];

export function modeById(id: string): GameMode {
  return GAME_MODES.find((m) => m.id === id) ?? GAME_MODES[0];
}
