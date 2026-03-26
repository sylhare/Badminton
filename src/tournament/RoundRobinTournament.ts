import type { Player } from '../types';

import { Tournament } from './Tournament';
import type {
  TournamentFormat,
  TournamentMatch,
  TournamentStandingRow,
  TournamentState,
  TournamentTeam,
} from './types';
import { DEFAULT_TOURNAMENT_STATE } from './types';

function makeTeamId(index: number): string {
  return `team-${Date.now()}-${index}`;
}

function makeMatchId(index: number): string {
  return `match-${Date.now()}-${index}`;
}

function generateMatches(teams: TournamentTeam[], numberOfCourts: number): TournamentMatch[] {
  const n = teams.length;
  if (n < 2) return [];

  const hasBye = n % 2 !== 0;
  const paddedTeams: (TournamentTeam | null)[] = hasBye ? [...teams, null] : [...teams];
  const m = paddedTeams.length;

  const matches: TournamentMatch[] = [];
  let matchIndex = 0;

  const rotating = paddedTeams.slice(1);

  for (let round = 0; round < m - 1; round++) {
    const roundTeams = [paddedTeams[0], ...rotating];

    for (let i = 0; i < m / 2; i++) {
      const t1 = roundTeams[i];
      const t2 = roundTeams[m - 1 - i];

      if (t1 === null || t2 === null) continue;

      matches.push({
        id: makeMatchId(matchIndex),
        round: round + 1,
        courtNumber: (matchIndex % numberOfCourts) + 1,
        team1: t1,
        team2: t2,
      });
      matchIndex++;
    }

    const last = rotating.pop()!;
    rotating.unshift(last);
  }

  return matches;
}

export class RoundRobinTournament extends Tournament {
  static create(
    format: TournamentFormat = 'doubles',
    numberOfCourts = 4,
  ): RoundRobinTournament {
    return new RoundRobinTournament({
      ...DEFAULT_TOURNAMENT_STATE,
      format,
      numberOfCourts,
    });
  }

  static fromState(state: TournamentState): RoundRobinTournament {
    return new RoundRobinTournament(state);
  }

  static createTeams(players: Player[], format: TournamentFormat): TournamentTeam[] {
    if (format === 'singles') {
      return players.map((p, i) => ({ id: makeTeamId(i), players: [p] }));
    }
    const teams: TournamentTeam[] = [];
    for (let i = 0; i < players.length; i += 2) {
      teams.push({ id: makeTeamId(i), players: players.slice(i, i + 2) });
    }
    return teams;
  }

  static matchesPerRound(teams: TournamentTeam[]): number {
    return Math.floor(teams.length / 2);
  }

  start(teams: TournamentTeam[], numberOfCourts: number): RoundRobinTournament {
    return new RoundRobinTournament({
      ...this._state,
      phase: 'active',
      teams,
      numberOfCourts,
      matches: generateMatches(teams, numberOfCourts),
    });
  }

  calculateStandings(): TournamentStandingRow[] {
    const { teams, matches } = this._state;
    const standings = new Map<string, TournamentStandingRow>();

    for (const team of teams) {
      standings.set(team.id, { team, played: 0, won: 0, lost: 0, points: 0, scoreDiff: 0 });
    }

    for (const match of matches) {
      if (match.winner === undefined) continue;

      const row1 = standings.get(match.team1.id);
      const row2 = standings.get(match.team2.id);
      if (!row1 || !row2) continue;

      row1.played++;
      row2.played++;

      if (match.winner === 1) {
        row1.won++;
        row1.points += 2;
        row2.lost++;
      } else {
        row2.won++;
        row2.points += 2;
        row1.lost++;
      }

      if (match.score) {
        const diff = match.score.team1 - match.score.team2;
        row1.scoreDiff += diff;
        row2.scoreDiff -= diff;
      }
    }

    return Array.from(standings.values()).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.scoreDiff !== a.scoreDiff) return b.scoreDiff - a.scoreDiff;
      const nameA = a.team.players[0]?.name ?? '';
      const nameB = b.team.players[0]?.name ?? '';
      return nameA.localeCompare(nameB);
    });
  }

  completedRounds(): number {
    const { matches } = this._state;
    if (matches.length === 0) return 0;

    const roundMap = new Map<number, TournamentMatch[]>();
    for (const match of matches) {
      if (!roundMap.has(match.round)) roundMap.set(match.round, []);
      roundMap.get(match.round)!.push(match);
    }

    let completed = 0;
    const sortedRounds = Array.from(roundMap.keys()).sort((a, b) => a - b);

    for (const round of sortedRounds) {
      const roundMatches = roundMap.get(round)!;
      if (roundMatches.every(m => m.winner !== undefined)) {
        completed = round;
      } else {
        break;
      }
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
    return this._state.matches.length > 0 && this._state.matches.every(m => m.winner !== undefined);
  }

  currentRound(): number {
    const rounds = this.roundNumbers();
    for (const r of rounds) {
      if (this.matchesForRound(r).some(m => m.winner === undefined)) return r;
    }
    return rounds[rounds.length - 1] ?? 1;
  }
}
