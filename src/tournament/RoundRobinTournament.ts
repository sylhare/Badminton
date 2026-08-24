import type { Player } from '../types';
import { shuffleArray } from '../utils/playerUtils';

import { Tournament } from './Tournament';
import type {
  TournamentCreateOptions,
  TournamentFormat,
  TournamentMatch,
  TournamentStandingRow,
  TournamentState,
  TournamentTeam,
} from './types';
import { DEFAULT_SET_SIZE, DEFAULT_TOURNAMENT_STATE } from './types';
import { roundRobinPairings } from './schedule';
import { makeId } from './ids';

function generateMatches(teams: TournamentTeam[], numberOfCourts: number): TournamentMatch[] {
  return roundRobinPairings(teams).map((pairing, i) => ({
    id: makeId('match', i),
    round: pairing.round,
    courtNumber: (i % numberOfCourts) + 1,
    team1: pairing.team1,
    team2: pairing.team2,
    sets: [],
  }));
}

export class RoundRobinTournament extends Tournament {
  static create(options: TournamentCreateOptions = {}): RoundRobinTournament {
    const { format = 'doubles', numberOfCourts = 4, bestOf = 1, setSize = DEFAULT_SET_SIZE } = options;
    return new RoundRobinTournament({
      ...DEFAULT_TOURNAMENT_STATE,
      format,
      numberOfCourts,
      bestOf,
      setSize,
    });
  }

  static fromState(state: TournamentState): RoundRobinTournament {
    return new RoundRobinTournament(state);
  }

  static createTeams(players: Player[], format: TournamentFormat): TournamentTeam[] {
    if (format === 'singles') {
      return players.map((p, i) => ({ id: makeId('team', i), players: [p] }));
    }
    const teams: TournamentTeam[] = [];
    for (let i = 0; i < players.length; i += 2) {
      teams.push({ id: makeId('team', i), players: players.slice(i, i + 2) });
    }
    return teams;
  }

  static matchesPerRound(teams: TournamentTeam[]): number {
    return Math.floor(teams.length / 2);
  }

  start(teams: TournamentTeam[], numberOfCourts: number): RoundRobinTournament {
    const shuffled = shuffleArray(teams);
    return new RoundRobinTournament({
      ...this._state,
      teams: shuffled,
      numberOfCourts,
      matches: generateMatches(shuffled, numberOfCourts),
    });
  }

  calculateStandings(): TournamentStandingRow[] {
    const standings = this.tallyStandings(2);
    return Array.from(standings.values()).sort(this.orderStandings([
      (a, b) => b.points - a.points,
      (a, b) => b.setDiff - a.setDiff,
      (a, b) => b.scoreDiff - a.scoreDiff,
      (a, b) => this.compareByTeamName(a, b),
    ]));
  }

  completedRounds(): number {
    let completed = 0;
    for (const round of this.roundNumbers()) {
      if (!this.isRoundComplete(round)) break;
      completed = round;
    }
    return completed;
  }

  totalRounds(): number {
    const { matches } = this._state;
    if (matches.length === 0) return 0;
    return Math.max(...matches.map(m => m.round));
  }

  roundNumbers(): number[] {
    return Array.from(new Set(this._state.matches.map(m => m.round))).sort((a, b) => a - b);
  }

  matchesForRound(round: number): TournamentMatch[] {
    return this._state.matches.filter(m => m.round === round);
  }

  isRoundComplete(round: number): boolean {
    return this.matchesForRound(round).every(m => m.winner !== undefined);
  }

  isComplete(): boolean {
    return this.allDecided();
  }

  currentRound(): number {
    const rounds = this.roundNumbers();
    for (const r of rounds) {
      if (!this.isRoundComplete(r)) return r;
    }
    return rounds[rounds.length - 1] ?? 1;
  }
}
