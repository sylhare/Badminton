import type { Player } from '../types';

export type TournamentFormat = 'singles' | 'doubles';
export type TournamentType = 'round-robin' | 'elimination';
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
  bracket?: 'wb' | 'cb';
}

export interface TournamentStandingRow {
  team: TournamentTeam;
  played: number;
  won: number;
  lost: number;
  points: number;
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
}

export const DEFAULT_TOURNAMENT_STATE: TournamentState = {
  phase: 'setup',
  format: 'doubles',
  type: 'round-robin',
  numberOfCourts: 4,
  teams: [],
  matches: [],
};
