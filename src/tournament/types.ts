import type { Player } from '../types';

export type TournamentFormat = 'singles' | 'doubles';

export enum BracketKind {
  Winners = 'winners',
  Consolation = 'consolation',
  ThirdPlace = 'third-place',
}
export type TournamentType = 'round-robin' | 'elimination';
export type TournamentPhase = 'setup' | 'active' | 'completed';

export interface TournamentTeam {
  id: string;
  players: Player[];
}

/** Points scored by each side within a single set. */
export interface SetScore {
  team1: number;
  team2: number;
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
  phase: TournamentPhase;
  format: TournamentFormat;
  type: TournamentType;
  numberOfCourts: number;
  teams: TournamentTeam[];
  matches: TournamentMatch[];
  bracketSize?: number;
  /** Sets needed to win a match; the winner is the first to take a majority. Defaults to 1. */
  bestOf?: number;
}

export function formatTeamName(team: TournamentTeam): string {
  return team.players.map(p => p.name).join(' & ');
}

/** Sets won by each side across a list of sets. */
export function tallySets(sets: SetScore[]): SetScore {
  let team1 = 0;
  let team2 = 0;
  for (const set of sets) {
    if (set.team1 > set.team2) team1++;
    else if (set.team2 > set.team1) team2++;
  }
  return { team1, team2 };
}

/** Side that took more sets; undefined on a tie or when no sets were recorded. */
export function winningSide(sets: SetScore[]): 1 | 2 | undefined {
  const { team1, team2 } = tallySets(sets);
  if (team1 > team2) return 1;
  if (team2 > team1) return 2;
  return undefined;
}

/** Sets won by each side of a match. */
export function setsWonBy(match: TournamentMatch): SetScore {
  return tallySets(match.sets);
}

/** Total points scored by each side across every set of a match. */
export function totalPoints(match: TournamentMatch): SetScore {
  return match.sets.reduce(
    (acc, set) => ({ team1: acc.team1 + set.team1, team2: acc.team2 + set.team2 }),
    { team1: 0, team2: 0 },
  );
}

/** Winner implied by the sets played; undefined on a tie or when no sets were recorded. */
export function winnerFromSets(match: TournamentMatch): 1 | 2 | undefined {
  return winningSide(match.sets);
}

export const DEFAULT_TOURNAMENT_STATE: TournamentState = {
  phase: 'setup',
  format: 'doubles',
  type: 'round-robin',
  numberOfCourts: 4,
  teams: [],
  matches: [],
  bestOf: 1,
};
