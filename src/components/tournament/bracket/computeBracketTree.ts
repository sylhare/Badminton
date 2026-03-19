import type { SEBracket, TournamentMatch, TournamentTeam } from '../../../types/tournament';
import Tournament from '../../../utils/Tournament';

import type { BracketNode } from './types';

export function computeBracketTree(
  seBracket: SEBracket,
  teams: TournamentTeam[],
  matches: TournamentMatch[],
): BracketNode[][] {
  const { size, seeding } = seBracket;
  const totalRounds = Math.log2(size);
  const teamMap = new Map(teams.map(t => [t.id, t]));
  const nodes: BracketNode[][] = [];

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
        m => Tournament.isWB(m) &&
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

  const getAdvancer = (node: BracketNode): TournamentTeam | null => {
    if (node.type === 'bye-advance') return node.team1;
    if (node.type === 'match' && node.match) {
      if (node.match.winner === 1) return node.match.team1;
      if (node.match.winner === 2) return node.match.team2;
    }
    return null;
  };

  const isPermanentlyEmpty = (node: BracketNode): boolean => node.type === 'empty';

  for (let r = 1; r < totalRounds; r++) {
    const prevNodes = nodes[r - 1];
    const curCount = size >> (r + 1);
    const curNodes: BracketNode[] = [];

    for (let i = 0; i < curCount; i++) {
      const leftNode = prevNodes[2 * i];
      const rightNode = prevNodes[2 * i + 1];
      const t1 = getAdvancer(leftNode);
      const t2 = getAdvancer(rightNode);
      const left0 = isPermanentlyEmpty(leftNode);
      const right0 = isPermanentlyEmpty(rightNode);

      if (left0 && right0) {
        curNodes.push({ type: 'empty', team1: null, team2: null });
      } else if (right0) {
        curNodes.push({ type: 'bye-advance', team1: t1, team2: null });
      } else if (left0) {
        curNodes.push({ type: 'bye-advance', team1: t2, team2: null });
      } else if (t1 && t2) {
        const match = matches.find(
          m => Tournament.isWB(m) &&
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

  return nodes;
}
