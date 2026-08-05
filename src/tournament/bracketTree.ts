import type { TournamentMatch, TournamentTeam } from './types';

export type BracketNodeType = 'match' | 'bye-advance' | 'tbd' | 'empty';

export interface BracketNode {
  type: BracketNodeType;
  match?: TournamentMatch;
  team?: TournamentTeam;
  slotIndex: number;
}

export function nextPowerOf2(n: number): number {
  if (n <= 1) return 1;
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/** Number of match slots in a given bracket round (halves each round). */
export function positionsInRound(bracketSize: number, round: number): number {
  return bracketSize / 2 ** round;
}

/** The winning / losing team of a decided match (assumes `winner` is set). */
export const winnerOf = (m: TournamentMatch): TournamentTeam => (m.winner === 1 ? m.team1 : m.team2);
export const loserOf = (m: TournamentMatch): TournamentTeam => (m.winner === 1 ? m.team2 : m.team1);

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

/**
 * Seed slots of a bracket's first round: a team once known, `null` while the
 * slot's feeder match is undecided (consolation only), `undefined` past the
 * end of the array meaning no slot at all (a bye).
 */
export type SeedSlots = ReadonlyArray<TournamentTeam | null>;

/** Read a first-round seed slot: absent → bye, `null` → tbd, a team → that team. */
function slotToResult(slot: TournamentTeam | null | undefined): PositionResult {
  if (slot === undefined) return 'bye';
  if (slot === null) return 'tbd';
  return slot;
}

/** The two feeding results for a node: raw seed slots in round 1, else the child positions. */
function childResults(
  round: number,
  position: number,
  seeds: SeedSlots,
  matches: TournamentMatch[],
): [PositionResult, PositionResult] {
  if (round === 1) {
    return [slotToResult(seeds[2 * position]), slotToResult(seeds[2 * position + 1])];
  }
  return [
    resolvePosition(round - 1, 2 * position, seeds, matches),
    resolvePosition(round - 1, 2 * position + 1, seeds, matches),
  ];
}

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

  const match = findMatchBetween(round, resultA, resultB, matches);
  if (!match || match.winner === undefined) return 'tbd';
  return winnerOf(match);
}

export function resolvePosition(
  round: number,
  position: number,
  seeds: SeedSlots,
  matches: TournamentMatch[],
): PositionResult {
  return resolveChildNode(round, ...childResults(round, position, seeds, matches), matches);
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
  teams: SeedSlots,
  winnersMatches: TournamentMatch[],
): TournamentTeam | null {
  const team1 = teams[2 * position];
  const team2 = teams[2 * position + 1];
  if (!team1 || !team2) return null;
  const match = findMatchBetween(1, team1, team2, winnersMatches);
  if (!match || match.winner === undefined) return null;
  return loserOf(match);
}

export function getWBSemiFinalLosers(
  winnersMatches: TournamentMatch[],
  totalWBRounds: number,
): TournamentTeam[] {
  const semiFinalRound = totalWBRounds - 1;
  if (semiFinalRound < 1) return [];
  return winnersMatches
    .filter(m => m.round === semiFinalRound && m.winner !== undefined)
    .map(loserOf);
}

/**
 * Teams active in a given CB round: previous-round winners plus any that had a bye.
 * Round 1 is seeded by `cbSeeds` (the WB first-round losers).
 */
export function getCBExpectedPool(
  round: number,
  cbSeeds: TournamentTeam[],
  consolationMatches: TournamentMatch[],
): TournamentTeam[] {
  if (round === 1) return cbSeeds;

  const prevPool = getCBExpectedPool(round - 1, cbSeeds, consolationMatches);
  const prevMatches = consolationMatches.filter(m => m.round === round - 1);
  const prevParticipantIds = new Set(prevMatches.flatMap(m => [m.team1.id, m.team2.id]));

  const result: TournamentTeam[] = [];
  for (const m of prevMatches) {
    if (m.winner !== undefined) result.push(winnerOf(m));
  }
  for (const team of prevPool) {
    if (!prevParticipantIds.has(team.id)) result.push(team);
  }
  return result;
}

export function roundLabel(roundNumber: number, totalRounds: number): string {
  const roundsFromFinal = totalRounds - roundNumber;
  if (roundsFromFinal === 0) return 'Final';
  if (roundsFromFinal === 1) return 'Semi Final';
  const n = Math.pow(2, roundsFromFinal);
  return `${n}th of Final`;
}

/** Map a node's two feeding results to its render node (a match node stands as soon as the match exists). */
function nodeFromResults(
  round: number,
  position: number,
  resultA: PositionResult,
  resultB: PositionResult,
  matches: TournamentMatch[],
): BracketNode {
  if (resultA === 'bye' && resultB === 'bye') return { type: 'empty', slotIndex: position };
  if (resultA === 'bye') {
    return resultB === 'tbd' ? { type: 'tbd', slotIndex: position } : { type: 'bye-advance', team: resultB as TournamentTeam, slotIndex: position };
  }
  if (resultB === 'bye') {
    return resultA === 'tbd' ? { type: 'tbd', slotIndex: position } : { type: 'bye-advance', team: resultA as TournamentTeam, slotIndex: position };
  }
  if (resultA === 'tbd' || resultB === 'tbd') return { type: 'tbd', slotIndex: position };

  const match = findMatchBetween(round, resultA, resultB, matches);
  return match ? { type: 'match', match, slotIndex: position } : { type: 'tbd', slotIndex: position };
}

function buildNode(
  round: number,
  position: number,
  seeds: SeedSlots,
  matches: TournamentMatch[],
): BracketNode {
  return nodeFromResults(round, position, ...childResults(round, position, seeds, matches), matches);
}

export abstract class Bracket {
  constructor(
    protected readonly _seeds: SeedSlots,
    protected readonly _matches: TournamentMatch[],
    protected readonly _bracketSize: number,
  ) {}

  matches(): TournamentMatch[] {
    return this._matches;
  }

  matchesForRound(round: number): TournamentMatch[] {
    return this._matches.filter(m => m.round === round);
  }

  protected buildRound(r: number, bracketSize: number): BracketNode[] {
    const positions = positionsInRound(bracketSize, r);
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
    return Array.from({ length: positionsInRound(this._bracketSize, 1) }, (_, pos) =>
      getWinnersFirstRoundLoser(pos, this._seeds, this._matches),
    ).filter((l): l is TournamentTeam => l !== null);
  }
}

/**
 * Consolation bracket — for teams eliminated in the winners bracket first
 * round. Seeds are positional slots (one per real WB first-round match), with
 * `null` marking a loser not yet known, so the tree shape is stable while the
 * WB first round is still in progress.
 */
export class ConsolationBracket extends Bracket {
  private readonly cbBracketSize: number;
  private readonly cbSeedRounds: number;

  constructor(seeds: SeedSlots, matches: TournamentMatch[], bracketSize: number) {
    super(seeds, matches, bracketSize);
    this.cbBracketSize = nextPowerOf2(seeds.length);
    this.cbSeedRounds = Math.log2(this.cbBracketSize);
  }

  seeds(): SeedSlots {
    return this._seeds;
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
