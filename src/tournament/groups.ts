import type { TournamentTeam } from './types';

/**
 * Split teams into balanced groups, targeting `groupSize` teams each. The team
 * count rarely divides evenly, so the number of groups is `ceil(n / groupSize)`
 * and the remainder is spread one-per-group (sizes differ by at most one).
 */
export function partitionIntoGroups(teams: TournamentTeam[], groupSize: number): TournamentTeam[][] {
  const n = teams.length;
  if (n === 0) return [];

  const size = Math.max(2, groupSize);
  const numGroups = Math.max(1, Math.min(Math.ceil(n / size), Math.floor(n / 2)));
  const base = Math.floor(n / numGroups);
  const remainder = n % numGroups;

  const groups: TournamentTeam[][] = [];
  let index = 0;
  for (let g = 0; g < numGroups; g++) {
    const count = base + (g < remainder ? 1 : 0);
    groups.push(teams.slice(index, index + count));
    index += count;
  }
  return groups;
}

/**
 * Order group qualifiers for the knockout bracket so group winners are kept
 * apart and face lower-ranked qualifiers first. Builds an overall strength list
 * (all group winners, then all runners-up, …) then folds strongest against
 * weakest into adjacent pairs — the order the bracket generator pairs up.
 *
 * `qualifiersByGroup[g]` is group g's advancing teams, best-first.
 */
export function seedQualifiers(qualifiersByGroup: TournamentTeam[][]): TournamentTeam[] {
  const maxRank = Math.max(0, ...qualifiersByGroup.map(group => group.length));
  const strength: TournamentTeam[] = [];
  for (let rank = 0; rank < maxRank; rank++) {
    for (const group of qualifiersByGroup) {
      if (group[rank]) strength.push(group[rank]);
    }
  }

  const order: TournamentTeam[] = [];
  let lo = 0;
  let hi = strength.length - 1;
  while (lo <= hi) {
    order.push(strength[lo]);
    if (lo !== hi) order.push(strength[hi]);
    lo++;
    hi--;
  }
  return order;
}
