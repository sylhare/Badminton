import type { EliminationSetup, TournamentMatch, TournamentTeam } from '../../../types/tournament';

/** Height of a single match card in pixels. */
export const MH = 64;

/** Vertical gap between adjacent match cards in pixels. */
export const MG = 12;

/** Slot height: one unit of the bracket grid (MH + MG). */
export const SH = MH + MG;

/** Width of a match card column in pixels. */
export const CW = 176;

/** Width of the SVG connector strip between columns in pixels. */
export const CN = 36;

/**
 * Returns the top position (px) of a match card within the Winners Bracket.
 *
 * Each subsequent round doubles the slot size, centering cards in a binary tree.
 *
 * @param roundIdx - Zero-based round index.
 * @param matchIdx - Zero-based match index within the round.
 */
export function winnersTop(roundIdx: number, matchIdx: number): number {
  const slots = 1 << roundIdx;
  return matchIdx * slots * SH + ((slots - 1) * SH) / 2;
}

/**
 * Returns the top position (px) of a match card within the Consolation Bracket.
 *
 * Columns 0+1 share the same tier as winners round 0, columns 2+3 share tier 1, etc.
 * This produces correct binary-tree spacing across both reduction and challenge columns.
 *
 * @param colIdx  - Zero-based column index within the consolation bracket.
 * @param matchIdx - Zero-based match index within the column.
 */
export function consolationTop(colIdx: number, matchIdx: number): number {
  return winnersTop(Math.floor(colIdx / 2), matchIdx);
}

/** Named sentinel: real team is coming, not yet known. */
export const SEED_TBD = Symbol('SEED_TBD');

/** Named sentinel: structurally absent slot (bye padding or empty). */
export const SEED_ABSENT = Symbol('SEED_ABSENT');

export type SeedSlot = string | typeof SEED_TBD | typeof SEED_ABSENT;

/**
 * Strategy object carrying bracket identity. Pass to `computeBracketNodes`
 * so callers never need to branch on bracket type themselves.
 */
export type BracketConfig = {
  side: 'winners' | 'consolation';
  setup: EliminationSetup;
};

/**
 * A single node in the bracket tree visualization.
 *
 * - `match`: a real match with two known teams.
 * - `bye-advance`: one team advances automatically (no opponent).
 * - `tbd`: teams not yet determined but will be (pending match results).
 * - `empty`: structurally absent slot (e.g. null-null seeding pair) — never produces an advancer.
 */
export interface BracketNode {
  type: 'match' | 'bye-advance' | 'tbd' | 'empty';
  match?: TournamentMatch;
  team1: TournamentTeam | null;
  team2: TournamentTeam | null;
}
