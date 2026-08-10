import type { Player, SetScore } from '../types';
import { DEFAULT_SET_SIZE, formatPlayerNames } from '../types';

export type { SetScore };
export { DEFAULT_SET_SIZE };

export type TournamentFormat = 'singles' | 'doubles';

export enum BracketKind {
  Winners = 'winners',
  Consolation = 'consolation',
  ThirdPlace = 'third-place',
}
export type TournamentType = 'round-robin' | 'elimination' | 'group-knockout';
export type TournamentPhase = 'setup' | 'active' | 'completed';

export interface TournamentTeam {
  id: string;
  players: Player[];
}

export interface TournamentMatch {
  id: string;
  round: number;
  courtNumber: number;
  team1: TournamentTeam;
  team2: TournamentTeam;
  winner?: 1 | 2;
  /** One entry per set played; empty while the match is undecided or was won without a score. */
  sets: SetScore[];
  bracket?: BracketKind;
  /** Group index (0-based) for a group-stage match; absent for knockout/bracket matches. */
  group?: number;
}

export interface TournamentStandingRow {
  team: TournamentTeam;
  played: number;
  won: number;
  lost: number;
  points: number;
  /** Set-win differential (sets won minus sets lost) across all decided matches. */
  setDiff: number;
  /** Total-point differential across every set of every decided match. */
  scoreDiff: number;
}

export interface TournamentState {
  format: TournamentFormat;
  type: TournamentType;
  numberOfCourts: number;
  teams: TournamentTeam[];
  matches: TournamentMatch[];
  bracketSize?: number;
  /** Total sets in a match (best-of-N); the winner is the side that takes a majority. Defaults to 1. */
  bestOf: number;
  /** Points a side plays to in a single set (used for the modal's default scores). Defaults to 21. */
  setSize?: number;
  /** group-knockout: target teams per group in the round-robin phase. */
  groupSize?: number;
  /** group-knockout: how many teams advance from each group to the knockout bracket. */
  qualifiersPerGroup?: number;
  /**
   * User-set tie-break points, keyed by team id (higher = ranked higher). Awarded when the
   * user manually orders a tie the metrics can't split (equal wins/points/set-diff/score-diff),
   * and fed into the standings sort as one more descending-points step — so the existing
   * comparator resolves the tie with no bespoke logic. Two teams are ordered only when *both*
   * carry manual points; teams without an entry keep their computed order.
   */
  manualPoints?: Record<string, number>;
}

export function formatTeamName(team: TournamentTeam): string {
  return formatPlayerNames(team.players);
}

/** True when two standing rows are level on every metric the standings rank by. */
export function standingsTied(a: TournamentStandingRow, b: TournamentStandingRow): boolean {
  return a.points === b.points && a.setDiff === b.setDiff && a.scoreDiff === b.scoreDiff;
}

export const DEFAULT_TOURNAMENT_STATE: TournamentState = {
  format: 'doubles',
  type: 'round-robin',
  numberOfCourts: 4,
  teams: [],
  matches: [],
  bestOf: 1,
};
