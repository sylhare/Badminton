import { describe, expect, it } from 'vitest';

import { partitionIntoGroups, seedQualifiers } from '../../src/tournament/groups';
import { nextPowerOf2, seedSlots } from '../../src/tournament/bracketTree';
import { createTournamentTeams } from '../data/testFactories';
import type { TournamentTeam } from '../../src/tournament/types';

describe('partitionIntoGroups', () => {
  it('splits an even count into equal groups', () => {
    const teams = createTournamentTeams(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
    const groups = partitionIntoGroups(teams, 4);
    expect(groups.map(g => g.length)).toEqual([4, 4]);
  });

  it('spreads a remainder one team per group (sizes differ by at most one)', () => {
    const teams = createTournamentTeams(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']);
    const groups = partitionIntoGroups(teams, 4);
    expect(groups.map(g => g.length)).toEqual([4, 3, 3]);
  });

  it('keeps every team exactly once across the groups', () => {
    const teams = createTournamentTeams(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
    const groups = partitionIntoGroups(teams, 3);
    const ids = groups.flat().map(t => t.id).sort();
    expect(ids).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
  });

  it('never produces a group smaller than a pair even if groupSize is 1', () => {
    const teams = createTournamentTeams(['a', 'b', 'c', 'd']);
    const groups = partitionIntoGroups(teams, 1);
    for (const group of groups) expect(group.length).toBeGreaterThanOrEqual(2);
  });

  it('never leaves a singleton group for an odd count with a group size of two', () => {
    const teams = createTournamentTeams(['a', 'b', 'c', 'd', 'e']);
    const groups = partitionIntoGroups(teams, 2);
    expect(groups.map(g => g.length)).toEqual([3, 2]);
    for (const group of groups) expect(group.length).toBeGreaterThanOrEqual(2);
  });

  it('returns no groups for no teams', () => {
    expect(partitionIntoGroups([], 4)).toEqual([]);
  });
});

describe('seedQualifiers', () => {
  /** Build `nGroups` groups of `perGroup` teams, ids tagged `g-rank`, plus a group lookup. */
  const groupsOf = (nGroups: number, perGroup: number) => {
    const groups: TournamentTeam[][] = Array.from({ length: nGroups }, (_, g) =>
      createTournamentTeams(Array.from({ length: perGroup }, (_, r) => `${g}-${r}`)));
    const groupOf = new Map(groups.flatMap((grp, g) => grp.map(t => [t.id, g] as const)));
    return { groups, groupOf };
  };

  it('seeds all group winners ahead of the runners-up, so byes fall on the top seeds', () => {
    const [a1, a2, b1, b2] = createTournamentTeams(['a1', 'a2', 'b1', 'b2']);
    const order = seedQualifiers([[a1, a2], [b1, b2]]);
    expect(order.slice(0, 2).map(t => t.id).sort()).toEqual(['a1', 'b1']);
  });

  it('never pairs a group against itself in round 1, across group counts', () => {
    for (const [nGroups, perGroup] of [[2, 2], [3, 2], [3, 3], [5, 2], [5, 3], [6, 2], [7, 2]] as const) {
      const { groups, groupOf } = groupsOf(nGroups, perGroup);
      const order = seedQualifiers(groups);
      const slots = seedSlots(order, nextPowerOf2(order.length));
      for (let p = 0; p < nextPowerOf2(order.length) / 2; p++) {
        const a = slots[2 * p], b = slots[2 * p + 1];
        if (a && b) expect(groupOf.get(a.id)).not.toBe(groupOf.get(b.id));
      }
    }
  });

  it('returns an empty list when no group qualifies', () => {
    expect(seedQualifiers([])).toEqual([]);
  });
});
