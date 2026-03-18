import type { Player } from './index';

export type TournamentFormat = 'singles' | 'doubles';
export type TournamentType = 'round-robin' | 'elimination';
export type TournamentPhase = 'setup' | 'active' | 'completed';
/**
 * Which bracket a match belongs to in a double-elimination tournament.
 *
 * - `wb` — Winners Bracket: teams that have not yet lost. A loss here drops
 *   the team into the Losers Bracket instead of eliminating them.
 * - `lb` — Losers Bracket: teams that have lost exactly once. A second loss
 *   here eliminates the team entirely.
 * - `gf` — Grand Final: the single match between the Winners Bracket champion
 *   (undefeated) and the Losers Bracket champion (one loss). The winner is
 *   the tournament champion.
 *
 * Absent or `undefined` is treated as `'wb'` for backward compatibility.
 */
export type MatchBracket = 'wb' | 'lb' | 'gf';

export interface TournamentTeam {
  id: string;
  players: Player[];
}

export interface TournamentMatch {
  id: string;
  round: number;
  /** Which bracket this match belongs to. Absent/undefined defaults to `'wb'`. */
  bracket?: MatchBracket;
  courtNumber: number;
  team1: TournamentTeam;
  team2: TournamentTeam;
  winner?: 1 | 2;
  score?: { team1: number; team2: number };
}

export interface TournamentStandingRow {
  team: TournamentTeam;
  played: number;
  won: number;
  lost: number;
  points: number;
  scoreDiff: number;
}

export interface SEBracket {
  size: number;
  seeding: (string | null)[];
}

export interface TournamentState {
  phase: TournamentPhase;
  format: TournamentFormat;
  type: TournamentType;
  numberOfCourts: number;
  teams: TournamentTeam[];
  matches: TournamentMatch[];
  seBracket?: SEBracket;
}

export const DEFAULT_TOURNAMENT_STATE: TournamentState = {
  phase: 'setup',
  format: 'doubles',
  type: 'round-robin',
  numberOfCourts: 4,
  teams: [],
  matches: [],
};
