export type TournamentFormat = 'singles' | 'doubles';
export type TournamentType = 'round-robin' | 'elimination';
export type TournamentPhase = 'setup' | 'active' | 'completed';
/**
 * Which bracket a match belongs to in a consolation-bracket elimination tournament.
 *
 * - `wb` — Winners Bracket: teams that have not yet lost. A loss here drops
 *   the team into the consolation bracket instead of eliminating them.
 *   The WB Final winner is the tournament champion (1st place), and the WB
 *   Final loser takes 2nd place without playing consolation.
 * - `lb` — Consolation Bracket: teams that have lost exactly once. A second
 *   loss here eliminates the team. The consolation final winner takes 3rd place.
 *
 * Absent or `undefined` is treated as `'wb'` for backward compatibility.
 */
export type MatchBracket = 'wb' | 'lb';

export interface TournamentTeam {
  id: string;
  playerIds: string[];
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
