import type { TournamentTeam } from './types';
import { nextPowerOf2 } from './bracketTree';

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
 * Order group qualifiers into knockout seed ranks (all group winners, then all runners-up, …). The
 * bracket then places rank r against rank size−1−r in round 1, so this only has to reorder ranks to
 * dodge same-group rematches: whenever two same-group teams would meet, the lower one is swapped with
 * another real seed. Bye placement is left to standard seeding, which already favours the top seeds.
 *
 * `qualifiersByGroup[g]` is group g's advancing teams, best-first.
 */
export function seedQualifiers(qualifiersByGroup: TournamentTeam[][]): TournamentTeam[] {
  const maxRank = Math.max(0, ...qualifiersByGroup.map(group => group.length));
  const seeds: TournamentTeam[] = [];
  const groupOf = new Map<TournamentTeam, number>();
  for (let rank = 0; rank < maxRank; rank++) {
    qualifiersByGroup.forEach((group, g) => {
      if (group[rank]) { groupOf.set(group[rank], g); seeds.push(group[rank]); }
    });
  }

  const size = nextPowerOf2(seeds.length);
  const opponent = (r: number) => size - 1 - r;
  const isReal = (r: number) => r < seeds.length && opponent(r) < seeds.length;
  const sameGroup = (a: number, b: number) => groupOf.get(seeds[a]) === groupOf.get(seeds[b]);

  for (let r = 0; r < size / 2; r++) {
    if (!isReal(r) || !sameGroup(r, opponent(r))) continue;
    for (let k = 0; k < seeds.length; k++) {
      if (k === r || k === opponent(r) || !isReal(k)) continue;
      if (!sameGroup(r, k) && !sameGroup(opponent(r), opponent(k))) {
        [seeds[opponent(r)], seeds[k]] = [seeds[k], seeds[opponent(r)]];
        break;
      }
    }
  }
  return seeds;
}
