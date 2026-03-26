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
import { RoundRobinTournament } from './RoundRobinTournament';

export function nextPowerOf2(n: number): number {
  if (n <= 1) return 1;
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function makeMatchId(index: number): string {
  return `elim-match-${Date.now()}-${index}`;
}

function makeMatch(
  bracket: 'wb' | 'cb',
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

function roundComplete(matches: TournamentMatch[], round: number): boolean {
  const roundMatches = matches.filter(m => m.round === round);
  return roundMatches.length > 0 && roundMatches.every(m => m.winner !== undefined);
}

type PositionResult = TournamentTeam | 'bye' | 'tbd';

function resolveChildNode(
  round: number,
  resultA: PositionResult,
  resultB: PositionResult,
  matches: TournamentMatch[],
): PositionResult {
  if (resultA === 'bye' && resultB === 'bye') return 'bye';
  if (resultA === 'bye') return resultB;
  if (resultB === 'bye') return resultA;
  if (resultA === 'tbd' || resultB === 'tbd') return 'tbd';

  const match = matches.find(
    m =>
      m.round === round &&
      ((m.team1.id === (resultA as TournamentTeam).id &&
        m.team2.id === (resultB as TournamentTeam).id) ||
        (m.team1.id === (resultB as TournamentTeam).id &&
          m.team2.id === (resultA as TournamentTeam).id)),
  );
  if (!match || match.winner === undefined) return 'tbd';
  return match.winner === 1 ? match.team1 : match.team2;
}

/**
 * Returns the team that wins a given bracket position (round, positionInRound),
 * or 'bye' if the slot produces no team (empty), or 'tbd' if undecided.
 */
export function resolvePosition(
  round: number,
  position: number,
  seeds: TournamentTeam[],
  matches: TournamentMatch[],
): PositionResult {
  if (round === 1) {
    const team1 = seeds[2 * position];
    const team2 = seeds[2 * position + 1];

    if (!team1 && !team2) return 'bye';
    if (!team1) return team2;
    if (!team2) return team1;

    const match = matches.find(
      m =>
        m.round === 1 &&
        ((m.team1.id === team1.id && m.team2.id === team2.id) ||
          (m.team1.id === team2.id && m.team2.id === team1.id)),
    );
    if (!match || match.winner === undefined) return 'tbd';
    return match.winner === 1 ? match.team1 : match.team2;
  }

  const resultA = resolvePosition(round - 1, 2 * position, seeds, matches);
  const resultB = resolvePosition(round - 1, 2 * position + 1, seeds, matches);
  return resolveChildNode(round, resultA, resultB, matches);
}

/**
 * Returns the loser of a WB R1 position, or null if no match / no result yet.
 */
function getWBR1Loser(
  position: number,
  teams: TournamentTeam[],
  wbMatches: TournamentMatch[],
): TournamentTeam | null {
  const team1 = teams[2 * position];
  const team2 = teams[2 * position + 1];
  if (!team1 || !team2) return null;
  const match = wbMatches.find(
    m =>
      m.round === 1 &&
      ((m.team1.id === team1.id && m.team2.id === team2.id) ||
        (m.team1.id === team2.id && m.team2.id === team1.id)),
  );
  if (!match || match.winner === undefined) return null;
  return match.winner === 1 ? match.team2 : match.team1;
}

function generateWBRound1(
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
      matches.push(makeMatch('wb', 1, team1, team2, courtIndex, numberOfCourts));
      courtIndex++;
    }
  }
  return matches;
}

/**
 * Generates any new matches triggered by the latest result.
 * WB next rounds are seeded from WB winners; CB R1 is seeded from WB R1 losers.
 * When CB has fewer survivors than needed for a round (e.g. 5-player: 2 WB R1 losers
 * produce 1 CB R1 match → 1 survivor, but CB Final needs 2), the loser of WB R(n+1)
 * drops into CB — unless that round is the WB Final (WB Final loser is runner-up).
 */
function generateFollowUpMatches(
  teams: TournamentTeam[],
  bracketSize: number,
  allMatches: TournamentMatch[],
  numberOfCourts: number,
): TournamentMatch[] {
  const newMatches: TournamentMatch[] = [];
  const wbMatches = allMatches.filter(m => m.bracket === 'wb');
  const cbMatches = allMatches.filter(m => m.bracket === 'cb');
  const totalWBRounds = Math.log2(bracketSize);

  for (let n = 1; n < totalWBRounds; n++) {
    if (!roundComplete(wbMatches, n)) break;
    if (roundExists(wbMatches, n + 1)) continue;

    const nextRoundPositions = bracketSize / Math.pow(2, n + 1);
    let courtIndex = allMatches.length + newMatches.length;
    const wbMatchesSoFar = [...wbMatches, ...newMatches.filter(m => m.bracket === 'wb')];
    for (let pos = 0; pos < nextRoundPositions; pos++) {
      const teamA = resolvePosition(n, 2 * pos, teams, wbMatchesSoFar);
      const teamB = resolvePosition(n, 2 * pos + 1, teams, wbMatchesSoFar);
      if (teamA !== 'bye' && teamA !== 'tbd' && teamB !== 'bye' && teamB !== 'tbd') {
        newMatches.push(makeMatch('wb', n + 1, teamA, teamB, courtIndex, numberOfCourts));
        courtIndex++;
      }
    }
    break;
  }

  if (roundComplete(wbMatches, 1) && !roundExists(cbMatches, 1)) {
    const losers: TournamentTeam[] = [];
    for (let pos = 0; pos < bracketSize / 2; pos++) {
      const loser = getWBR1Loser(pos, teams, wbMatches);
      if (loser) losers.push(loser);
    }

    if (losers.length >= 2) {
      let courtIndex = allMatches.length + newMatches.length;
      for (let i = 0; i < Math.floor(losers.length / 2); i++) {
        newMatches.push(makeMatch('cb', 1, losers[2 * i], losers[2 * i + 1], courtIndex, numberOfCourts));
        courtIndex++;
      }
    }
  }

  const cbRounds = Array.from(new Set(cbMatches.map(m => m.round))).sort((a, b) => a - b);
  const maxCBRound = cbRounds.length > 0 ? Math.max(...cbRounds) : 0;

  for (let n = 1; n <= maxCBRound; n++) {
    if (!roundComplete(cbMatches, n)) break;
    if (roundExists(cbMatches, n + 1)) continue;

    const cbMatchesSoFar = [...cbMatches, ...newMatches.filter(m => m.bracket === 'cb')]
      .filter(m => m.round === n);

    const advancers: TournamentTeam[] = cbMatchesSoFar
      .filter(m => m.winner !== undefined)
      .map(m => m.winner === 1 ? m.team1 : m.team2);

    if (n === 1) {
      const cbR1TeamIds = new Set(cbMatchesSoFar.flatMap(m => [m.team1.id, m.team2.id]));
      for (let pos = 0; pos < bracketSize / 2; pos++) {
        const loser = getWBR1Loser(pos, teams, wbMatches);
        if (loser && !cbR1TeamIds.has(loser.id)) advancers.push(loser);
      }
    }

    if (advancers.length < 2 && n + 1 < totalWBRounds && roundComplete(wbMatches, n + 1)) {
      for (const m of wbMatches.filter(m => m.round === n + 1 && m.winner !== undefined)) {
        advancers.push(m.winner === 1 ? m.team2 : m.team1);
      }
    }

    if (advancers.length >= 2) {
      let courtIndex = allMatches.length + newMatches.length;
      for (let i = 0; i < Math.floor(advancers.length / 2); i++) {
        newMatches.push(makeMatch('cb', n + 1, advancers[2 * i], advancers[2 * i + 1], courtIndex, numberOfCourts));
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
    const matches = generateWBRound1(teams, bracketSize, numberOfCourts);
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
    const wbMatches = this.wbMatches();
    if (wbMatches.length === 0) return 0;

    const roundNums = Array.from(new Set(wbMatches.map(m => m.round))).sort((a, b) => a - b);
    let completed = 0;
    for (const r of roundNums) {
      if (roundComplete(wbMatches, r)) {
        completed = r;
      } else {
        break;
      }
    }
    return completed;
  }

  totalRounds(): number {
    const { bracketSize } = this._state;
    if (!bracketSize) return 0;
    return Math.log2(bracketSize);
  }

  bracketSize(): number {
    return this._state.bracketSize ?? nextPowerOf2(this._state.teams.length);
  }

  private matchesFor(bracket: 'wb' | 'cb', round?: number): TournamentMatch[] {
    return this._state.matches.filter(
      m => m.bracket === bracket && (round === undefined || m.round === round),
    );
  }

  wbMatchesForRound(round: number): TournamentMatch[] {
    return this.matchesFor('wb', round);
  }

  cbMatchesForRound(round: number): TournamentMatch[] {
    return this.matchesFor('cb', round);
  }

  wbMatches(): TournamentMatch[] {
    return this.matchesFor('wb');
  }

  cbMatches(): TournamentMatch[] {
    return this.matchesFor('cb');
  }

  isComplete(): boolean {
    const { matches } = this._state;
    if (matches.length === 0) return false;
    return matches.every(m => m.winner !== undefined);
  }

  cbTotalRounds(): number {
    const cb = this.cbMatches();
    if (cb.length === 0) return 0;
    return Math.max(...cb.map(m => m.round));
  }

  /** Returns the WB R1 losers in position order (for CB seeding). */
  wbR1Losers(): TournamentTeam[] {
    const { teams, bracketSize } = this._state;
    const bSize = bracketSize ?? nextPowerOf2(teams.length);
    const wbR1 = this.wbMatchesForRound(1);
    const losers: TournamentTeam[] = [];
    for (let pos = 0; pos < bSize / 2; pos++) {
      const loser = getWBR1Loser(pos, teams, wbR1);
      if (loser) losers.push(loser);
    }
    return losers;
  }
}
