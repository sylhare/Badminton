import type { TournamentMatch, TournamentTeam } from '../../../types/tournament';

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
export function wbTop(roundIdx: number, matchIdx: number): number {
  const slots = 1 << roundIdx;
  return matchIdx * slots * SH + ((slots - 1) * SH) / 2;
}

/**
 * A single node in the bracket tree visualization.
 *
 * - `match`: a real match with two known teams.
 * - `bye-advance`: one team advances automatically (no opponent).
 * - `tbd`: teams not yet determined.
 */
export interface BracketNode {
  type: 'match' | 'bye-advance' | 'tbd';
  match?: TournamentMatch;
  team1: TournamentTeam | null;
  team2: TournamentTeam | null;
}
