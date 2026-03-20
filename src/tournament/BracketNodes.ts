import type { EliminationSetup, TournamentMatch, TournamentTeam } from './types.ts';
import type { BracketNode, SeedSlot } from './types';
import { COLUMN_WIDTH, CONNECTOR_WIDTH, MATCH_HEIGHT, SEED_ABSENT, SEED_TBD, SLOT_HEIGHT, winnersTop } from './types';

export interface BracketLayout {
  nodes: BracketNode[][];
  tops: number[][];
  connectorTypes: Array<'bracket' | 'none'>;
  totalH: number;
  totalW: number;
}

/**
 * Convert an EliminationSetup's seeding into a SeedSlot array for the winners bracket.
 * Null entries (structural byes) become SEED_ABSENT.
 */
export function computeWinnersSeeding(seBracket: EliminationSetup): SeedSlot[] {
  return seBracket.seeding.map(s => (s === null ? SEED_ABSENT : s));
}

/**
 * Derive the consolation bracket seeding from WB R1 results.
 * Each real-vs-real WB R1 pair contributes its loser (or SEED_TBD if not yet played).
 * Bye pairs (one null) and empty pairs (null-null) are skipped.
 * Result is padded to the next power of 2 with SEED_ABSENT.
 */
export function computeConsolationSeeding(
  seBracket: EliminationSetup,
  wbMatches: TournamentMatch[],
): SeedSlot[] {
  const seeding: SeedSlot[] = [];

  for (let i = 0; i < seBracket.size / 2; i++) {
    const t1Id = seBracket.seeding[2 * i];
    const t2Id = seBracket.seeding[2 * i + 1];
    if (t1Id !== null && t2Id !== null) {
      const m = findMatch(wbMatches, 1, t1Id, t2Id);
      let loser: SeedSlot = SEED_TBD;
      if (m?.winner === 1) loser = m.team2.id;
      else if (m?.winner === 2) loser = m.team1.id;
      seeding.push(loser);
    }
  }

  if (seeding.length % 2 !== 0) seeding.push(SEED_ABSENT);
  let p = 1;
  while (p < seeding.length) p <<= 1;
  while (seeding.length < p) seeding.push(SEED_ABSENT, SEED_ABSENT);

  return seeding;
}

export function findMatch(matches: TournamentMatch[], round: number, t1Id: string, t2Id: string): TournamentMatch | undefined {
  return matches.find(m => m.round === round &&
    ((m.team1.id === t1Id && m.team2.id === t2Id) || (m.team1.id === t2Id && m.team2.id === t1Id)),
  );
}

export function makePairNode(
  t1: TournamentTeam | null,
  t2: TournamentTeam | null,
  round: number,
  matches: TournamentMatch[],
): BracketNode {
  if (!t1 || !t2) return { type: 'tbd', team1: t1, team2: t2 };
  const match = findMatch(matches, round, t1.id, t2.id);
  return match
    ? { type: 'match', match, team1: match.team1, team2: match.team2 }
    : { type: 'tbd', team1: t1, team2: t2 };
}

export function makeSlotNode(
  t1: TournamentTeam | null,
  t2: TournamentTeam | null,
  absent1: boolean,
  absent2: boolean,
  round: number,
  matches: TournamentMatch[],
): BracketNode {
  if (absent1 && absent2) return { type: 'empty', team1: null, team2: null };
  if (absent2) return { type: 'bye-advance', team1: t1, team2: null };
  if (absent1) return { type: 'bye-advance', team1: t2, team2: null };
  return makePairNode(t1, t2, round, matches);
}

/**
 * Build a standard binary-tree bracket from a pre-computed seeding and pre-filtered matches.
 *
 * Both winners and consolation brackets use this identical algorithm.
 * The caller is responsible for preparing `seeding` (length must be a power of 2)
 * and filtering `matches` to only the relevant bracket.
 */
export function computeBracketNodes(
  seeding: SeedSlot[],
  matches: TournamentMatch[],
  teams: TournamentTeam[],
): BracketLayout {
  const size = seeding.length;

  if (size === 0) return { nodes: [], tops: [], connectorTypes: [], totalH: 0, totalW: 0 };

  const teamMap = new Map(teams.map(t => [t.id, t]));
  const totalRounds = Math.log2(size);

  const getAdvancer = (node: BracketNode): TournamentTeam | null => {
    if (node.type === 'bye-advance') return node.team1;
    if (node.type === 'match' && node.match) {
      if (node.match.winner === 1) return node.match.team1;
      if (node.match.winner === 2) return node.match.team2;
    }
    return null;
  };

  const nodes: BracketNode[][] = [];

  const r1Nodes: BracketNode[] = [];
  for (let i = 0; i < size / 2; i++) {
    const s1 = seeding[2 * i];
    const s2 = seeding[2 * i + 1];
    if (s1 === SEED_TBD || s2 === SEED_TBD) {
      r1Nodes.push({ type: 'tbd', team1: null, team2: null });
    } else {
      const t1 = s1 !== SEED_ABSENT ? (teamMap.get(s1 as string) ?? null) : null;
      const t2 = s2 !== SEED_ABSENT ? (teamMap.get(s2 as string) ?? null) : null;
      r1Nodes.push(makeSlotNode(t1, t2, s1 === SEED_ABSENT, s2 === SEED_ABSENT, 1, matches));
    }
  }
  nodes.push(r1Nodes);

  for (let r = 1; r < totalRounds; r++) {
    const prevNodes = nodes[r - 1];
    const curCount = size >> (r + 1);
    const curNodes: BracketNode[] = [];

    for (let i = 0; i < curCount; i++) {
      const leftNode = prevNodes[2 * i];
      const rightNode = prevNodes[2 * i + 1];
      curNodes.push(makeSlotNode(
        getAdvancer(leftNode),
        getAdvancer(rightNode),
        leftNode.type === 'empty',
        rightNode.type === 'empty',
        r + 1,
        matches,
      ));
    }
    nodes.push(curNodes);
  }

  const tops = nodes.map((round, rIdx) => round.map((_, mIdx) => winnersTop(rIdx, mIdx)));
  const connectorTypes: Array<'bracket'> = nodes.slice(0, -1).map(() => 'bracket');
  const r1Count = size / 2;
  const totalH = Math.max(r1Count, 1) * SLOT_HEIGHT + MATCH_HEIGHT;
  const totalW = nodes.length * COLUMN_WIDTH + Math.max(nodes.length - 1, 0) * CONNECTOR_WIDTH;

  return { nodes, tops, connectorTypes, totalH, totalW };
}
