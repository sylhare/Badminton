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
    protected readonly _seeds: TournamentTeam[],
    protected readonly _matches: TournamentMatch[],
    protected readonly _bracketSize: number,
  ) {}

  matches(): TournamentMatch[] {
    return this._matches;
  }

  matchesForRound(round: number): TournamentMatch[] {
    return this._matches.filter(m => m.round === round);
  }

  protected buildRound(r: number, seedBracketSize: number): BracketNode[] {
    const positions = seedBracketSize / Math.pow(2, r);
    const round: BracketNode[] = [];
    for (let pos = 0; pos < positions; pos++) {
      round.push(buildNode(r, pos, this._seeds, this._matches));
    }
    return round;
  }

  totalRounds(): number {
    return Math.log2(this._bracketSize);
  }

  protected roundNodes(r: number): BracketNode[] {
    return this.buildRound(r, this._bracketSize);
  }

  computeTree(): BracketNode[][] {
    if (this._seeds.length < 2) return [];
    const rounds: BracketNode[][] = [];
    for (let r = 1; r <= this.totalRounds(); r++) {
      rounds.push(this.roundNodes(r));
    }
    return rounds;
  }
}

/** Winners (main) bracket — tracks teams through the primary elimination path. */
export class WinnersBracket extends Bracket {
  constructor(teams: TournamentTeam[], matches: TournamentMatch[], bracketSize: number) {
    super(teams, matches, bracketSize);
  }

  completedRounds(): number {
    if (this._matches.length === 0) return 0;
    let completed = 0;
    for (let r = 1; r <= this.totalRounds(); r++) {
      if (roundComplete(this._matches, r)) completed = r;
      else break;
    }
    return completed;
  }

  firstRoundLosers(): TournamentTeam[] {
    const losers: TournamentTeam[] = [];
    for (let pos = 0; pos < this._bracketSize / 2; pos++) {
      const loser = getWinnersFirstRoundLoser(pos, this._seeds, this._matches);
      if (loser) losers.push(loser);
    }
    return losers;
  }
}

/** Consolation bracket — for teams eliminated in the winners bracket first round. */
export class ConsolationBracket extends Bracket {
  constructor(seeds: TournamentTeam[], matches: TournamentMatch[], bracketSize: number) {
    super(seeds, matches, bracketSize);
  }

  seeds(): TournamentTeam[] {
    return this._seeds;
  }

  private get cbBracketSize(): number {
    return nextPowerOf2(this._seeds.length);
  }

  private get cbSeedRounds(): number {
    return Math.log2(this.cbBracketSize);
  }

  totalRounds(): number {
    return Math.max(this.cbSeedRounds, Math.log2(this._bracketSize) - 1);
  }

  protected roundNodes(r: number): BracketNode[] {
    if (r <= this.cbSeedRounds) {
      return this.buildRound(r, this.cbBracketSize);
    }
    const roundMatches = this.matchesForRound(r);
    if (roundMatches.length > 0) {
      return roundMatches.map((m, i) => ({ type: 'match' as const, match: m, slotIndex: i }));
    }
    return [{ type: 'tbd' as const, slotIndex: 0 }];
  }
}
