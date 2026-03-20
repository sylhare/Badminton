import type { TournamentMatch, TournamentTeam } from '../../types/tournament';
import Tournament from '../Tournament';

import type { BracketConfig, BracketNode, SeedSlot } from './types';
import {
  CN,
  CW,
  MH,
  SH,
  SEED_ABSENT,
  SEED_TBD,
  consolationTop,
  winnersTop,
} from './types';

export interface BracketLayout {
  nodes: BracketNode[][];
  tops: number[][];
  connectorTypes: Array<'bracket' | 'none'>;
  totalH: number;
  totalW: number;
}

export function computeBracketNodes(
  bracket: BracketConfig,
  teams: TournamentTeam[],
  matches: TournamentMatch[],
): BracketLayout {
  const teamMap = new Map(teams.map(t => [t.id, t]));

  const getAdvancer = (node: BracketNode): TournamentTeam | null => {
    if (node.type === 'bye-advance') return node.team1;
    if (node.type === 'match' && node.match) {
      if (node.match.winner === 1) return node.match.team1;
      if (node.match.winner === 2) return node.match.team2;
    }
    return null;
  };

  // ---------------------------------------------------------------------------
  // Winners bracket
  // ---------------------------------------------------------------------------

  if (bracket.side === 'winners') {
    const { size, seeding } = bracket.setup;
    const totalRounds = Math.log2(size);
    const nodes: BracketNode[][] = [];

    // Round 1: parse seeding pairs
    const r1Nodes: BracketNode[] = [];
    for (let i = 0; i < size / 2; i++) {
      const t1Id = seeding[2 * i];
      const t2Id = seeding[2 * i + 1];
      if (t1Id === null && t2Id === null) {
        r1Nodes.push({ type: 'empty', team1: null, team2: null });
      } else if (t1Id === null || t2Id === null) {
        const advancingId = t1Id ?? t2Id;
        r1Nodes.push({
          type: 'bye-advance',
          team1: advancingId ? (teamMap.get(advancingId) ?? null) : null,
          team2: null,
        });
      } else {
        const match = matches.find(
          m =>
            Tournament.isWinners(m) &&
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

    // Subsequent rounds
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
              Tournament.isWinners(m) &&
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
    const totalH = Math.max(r1Count, 1) * SH + MH;
    const totalW = nodes.length * CW + Math.max(nodes.length - 1, 0) * CN;

    return { nodes, tops, connectorTypes, totalH, totalW };
  }

  // ---------------------------------------------------------------------------
  // Consolation bracket
  // ---------------------------------------------------------------------------

  const { setup } = bracket;

  // Derive consolation seeding from WB R1 results
  const consolSeeding: SeedSlot[] = [];
  for (let i = 0; i < setup.size / 2; i++) {
    const t1Id = setup.seeding[2 * i];
    const t2Id = setup.seeding[2 * i + 1];
    if (t1Id !== null && t2Id !== null) {
      const match = matches.find(
        m =>
          Tournament.isWinners(m) &&
          m.round === 1 &&
          ((m.team1.id === t1Id && m.team2.id === t2Id) ||
            (m.team1.id === t2Id && m.team2.id === t1Id)),
      );
      if (match?.winner !== undefined) {
        consolSeeding.push(match.winner === 1 ? match.team2.id : match.team1.id);
      } else {
        consolSeeding.push(SEED_TBD);
      }
    }
    // bye pairs (one null) and empty pairs (null,null) contribute no consolation seeder
  }

  // Structural bye for odd loser count
  if (consolSeeding.length % 2 !== 0) consolSeeding.push(SEED_ABSENT);

  // Pad to next power of 2 with pairs of SEED_ABSENT
  let p = 1;
  while (p < consolSeeding.length) p <<= 1;
  while (consolSeeding.length < p) {
    consolSeeding.push(SEED_ABSENT);
    consolSeeding.push(SEED_ABSENT);
  }

  if (consolSeeding.length === 0) return { nodes: [], tops: [], connectorTypes: [], totalH: 0, totalW: 0 };

  const wbRounds = Math.log2(setup.size);
  const lbRounds = 2 * (wbRounds - 1) - 1;
  if (lbRounds <= 0) return { nodes: [], tops: [], connectorTypes: [], totalH: 0, totalW: 0 };

  const consolMatches = matches.filter(m => Tournament.isConsolation(m));
  const nodes: BracketNode[][] = [];

  // Col 0: first reduction round (parse seeding pairs)
  const col0: BracketNode[] = [];
  let r1MatchIdx = 0;
  const r1Matches = consolMatches.filter(m => m.round === 1);

  for (let i = 0; i < consolSeeding.length / 2; i++) {
    const s1 = consolSeeding[2 * i];
    const s2 = consolSeeding[2 * i + 1];

    if (s1 === SEED_ABSENT && s2 === SEED_ABSENT) {
      col0.push({ type: 'empty', team1: null, team2: null });
    } else if (s1 === SEED_ABSENT || s2 === SEED_ABSENT) {
      // Consolation structural gap: team skips reduction round → empty (not bye-advance)
      col0.push({ type: 'empty', team1: null, team2: null });
    } else if (s1 === SEED_TBD || s2 === SEED_TBD) {
      col0.push({ type: 'tbd', team1: null, team2: null });
    } else {
      const t1 = teamMap.get(s1 as string) ?? null;
      const t2 = teamMap.get(s2 as string) ?? null;
      const match = r1Matches[r1MatchIdx++];
      col0.push(
        match
          ? { type: 'match', match, team1: match.team1, team2: match.team2 }
          : { type: 'tbd', team1: t1, team2: t2 },
      );
    }
  }
  nodes.push(col0);

  // Subsequent columns
  const totalCols = 2 * Math.log2(consolSeeding.length) - 1;

  for (let colIdx = 1; colIdx < totalCols; colIdx++) {
    const prevNodes = nodes[colIdx - 1];
    const lbRound = colIdx + 1;
    const roundMatches = consolMatches.filter(m => m.round === lbRound);
    const curNodes: BracketNode[] = [];

    if (colIdx % 2 === 1) {
      // Challenge column: same count as prev; empty propagates, others get a match or tbd
      let matchIdx = 0;
      for (const prevNode of prevNodes) {
        if (prevNode.type === 'empty') {
          curNodes.push({ type: 'empty', team1: null, team2: null });
        } else {
          const match = roundMatches[matchIdx++];
          curNodes.push(
            match
              ? { type: 'match', match, team1: match.team1, team2: match.team2 }
              : { type: 'tbd', team1: null, team2: null },
          );
        }
      }
    } else {
      // Reduction column: pair up prev nodes
      let matchIdx = 0;
      const count = Math.ceil(prevNodes.length / 2);
      for (let i = 0; i < count; i++) {
        const left = prevNodes[2 * i];
        const right = prevNodes[2 * i + 1];

        if (left.type === 'empty' && (!right || right.type === 'empty')) {
          curNodes.push({ type: 'empty', team1: null, team2: null });
          continue;
        }

        const match = roundMatches[matchIdx++];
        if (match) {
          curNodes.push({ type: 'match', match, team1: match.team1, team2: match.team2 });
        } else {
          const t1 = getAdvancer(left);
          const t2 = right ? getAdvancer(right) : null;
          curNodes.push({ type: 'tbd', team1: t1, team2: t2 });
        }
      }
    }

    nodes.push(curNodes);
  }

  const tops = nodes.map((col, colIdx) => col.map((_, nodeIdx) => consolationTop(colIdx, nodeIdx)));
  // connectorTypes: 'none' for even→odd (reduction→challenge), 'bracket' for odd→even (challenge→reduction)
  const connectorTypes: Array<'bracket' | 'none'> = nodes
    .slice(0, -1)
    .map((_, i) => (i % 2 === 0 ? 'none' : 'bracket'));

  const firstColCount = nodes[0].length;
  const totalH = Math.max(firstColCount, 1) * SH + MH;
  const totalW = nodes.length * CW + Math.max(nodes.length - 1, 0) * CN;

  return { nodes, tops, connectorTypes, totalH, totalW };
}
