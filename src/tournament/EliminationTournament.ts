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

let _matchCounter = 0;

function makeMatchId(): string {
  return `elim-match-${Date.now()}-${_matchCounter++}`;
}

/**
 * Returns the team that wins a given WB position (round, positionInRound),
 * or 'bye' if the slot produces no team (empty), or 'tbd' if undecided.
 */
function getWBPositionResult(
  round: number,
  position: number,
  teams: TournamentTeam[],
  wbMatches: TournamentMatch[],
): TournamentTeam | 'bye' | 'tbd' {
  if (round === 1) {
    const slot1 = 2 * position;
    const slot2 = 2 * position + 1;
    const team1 = teams[slot1];
    const team2 = teams[slot2];

    if (!team1 && !team2) return 'bye'; // both slots are byes → empty
    if (!team1) return team2; // team1 slot is bye → team2 auto-advances
    if (!team2) return team1; // team2 slot is bye → team1 auto-advances

    // Both real teams: find the match and return winner
    const match = wbMatches.find(
      m =>
        m.round === 1 &&
        ((m.team1.id === team1.id && m.team2.id === team2.id) ||
          (m.team1.id === team2.id && m.team2.id === team1.id)),
    );
    if (!match || match.winner === undefined) return 'tbd';
    return match.winner === 1 ? match.team1 : match.team2;
  }

  // Higher rounds: get results from the two parent positions
  const resultA = getWBPositionResult(round - 1, 2 * position, teams, wbMatches);
  const resultB = getWBPositionResult(round - 1, 2 * position + 1, teams, wbMatches);

  if (resultA === 'bye' && resultB === 'bye') return 'bye';
  if (resultA === 'bye') return resultB;
  if (resultB === 'bye') return resultA;
  if (resultA === 'tbd' || resultB === 'tbd') return 'tbd';

  // Both real teams: find the match in this WB round
  const match = wbMatches.find(
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
 * Returns the loser of a WB R1 position, or null if no match / no result yet.
 */
function getWBR1Loser(
  position: number,
  teams: TournamentTeam[],
  wbMatches: TournamentMatch[],
): TournamentTeam | null {
  const slot1 = 2 * position;
  const slot2 = 2 * position + 1;
  const team1 = teams[slot1];
  const team2 = teams[slot2];
  if (!team1 || !team2) return null; // bye-advance or empty, no loser
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
      matches.push({
        id: makeMatchId(),
        round: 1,
        courtNumber: (courtIndex % numberOfCourts) + 1,
        team1,
        team2,
        bracket: 'wb',
      });
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
  const existingIds = new Set(allMatches.map(m => m.id));
  const wbMatches = allMatches.filter(m => m.bracket === 'wb');
  const cbMatches = allMatches.filter(m => m.bracket === 'cb');
  const totalWBRounds = Math.log2(bracketSize);

  // Count existing matches per bracket+round for quick lookup
  function wbRoundExists(round: number): boolean {
    return wbMatches.some(m => m.round === round);
  }
  function cbRoundExists(round: number): boolean {
    return cbMatches.some(m => m.round === round);
  }
  function wbRoundComplete(round: number): boolean {
    const roundMatches = wbMatches.filter(m => m.round === round);
    return roundMatches.length > 0 && roundMatches.every(m => m.winner !== undefined);
  }
  function cbRoundComplete(round: number): boolean {
    const roundMatches = cbMatches.filter(m => m.round === round);
    return roundMatches.length > 0 && roundMatches.every(m => m.winner !== undefined);
  }

  // --- Generate next WB rounds ---
  for (let n = 1; n < totalWBRounds; n++) {
    if (!wbRoundComplete(n)) break; // must complete in order
    if (wbRoundExists(n + 1)) continue; // already generated

    // Generate WB round n+1
    const nextRoundPositions = bracketSize / Math.pow(2, n + 1);
    let courtIndex = allMatches.length + newMatches.length;
    for (let pos = 0; pos < nextRoundPositions; pos++) {
      const teamA = getWBPositionResult(n, 2 * pos, teams, [...wbMatches, ...newMatches.filter(m => m.bracket === 'wb')]);
      const teamB = getWBPositionResult(n, 2 * pos + 1, teams, [...wbMatches, ...newMatches.filter(m => m.bracket === 'wb')]);
      if (teamA !== 'bye' && teamA !== 'tbd' && teamB !== 'bye' && teamB !== 'tbd') {
        const id = makeMatchId();
        if (!existingIds.has(id)) {
          newMatches.push({
            id,
            round: n + 1,
            courtNumber: (courtIndex % numberOfCourts) + 1,
            team1: teamA,
            team2: teamB,
            bracket: 'wb',
          });
          courtIndex++;
        }
      }
    }
    break; // only generate one round at a time
  }

  // --- Generate CB R1 from WB R1 losers (only once, when WB R1 completes) ---
  if (wbRoundComplete(1) && !cbRoundExists(1)) {
    const wbR1Positions = bracketSize / 2;
    const losers: TournamentTeam[] = [];
    for (let pos = 0; pos < wbR1Positions; pos++) {
      const loser = getWBR1Loser(pos, teams, wbMatches);
      if (loser) losers.push(loser);
    }

    if (losers.length >= 2) {
      let courtIndex = allMatches.length + newMatches.length;
      // Adjacent pairing for CB R1
      for (let i = 0; i < Math.floor(losers.length / 2); i++) {
        newMatches.push({
          id: makeMatchId(),
          round: 1,
          courtNumber: (courtIndex % numberOfCourts) + 1,
          team1: losers[2 * i],
          team2: losers[2 * i + 1],
          bracket: 'cb',
        });
        courtIndex++;
      }
      // If odd number of losers, last one gets a bye (no match stored)
    }
  }

  // --- Generate next CB rounds ---
  const cbRounds = Array.from(new Set(cbMatches.map(m => m.round))).sort((a, b) => a - b);
  const maxCBRound = cbRounds.length > 0 ? Math.max(...cbRounds) : 0;

  for (let n = 1; n <= maxCBRound; n++) {
    if (!cbRoundComplete(n)) break;
    if (cbRoundExists(n + 1)) continue;

    // Generate CB round n+1: winners of CB round n advance
    const cbRoundNMatches = [...cbMatches, ...newMatches.filter(m => m.bracket === 'cb')]
      .filter(m => m.round === n);
    const winners: TournamentTeam[] = [];
    for (const match of cbRoundNMatches) {
      if (match.winner !== undefined) {
        winners.push(match.winner === 1 ? match.team1 : match.team2);
      }
    }

    if (winners.length >= 2) {
      let courtIndex = allMatches.length + newMatches.length;
      for (let i = 0; i < Math.floor(winners.length / 2); i++) {
        newMatches.push({
          id: makeMatchId(),
          round: n + 1,
          courtNumber: (courtIndex % numberOfCourts) + 1,
          team1: winners[2 * i],
          team2: winners[2 * i + 1],
          bracket: 'cb',
        });
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
    const allMatches = [...updatedMatches, ...followUp];
    const updated = new EliminationTournament({
      ...this._state,
      phase: this.isComplete() ? 'completed' : 'active',
      matches: allMatches,
    });
    // Re-check completion on the updated instance (isComplete uses current matches)
    return (updated.isComplete()
      ? new EliminationTournament({ ...updated._state, phase: 'completed' })
      : updated) as unknown as this;
  }

  validate(teams: TournamentTeam[], format: TournamentFormat): string | null {
    if (teams.length < 2) return 'Need at least 2 teams to start';
    if (format === 'doubles') {
      for (const team of teams) {
        if (team.players.length !== 2) {
          return 'Each doubles team must have exactly 2 players';
        }
      }
    }
    return null;
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

    // Sort: losses asc, then wins desc, then name asc
    return Array.from(standings.values()).sort((a, b) => {
      if (a.lost !== b.lost) return a.lost - b.lost;
      if (b.won !== a.won) return b.won - a.won;
      const nameA = a.team.players[0]?.name ?? '';
      const nameB = b.team.players[0]?.name ?? '';
      return nameA.localeCompare(nameB);
    });
  }

  completedRounds(): number {
    const wbMatches = this._state.matches.filter(m => m.bracket === 'wb');
    if (wbMatches.length === 0) return 0;

    const roundNums = Array.from(new Set(wbMatches.map(m => m.round))).sort((a, b) => a - b);
    let completed = 0;
    for (const r of roundNums) {
      const roundMatches = wbMatches.filter(m => m.round === r);
      if (roundMatches.every(m => m.winner !== undefined)) {
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

  wbMatchesForRound(round: number): TournamentMatch[] {
    return this._state.matches.filter(m => m.bracket === 'wb' && m.round === round);
  }

  cbMatchesForRound(round: number): TournamentMatch[] {
    return this._state.matches.filter(m => m.bracket === 'cb' && m.round === round);
  }

  wbMatches(): TournamentMatch[] {
    return this._state.matches.filter(m => m.bracket === 'wb');
  }

  cbMatches(): TournamentMatch[] {
    return this._state.matches.filter(m => m.bracket === 'cb');
  }

  isComplete(): boolean {
    const { matches } = this._state;
    if (matches.length === 0) return false;
    return matches.every(m => m.winner !== undefined);
  }

  wbTotalRounds(): number {
    return this.totalRounds();
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
