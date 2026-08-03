import { describe, expect, it } from 'vitest';

import { partitionIntoGroups, seedQualifiers } from '../../src/tournament/groups';
import { createTournamentTeams } from '../data/testFactories';

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

  it('returns no groups for no teams', () => {
    expect(partitionIntoGroups([], 4)).toEqual([]);
  });
});

describe('seedQualifiers', () => {
  it('cross-pairs group winners against runners-up of other groups', () => {
    // groups A and B, each [winner, runner-up]
    const [a1, a2, b1, b2] = createTournamentTeams(['a1', 'a2', 'b1', 'b2']);
    const order = seedQualifiers([[a1, a2], [b1, b2]]);
    // strength = [a1, b1, a2, b2]; folded = [a1, b2, b1, a2]
    // adjacent bracket pairs: (a1 vs b2) and (b1 vs a2) — winners never meet a winner.
    expect(order.map(t => t.id)).toEqual(['a1', 'b2', 'b1', 'a2']);
  });

  it('places the strongest against the weakest for four groups of two', () => {
    const teams = createTournamentTeams(['a1', 'a2', 'b1', 'b2', 'c1', 'c2', 'd1', 'd2']);
    const [a1, a2, b1, b2, c1, c2, d1, d2] = teams;
    const order = seedQualifiers([[a1, a2], [b1, b2], [c1, c2], [d1, d2]]);
    // strength = [a1,b1,c1,d1, a2,b2,c2,d2]; folded strongest-vs-weakest:
    expect(order.map(t => t.id)).toEqual(['a1', 'd2', 'b1', 'c2', 'c1', 'b2', 'd1', 'a2']);
  });

  it('returns an empty list when no group qualifies', () => {
    expect(seedQualifiers([])).toEqual([]);
  });
});
