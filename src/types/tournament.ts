import type { Player } from './index';

export type TournamentFormat = 'singles' | 'doubles';
export type TournamentType = 'round-robin' | 'double-elimination';
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
  score?: { team1: number; team2: number };
  bracket?: 'winners' | 'losers' | 'grand-final';
}

export interface TournamentStandingRow {
  team: TournamentTeam;
  played: number;
  won: number;
  lost: number;
  points: number;
  scoreDiff: number;
}

export interface DEBracket {
  wbSlots: string[];
  lbSlots: string[];
}

export interface TournamentState {
  phase: TournamentPhase;
  format: TournamentFormat;
  type: TournamentType;
  numberOfCourts: number;
  teams: TournamentTeam[];
  matches: TournamentMatch[];
  deBracket?: DEBracket;
}

export const DEFAULT_TOURNAMENT_STATE: TournamentState = {
  phase: 'setup',
  format: 'doubles',
  type: 'round-robin',
  numberOfCourts: 4,
  teams: [],
  matches: [],
};
