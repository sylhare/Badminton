import type { TournamentMatch, TournamentTeam } from '../../types/tournament';

import type { BracketNode, SeedSlot } from './types';
import {
  CONNECTOR_WIDTH,
  COLUMN_WIDTH,
  MATCH_HEIGHT,
  SLOT_HEIGHT,
  SEED_ABSENT,
  SEED_TBD,
  winnersTop,
} from './types';

export interface BracketLayout {
  nodes: BracketNode[][];
  tops: number[][];
  connectorTypes: Array<'bracket' | 'none'>;
  totalH: number;
  totalW: number;
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

  // Round 1: parse seeding pairs
  const r1Nodes: BracketNode[] = [];
  for (let i = 0; i < size / 2; i++) {
    const s1 = seeding[2 * i];
    const s2 = seeding[2 * i + 1];

    if (s1 === SEED_ABSENT && s2 === SEED_ABSENT) {
      r1Nodes.push({ type: 'empty', team1: null, team2: null });
    } else if (s1 === SEED_TBD || s2 === SEED_TBD) {
      // Any TBD slot (TBD+TBD, TBD+ABSENT, ABSENT+TBD) → tbd
      r1Nodes.push({ type: 'tbd', team1: null, team2: null });
    } else if (s1 === SEED_ABSENT) {
      // (ABSENT, id) → bye-advance
      r1Nodes.push({
        type: 'bye-advance',
        team1: teamMap.get(s2 as string) ?? null,
        team2: null,
      });
    } else if (s2 === SEED_ABSENT) {
      // (id, ABSENT) → bye-advance
      r1Nodes.push({
        type: 'bye-advance',
        team1: teamMap.get(s1 as string) ?? null,
        team2: null,
      });
    } else {
      // (id, id) → look up match
      const t1Id = s1 as string;
      const t2Id = s2 as string;
      const match = matches.find(
        m =>
          m.round === 1 &&
          ((m.team1.id === t1Id && m.team2.id === t2Id) ||
            (m.team1.id === t2Id && m.team2.id === t1Id)),
      );
      r1Nodes.push(
        match
          ? { type: 'match', match, team1: match.team1, team2: match.team2 }
          : { type: 'tbd', team1: null, team2: null },
      );
    }
  }
  nodes.push(r1Nodes);

  // Subsequent rounds: standard binary-tree pairing
  for (let r = 1; r < totalRounds; r++) {
    const prevNodes = nodes[r - 1];
    const curCount = size >> (r + 1);
    const curNodes: BracketNode[] = [];

    for (let i = 0; i < curCount; i++) {
      const leftNode = prevNodes[2 * i];
      const rightNode = prevNodes[2 * i + 1];
      const t1 = getAdvancer(leftNode);
      const t2 = getAdvancer(rightNode);
      const left0 = leftNode.type === 'empty';
      const right0 = rightNode.type === 'empty';

      if (left0 && right0) {
        curNodes.push({ type: 'empty', team1: null, team2: null });
      } else if (right0) {
        curNodes.push({ type: 'bye-advance', team1: t1, team2: null });
      } else if (left0) {
        curNodes.push({ type: 'bye-advance', team1: t2, team2: null });
      } else if (t1 && t2) {
        const match = matches.find(
          m =>
            m.round === r + 1 &&
            ((m.team1.id === t1.id && m.team2.id === t2.id) ||
              (m.team1.id === t2.id && m.team2.id === t1.id)),
        );
        curNodes.push(
          match
            ? { type: 'match', match, team1: match.team1, team2: match.team2 }
            : { type: 'tbd', team1: t1, team2: t2 },
        );
      } else {
        curNodes.push({ type: 'tbd', team1: t1, team2: t2 });
      }
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
