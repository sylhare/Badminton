import type { TournamentMatch, TournamentTeam } from './types';
import { nextPowerOf2 } from './EliminationTournament';

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
 * dist 0 → "Final", dist 1 → "Semi Final", dist 2 → "4th of Final", etc.
 */
export function roundLabel(roundNumber: number, totalRounds: number): string {
  const dist = totalRounds - roundNumber;
  if (dist === 0) return 'Final';
  if (dist === 1) return 'Semi Final';
  const n = Math.pow(2, dist);
  return `${n}th of Final`;
}

// ─── Internal helpers ───────────────────────────────────────────────────────

type PositionResult = TournamentTeam | 'bye' | 'tbd';

function resolveWBPosition(
  round: number,
  position: number,
  teams: TournamentTeam[],
  wbMatches: TournamentMatch[],
): PositionResult {
  if (round === 1) {
    const slot1 = 2 * position;
    const slot2 = 2 * position + 1;
    const team1 = teams[slot1];
    const team2 = teams[slot2];

    if (!team1 && !team2) return 'bye';
    if (!team1) return team2;
    if (!team2) return team1;

    const match = wbMatches.find(
      m =>
        m.round === 1 &&
        ((m.team1.id === team1.id && m.team2.id === team2.id) ||
          (m.team1.id === team2.id && m.team2.id === team1.id)),
    );
    if (!match || match.winner === undefined) return 'tbd';
    return match.winner === 1 ? match.team1 : match.team2;
  }

  const resultA = resolveWBPosition(round - 1, 2 * position, teams, wbMatches);
  const resultB = resolveWBPosition(round - 1, 2 * position + 1, teams, wbMatches);

  return resolveChildNode(round, resultA, resultB, wbMatches);
}

function resolveCBPosition(
  round: number,
  position: number,
  cbSeeds: TournamentTeam[],
  cbMatches: TournamentMatch[],
): PositionResult {
  if (round === 1) {
    const slot1 = 2 * position;
    const slot2 = 2 * position + 1;
    const team1 = cbSeeds[slot1];
    const team2 = cbSeeds[slot2];

    if (!team1 && !team2) return 'bye';
    if (!team1) return team2;
    if (!team2) return team1;

    const match = cbMatches.find(
      m =>
        m.round === 1 &&
        ((m.team1.id === team1.id && m.team2.id === team2.id) ||
          (m.team1.id === team2.id && m.team2.id === team1.id)),
    );
    if (!match || match.winner === undefined) return 'tbd';
    return match.winner === 1 ? match.team1 : match.team2;
  }

  const resultA = resolveCBPosition(round - 1, 2 * position, cbSeeds, cbMatches);
  const resultB = resolveCBPosition(round - 1, 2 * position + 1, cbSeeds, cbMatches);

  return resolveChildNode(round, resultA, resultB, cbMatches);
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

  // Both real teams — find the match in this round
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

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Computes a round-by-round bracket tree for the Winners Bracket.
 * Returns an array of rounds (from round 1 to finalRound),
 * each containing an array of BracketNode in slot order.
 *
 * @param teams       All seeded teams (indices beyond teams.length are byes)
 * @param bracketSize Power-of-2 total slot count
 * @param wbMatches   All WB matches (bracket === 'wb')
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
      round.push(buildWBNode(r, pos, teams, wbMatches));
    }

    rounds.push(round);
  }

  return rounds;
}

function buildWBNode(
  round: number,
  position: number,
  teams: TournamentTeam[],
  wbMatches: TournamentMatch[],
): BracketNode {
  if (round === 1) {
    const slot1 = 2 * position;
    const slot2 = 2 * position + 1;
    const team1 = teams[slot1];
    const team2 = teams[slot2];

    if (!team1 && !team2) return { type: 'empty', slotIndex: position };
    if (!team1) return { type: 'bye-advance', team: team2, slotIndex: position };
    if (!team2) return { type: 'bye-advance', team: team1, slotIndex: position };

    const match = wbMatches.find(
      m =>
        m.round === 1 &&
        ((m.team1.id === team1.id && m.team2.id === team2.id) ||
          (m.team1.id === team2.id && m.team2.id === team1.id)),
    );
    if (!match) return { type: 'tbd', slotIndex: position };
    return { type: 'match', match, slotIndex: position };
  }

  // Higher rounds: derive from parent positions
  const parentA = resolveWBPosition(round - 1, 2 * position, teams, wbMatches);
  const parentB = resolveWBPosition(round - 1, 2 * position + 1, teams, wbMatches);

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

  // Both real teams: find the match
  const match = wbMatches.find(
    m =>
      m.round === round &&
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
 *
 * @param cbSeeds   WB R1 losers in seeding order
 * @param cbMatches All CB matches (bracket === 'cb')
 */
export function computeCBTree(
  cbSeeds: TournamentTeam[],
  cbMatches: TournamentMatch[],
): BracketNode[][] {
  if (cbSeeds.length < 2) return [];

  const cbBracketSize = nextPowerOf2(cbSeeds.length);

  const totalCBRounds = Math.log2(cbBracketSize);
  const rounds: BracketNode[][] = [];

  for (let r = 1; r <= totalCBRounds; r++) {
    const positionsInRound = cbBracketSize / Math.pow(2, r);
    const round: BracketNode[] = [];

    for (let pos = 0; pos < positionsInRound; pos++) {
      round.push(buildCBNode(r, pos, cbSeeds, cbMatches));
    }

    rounds.push(round);
  }

  return rounds;
}

function buildCBNode(
  round: number,
  position: number,
  cbSeeds: TournamentTeam[],
  cbMatches: TournamentMatch[],
): BracketNode {
  if (round === 1) {
    const slot1 = 2 * position;
    const slot2 = 2 * position + 1;
    const team1 = cbSeeds[slot1];
    const team2 = cbSeeds[slot2];

    if (!team1 && !team2) return { type: 'empty', slotIndex: position };
    if (!team1) return { type: 'bye-advance', team: team2, slotIndex: position };
    if (!team2) return { type: 'bye-advance', team: team1, slotIndex: position };

    const match = cbMatches.find(
      m =>
        m.round === 1 &&
        ((m.team1.id === team1.id && m.team2.id === team2.id) ||
          (m.team1.id === team2.id && m.team2.id === team1.id)),
    );
    if (!match) return { type: 'tbd', slotIndex: position };
    return { type: 'match', match, slotIndex: position };
  }

  const parentA = resolveCBPosition(round - 1, 2 * position, cbSeeds, cbMatches);
  const parentB = resolveCBPosition(round - 1, 2 * position + 1, cbSeeds, cbMatches);

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

  const match = cbMatches.find(
    m =>
      m.round === round &&
      ((m.team1.id === (parentA as TournamentTeam).id &&
        m.team2.id === (parentB as TournamentTeam).id) ||
        (m.team1.id === (parentB as TournamentTeam).id &&
          m.team2.id === (parentA as TournamentTeam).id)),
  );
  if (!match) return { type: 'tbd', slotIndex: position };
  return { type: 'match', match, slotIndex: position };
}
