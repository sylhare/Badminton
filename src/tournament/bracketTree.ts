import type { TournamentMatch, TournamentTeam } from './types';
import { nextPowerOf2, resolvePosition } from './EliminationTournament';

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

/**
 * Computes a round-by-round bracket tree for the Winners Bracket.
 * Returns an array of rounds (from round 1 to finalRound),
 * each containing an array of BracketNode in slot order.
 * Indices beyond teams.length are treated as byes.
 */
export function computeWBTree(
  teams: TournamentTeam[],
  bracketSize: number,
  wbMatches: TournamentMatch[],
): BracketNode[][] {
  const totalRounds = Math.log2(bracketSize);
  const rounds: BracketNode[][] = [];

  for (let r = 1; r <= totalRounds; r++) {
    const positionsInRound = bracketSize / Math.pow(2, r);
    const round: BracketNode[] = [];

    for (let pos = 0; pos < positionsInRound; pos++) {
      round.push(buildNode(r, pos, teams, wbMatches));
    }

    rounds.push(round);
  }

  return rounds;
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

    const match = matches.find(
      m => m.round === 1 &&
        ((m.team1.id === team1.id && m.team2.id === team2.id) ||
          (m.team1.id === team2.id && m.team2.id === team1.id)),
    );
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

  const match = matches.find(
    m => m.round === round &&
      ((m.team1.id === (parentA as TournamentTeam).id &&
          m.team2.id === (parentB as TournamentTeam).id) ||
        (m.team1.id === (parentB as TournamentTeam).id &&
          m.team2.id === (parentA as TournamentTeam).id)),
  );
  if (!match) return { type: 'tbd', slotIndex: position };
  return { type: 'match', match, slotIndex: position };
}

/**
 * Computes a round-by-round bracket tree for the Consolation Bracket.
 * When the WB has more rounds than the CB seed depth (e.g. 5-player: 2 WB R1 losers
 * produce 1 seed round, but WB has 3 rounds), extra CB rounds are appended and
 * filled by WB losers dropping in from those later rounds.
 */
export function computeCBTree(
  cbSeeds: TournamentTeam[],
  cbMatches: TournamentMatch[],
  bracketSize: number,
): BracketNode[][] {
  if (cbSeeds.length < 2) return [];

  const cbBracketSize = nextPowerOf2(cbSeeds.length);
  const cbSeedRounds = Math.log2(cbBracketSize);
  const wbLoserRounds = Math.log2(bracketSize) - 1;
  const totalCBRounds = Math.max(cbSeedRounds, wbLoserRounds);

  const rounds: BracketNode[][] = [];

  for (let r = 1; r <= totalCBRounds; r++) {
    if (r <= cbSeedRounds) {
      const positionsInRound = cbBracketSize / Math.pow(2, r);
      const round: BracketNode[] = [];
      for (let pos = 0; pos < positionsInRound; pos++) {
        round.push(buildNode(r, pos, cbSeeds, cbMatches));
      }
      rounds.push(round);
    } else {
      const roundMatches = cbMatches.filter(m => m.round === r);
      if (roundMatches.length > 0) {
        rounds.push(roundMatches.map((m, i) => ({ type: 'match' as const, match: m, slotIndex: i })));
      } else {
        rounds.push([{ type: 'tbd' as const, slotIndex: 0 }]);
      }
    }
  }

  return rounds;
}
