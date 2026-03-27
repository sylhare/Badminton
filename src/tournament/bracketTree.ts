import type { TournamentMatch, TournamentTeam } from './types';

export type BracketNodeType = 'match' | 'bye-advance' | 'tbd' | 'empty';

export interface BracketNode {
  type: BracketNodeType;
  /** Set when type === 'match' */
  match?: TournamentMatch;
  /** Set when type === 'bye-advance' (the auto-advancing team) */
  team?: TournamentTeam;
  /** 0-based index within the round (for vertical positioning) */
  slotIndex: number;
}

export function nextPowerOf2(n: number): number {
  if (n <= 1) return 1;
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

export function findMatchBetween(
  round: number,
  teamA: TournamentTeam,
  teamB: TournamentTeam,
  matches: TournamentMatch[],
): TournamentMatch | undefined {
  return matches.find(
    m => m.round === round &&
      ((m.team1.id === teamA.id && m.team2.id === teamB.id) ||
       (m.team1.id === teamB.id && m.team2.id === teamA.id)),
  );
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

  const match = findMatchBetween(round, resultA as TournamentTeam, resultB as TournamentTeam, matches);
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

    const match = findMatchBetween(1, team1, team2, matches);
    if (!match || match.winner === undefined) return 'tbd';
    return match.winner === 1 ? match.team1 : match.team2;
  }

  const resultA = resolvePosition(round - 1, 2 * position, seeds, matches);
  const resultB = resolvePosition(round - 1, 2 * position + 1, seeds, matches);
  return resolveChildNode(round, resultA, resultB, matches);
}

export function roundComplete(matches: TournamentMatch[], round: number): boolean {
  let count = 0;
  for (const m of matches) {
    if (m.round !== round) continue;
    if (m.winner === undefined) return false;
    count++;
  }
  return count > 0;
}

export function getWinnersFirstRoundLoser(
  position: number,
  teams: TournamentTeam[],
  winnersMatches: TournamentMatch[],
): TournamentTeam | null {
  const team1 = teams[2 * position];
  const team2 = teams[2 * position + 1];
  if (!team1 || !team2) return null;
  const match = findMatchBetween(1, team1, team2, winnersMatches);
  if (!match || match.winner === undefined) return null;
  return match.winner === 1 ? match.team2 : match.team1;
}

/**
 * Returns the round label based on distance from the final.
 * roundsFromFinal 0 → "Final", 1 → "Semi Final", 2 → "4th of Final", etc.
 */
export function roundLabel(roundNumber: number, totalRounds: number): string {
  const roundsFromFinal = totalRounds - roundNumber;
  if (roundsFromFinal === 0) return 'Final';
  if (roundsFromFinal === 1) return 'Semi Final';
  const n = Math.pow(2, roundsFromFinal);
  return `${n}th of Final`;
}

function buildNode(
  round: number,
  position: number,
  seeds: TournamentTeam[],
  matches: TournamentMatch[],
): BracketNode {
  if (round === 1) {
    const team1 = seeds[2 * position];
    const team2 = seeds[2 * position + 1];

    if (!team1 && !team2) return { type: 'empty', slotIndex: position };
    if (!team1) return { type: 'bye-advance', team: team2, slotIndex: position };
    if (!team2) return { type: 'bye-advance', team: team1, slotIndex: position };

    const match = findMatchBetween(1, team1, team2, matches);
    if (!match) return { type: 'tbd', slotIndex: position };
    return { type: 'match', match, slotIndex: position };
  }

  const parentA = resolvePosition(round - 1, 2 * position, seeds, matches);
  const parentB = resolvePosition(round - 1, 2 * position + 1, seeds, matches);

  if (parentA === 'bye' && parentB === 'bye') return { type: 'empty', slotIndex: position };
  if (parentA === 'bye') {
    if (parentB === 'tbd') return { type: 'tbd', slotIndex: position };
    return { type: 'bye-advance', team: parentB as TournamentTeam, slotIndex: position };
  }
  if (parentB === 'bye') {
    if (parentA === 'tbd') return { type: 'tbd', slotIndex: position };
    return { type: 'bye-advance', team: parentA as TournamentTeam, slotIndex: position };
  }
  if (parentA === 'tbd' || parentB === 'tbd') return { type: 'tbd', slotIndex: position };

  const match = findMatchBetween(round, parentA as TournamentTeam, parentB as TournamentTeam, matches);
  if (!match) return { type: 'tbd', slotIndex: position };
  return { type: 'match', match, slotIndex: position };
}

/** Shared base for WinnersBracket and ConsolationBracket. */
export abstract class Bracket {
  constructor(
    protected readonly _matches: TournamentMatch[],
    protected readonly _bracketSize: number,
  ) {}

  matches(): TournamentMatch[] {
    return this._matches;
  }

  matchesForRound(round: number): TournamentMatch[] {
    return this._matches.filter(m => m.round === round);
  }

  abstract totalRounds(): number;
  abstract computeTree(): BracketNode[][];
}

/** Winners (main) bracket — tracks teams through the primary elimination path. */
export class WinnersBracket extends Bracket {
  constructor(
    private readonly _teams: TournamentTeam[],
    matches: TournamentMatch[],
    bracketSize: number,
  ) {
    super(matches, bracketSize);
  }

  totalRounds(): number {
    return Math.log2(this._bracketSize);
  }

  completedRounds(): number {
    if (this._matches.length === 0) return 0;
    const total = this.totalRounds();
    let completed = 0;
    for (let r = 1; r <= total; r++) {
      if (roundComplete(this._matches, r)) completed = r;
      else break;
    }
    return completed;
  }

  firstRoundLosers(): TournamentTeam[] {
    const losers: TournamentTeam[] = [];
    for (let pos = 0; pos < this._bracketSize / 2; pos++) {
      const loser = getWinnersFirstRoundLoser(pos, this._teams, this._matches);
      if (loser) losers.push(loser);
    }
    return losers;
  }

  computeTree(): BracketNode[][] {
    const totalRounds = Math.log2(this._bracketSize);
    const rounds: BracketNode[][] = [];
    for (let r = 1; r <= totalRounds; r++) {
      const positionsInRound = this._bracketSize / Math.pow(2, r);
      const round: BracketNode[] = [];
      for (let pos = 0; pos < positionsInRound; pos++) {
        round.push(buildNode(r, pos, this._teams, this._matches));
      }
      rounds.push(round);
    }
    return rounds;
  }
}

/** Consolation bracket — for teams eliminated in the winners bracket first round. */
export class ConsolationBracket extends Bracket {
  constructor(
    private readonly _seeds: TournamentTeam[],
    matches: TournamentMatch[],
    bracketSize: number,
  ) {
    super(matches, bracketSize);
  }

  seeds(): TournamentTeam[] {
    return this._seeds;
  }

  totalRounds(): number {
    if (this._matches.length === 0) return 0;
    return Math.max(...this._matches.map(m => m.round));
  }

  computeTree(): BracketNode[][] {
    if (this._seeds.length < 2) return [];

    const cbBracketSize = nextPowerOf2(this._seeds.length);
    const cbSeedRounds = Math.log2(cbBracketSize);
    const wbLoserRounds = Math.log2(this._bracketSize) - 1;
    const totalCBRounds = Math.max(cbSeedRounds, wbLoserRounds);

    const rounds: BracketNode[][] = [];

    for (let r = 1; r <= totalCBRounds; r++) {
      if (r <= cbSeedRounds) {
        const positionsInRound = cbBracketSize / Math.pow(2, r);
        const round: BracketNode[] = [];
        for (let pos = 0; pos < positionsInRound; pos++) {
          round.push(buildNode(r, pos, this._seeds, this._matches));
        }
        rounds.push(round);
      } else {
        const roundMatches = this._matches.filter(m => m.round === r);
        if (roundMatches.length > 0) {
          rounds.push(roundMatches.map((m, i) => ({ type: 'match' as const, match: m, slotIndex: i })));
        } else {
          rounds.push([{ type: 'tbd' as const, slotIndex: 0 }]);
        }
      }
    }

    return rounds;
  }
}
