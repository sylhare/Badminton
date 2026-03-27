import type { Player } from '../types';

import { Tournament } from './Tournament';
import { BracketKind, DEFAULT_TOURNAMENT_STATE } from './types';
import type {
  TournamentFormat,
  TournamentMatch,
  TournamentStandingRow,
  TournamentState,
  TournamentTeam,
} from './types';
import { RoundRobinTournament } from './RoundRobinTournament';
import {
  ConsolationBracket,
  WinnersBracket,
  getWinnersFirstRoundLoser,
  nextPowerOf2,
  resolvePosition,
  roundComplete,
} from './bracketTree';

function makeMatchId(index: number): string {
  return `elim-match-${Date.now()}-${index}`;
}

function makeMatch(
  bracket: BracketKind,
  round: number,
  team1: TournamentTeam,
  team2: TournamentTeam,
  courtIndex: number,
  numberOfCourts: number,
): TournamentMatch {
  return {
    id: makeMatchId(courtIndex),
    round,
    courtNumber: (courtIndex % numberOfCourts) + 1,
    team1,
    team2,
    bracket,
  };
}

function roundExists(matches: TournamentMatch[], round: number): boolean {
  return matches.some(m => m.round === round);
}

function generateWinnersFirstRound(
  teams: TournamentTeam[],
  bracketSize: number,
  numberOfCourts: number,
): TournamentMatch[] {
  const matches: TournamentMatch[] = [];
  let courtIndex = 0;
  for (let pos = 0; pos < bracketSize / 2; pos++) {
    const team1 = teams[2 * pos];
    const team2 = teams[2 * pos + 1];
    if (team1 && team2) {
      matches.push(makeMatch(BracketKind.Winners, 1, team1, team2, courtIndex, numberOfCourts));
      courtIndex++;
    }
  }
  return matches;
}

function generateFollowUpMatches(
  teams: TournamentTeam[],
  bracketSize: number,
  allMatches: TournamentMatch[],
  numberOfCourts: number,
): TournamentMatch[] {
  const newMatches: TournamentMatch[] = [];
  const winnersMatches = allMatches.filter(m => m.bracket === BracketKind.Winners);
  const consolationMatches = allMatches.filter(m => m.bracket === BracketKind.Consolation);
  const totalWBRounds = Math.log2(bracketSize);

  for (let n = 1; n < totalWBRounds; n++) {
    if (!roundComplete(winnersMatches, n)) break;
    if (roundExists(winnersMatches, n + 1)) continue;

    const nextRoundPositions = bracketSize / Math.pow(2, n + 1);
    let courtIndex = allMatches.length + newMatches.length;
    const winnersMatchesSoFar = [...winnersMatches, ...newMatches.filter(m => m.bracket === BracketKind.Winners)];
    for (let pos = 0; pos < nextRoundPositions; pos++) {
      const teamA = resolvePosition(n, 2 * pos, teams, winnersMatchesSoFar);
      const teamB = resolvePosition(n, 2 * pos + 1, teams, winnersMatchesSoFar);
      if (teamA !== 'bye' && teamA !== 'tbd' && teamB !== 'bye' && teamB !== 'tbd') {
        newMatches.push(makeMatch(BracketKind.Winners, n + 1, teamA, teamB, courtIndex, numberOfCourts));
        courtIndex++;
      }
    }
    break;
  }

  if (roundComplete(winnersMatches, 1) && !roundExists(consolationMatches, 1)) {
    const losers: TournamentTeam[] = [];
    for (let pos = 0; pos < bracketSize / 2; pos++) {
      const loser = getWinnersFirstRoundLoser(pos, teams, winnersMatches);
      if (loser) losers.push(loser);
    }

    if (losers.length >= 2) {
      let courtIndex = allMatches.length + newMatches.length;
      for (let i = 0; i < Math.floor(losers.length / 2); i++) {
        newMatches.push(makeMatch(BracketKind.Consolation, 1, losers[2 * i], losers[2 * i + 1], courtIndex, numberOfCourts));
        courtIndex++;
      }
    }
  }

  const maxCBRound = consolationMatches.length > 0 ? Math.max(...consolationMatches.map(m => m.round)) : 0;

  for (let n = 1; n <= maxCBRound; n++) {
    if (!roundComplete(consolationMatches, n)) break;
    if (roundExists(consolationMatches, n + 1)) continue;

    const consolationMatchesSoFar = [...consolationMatches, ...newMatches.filter(m => m.bracket === BracketKind.Consolation)]
      .filter(m => m.round === n);

    const advancers: TournamentTeam[] = consolationMatchesSoFar
      .filter(m => m.winner !== undefined)
      .map(m => m.winner === 1 ? m.team1 : m.team2);

    if (n === 1) {
      const cbR1TeamIds = new Set(consolationMatchesSoFar.flatMap(m => [m.team1.id, m.team2.id]));
      for (let pos = 0; pos < bracketSize / 2; pos++) {
        const loser = getWinnersFirstRoundLoser(pos, teams, winnersMatches);
        if (loser && !cbR1TeamIds.has(loser.id)) advancers.push(loser);
      }
    }

    if (advancers.length < 2 && n + 1 < totalWBRounds && roundComplete(winnersMatches, n + 1)) {
      for (const m of winnersMatches.filter(m => m.round === n + 1 && m.winner !== undefined)) {
        advancers.push(m.winner === 1 ? m.team2 : m.team1);
      }
    }

    if (advancers.length >= 2) {
      let courtIndex = allMatches.length + newMatches.length;
      for (let i = 0; i < Math.floor(advancers.length / 2); i++) {
        newMatches.push(makeMatch(BracketKind.Consolation, n + 1, advancers[2 * i], advancers[2 * i + 1], courtIndex, numberOfCourts));
        courtIndex++;
      }
    }
    break;
  }

  return newMatches;
}

export class EliminationTournament extends Tournament {
  static create(
    format: TournamentFormat = 'doubles',
    numberOfCourts = 4,
  ): EliminationTournament {
    return new EliminationTournament({
      ...DEFAULT_TOURNAMENT_STATE,
      type: 'elimination',
      format,
      numberOfCourts,
    });
  }

  static fromState(state: TournamentState): EliminationTournament {
    return new EliminationTournament(state);
  }

  static createTeams(players: Player[], format: TournamentFormat): TournamentTeam[] {
    return RoundRobinTournament.createTeams(players, format);
  }

  start(teams: TournamentTeam[], numberOfCourts: number): EliminationTournament {
    const bracketSize = nextPowerOf2(teams.length);
    const matches = generateWinnersFirstRound(teams, bracketSize, numberOfCourts);
    return new EliminationTournament({
      ...this._state,
      phase: 'active',
      teams,
      numberOfCourts,
      bracketSize,
      matches,
    });
  }

  override withMatchResult(
    matchId: string,
    winner: 1 | 2,
    score?: { team1: number; team2: number },
  ): this {
    const updatedMatches = this._state.matches.map(m =>
      m.id === matchId ? { ...m, winner, score: score ?? m.score } : m,
    );
    const { teams, bracketSize, numberOfCourts } = this._state;
    const followUp = generateFollowUpMatches(
      teams,
      bracketSize ?? nextPowerOf2(teams.length),
      updatedMatches,
      numberOfCourts,
    );
    const updated = new EliminationTournament({ ...this._state, matches: [...updatedMatches, ...followUp] });
    const phase = updated.isComplete() ? 'completed' : 'active';
    return new EliminationTournament({ ...updated._state, phase }) as unknown as this;
  }

  get winners(): WinnersBracket {
    return new WinnersBracket(
      this._state.teams,
      this._state.matches.filter(m => m.bracket === BracketKind.Winners),
      this._state.bracketSize ?? nextPowerOf2(this._state.teams.length),
    );
  }

  get consolation(): ConsolationBracket {
    return new ConsolationBracket(
      this.winners.firstRoundLosers(),
      this._state.matches.filter(m => m.bracket === BracketKind.Consolation),
      this._state.bracketSize ?? nextPowerOf2(this._state.teams.length),
    );
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
        row2.lost++;
      } else {
        row2.won++;
        row1.lost++;
      }

      if (match.score) {
        const diff = match.score.team1 - match.score.team2;
        row1.scoreDiff += diff;
        row2.scoreDiff -= diff;
      }
    }

    return Array.from(standings.values()).sort((a, b) => {
      if (a.lost !== b.lost) return a.lost - b.lost;
      if (b.won !== a.won) return b.won - a.won;
      const nameA = a.team.players[0]?.name ?? '';
      const nameB = b.team.players[0]?.name ?? '';
      return nameA.localeCompare(nameB);
    });
  }

  completedRounds(): number {
    return this.winners.completedRounds();
  }

  totalRounds(): number {
    return this.winners.totalRounds();
  }

  bracketSize(): number {
    return this._state.bracketSize ?? nextPowerOf2(this._state.teams.length);
  }

  isComplete(): boolean {
    const { matches } = this._state;
    if (matches.length === 0) return false;
    return matches.every(m => m.winner !== undefined);
  }
}
