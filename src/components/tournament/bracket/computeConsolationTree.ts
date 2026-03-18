import type { SEBracket, TournamentMatch } from '../../../types/tournament';

import type { BracketNode } from './types';

/**
 * Pre-computes consolation bracket nodes for all rounds, filling slots with TBD nodes
 * when matches haven't been generated yet. Returns an empty array when there is no
 * consolation bracket (e.g. 2-team tournaments).
 */
export function computeConsolationTree(
  seBracket: SEBracket,
  matches: TournamentMatch[],
): BracketNode[][] {
  const wbRounds = Math.log2(seBracket.size);
  const lbRounds = 2 * (wbRounds - 1) - 1;
  if (lbRounds <= 0) return [];

  let numWBR1Matches = 0;
  for (let i = 0; i < seBracket.size / 2; i++) {
    if (seBracket.seeding[2 * i] !== null && seBracket.seeding[2 * i + 1] !== null) {
      numWBR1Matches++;
    }
  }

  const lbMatches = matches.filter(m => m.bracket === 'lb');
  const nodes: BracketNode[][] = [];
  let prevRoundCount = 0;

  for (let lbRound = 1; lbRound <= lbRounds; lbRound++) {
    let roundCount: number;
    if (lbRound === 1) {
      roundCount = Math.floor(numWBR1Matches / 2);
    } else if (lbRound % 2 === 0) {
      roundCount = prevRoundCount; // challenge round: same count as previous
    } else {
      roundCount = Math.floor(prevRoundCount / 2); // consolidation round
    }
    if (roundCount === 0) break;

    const roundMatches = lbMatches.filter(m => m.round === lbRound);
    const roundNodes: BracketNode[] = Array.from({ length: roundCount }, (_, i) => {
      const match = roundMatches[i];
      return match
        ? { type: 'match' as const, match, team1: match.team1, team2: match.team2 }
        : { type: 'tbd' as const, team1: null, team2: null };
    });

    nodes.push(roundNodes);
    prevRoundCount = roundCount;
  }

  return nodes;
}
