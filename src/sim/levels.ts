import { layoutById, layoutCells } from './layouts';
import { classicRuleset, type ClassicSpeed, type Ruleset } from './ruleset';
import { Simulation } from './simulation';

/**
 * A level described as data (ADR-0002): a Classic level's numbers to start from, optional rule
 * tweaks, an optional board layout, and the seed that places the atoms. The same description always
 * gives the same starting board, which is what a shared daily board or a hand-made puzzle needs.
 */

/** The ruleset numbers a level may change from its Classic base. */
export type RuleTweaks = Partial<
  Pick<
    Ruleset,
    | 'atoms'
    | 'lives'
    | 'timeLimit'
    | 'targetCoverage'
    | 'stepMs'
    | 'wallLimit'
    | 'timeBonusPerUnit'
    | 'bigCatchShare'
    | 'chainWindow'
    | 'chainMultipliers'
    | 'captureSize'
    | 'capturePoints'
    | 'captureTime'
  >
>;

export interface LevelSpec {
  /** The Classic level whose atoms, lives, time and scoring are the starting point. */
  level: number;
  speed?: ClassicSpeed;
  tweaks?: RuleTweaks;
  /** A layout id from src/sim/layouts.ts; none means an empty board. */
  layout?: string;
  seed: number;
}

export function levelRules(spec: LevelSpec): Ruleset {
  return { ...classicRuleset(spec.level, spec.speed), ...spec.tweaks };
}

export function createLevel(spec: LevelSpec): Simulation {
  const rules = levelRules(spec);
  const filled = spec.layout ? layoutCells(layoutById(spec.layout), rules.cols, rules.rows) : undefined;
  return new Simulation(rules, { seed: spec.seed, filled });
}
