import { describe, expect, it } from 'vitest';

import { computeBracketNodes } from '../../../src/tournament/bracket/computeBracketNodes';
import { SEED_ABSENT, SEED_TBD } from '../../../src/tournament/bracket/types';
import type { SeedSlot } from '../../../src/tournament/bracket/types';
import { makeMatch, makeTeam } from '../../data/tournamentFactories';

const tA = makeTeam('a', 'Alice');
const tB = makeTeam('b', 'Bob');
const tC = makeTeam('c', 'Carol');
const tD = makeTeam('d', 'Dana');
const tE = makeTeam('e', 'Eve');
const tF = makeTeam('f', 'Frank');

// ---------------------------------------------------------------------------
// Winners bracket — call with pre-mapped seeding (null → SEED_ABSENT)
// ---------------------------------------------------------------------------

describe('computeBracketNodes — winners bracket', () => {
  it('2 teams: 1 round, 1 match node', () => {
    const match = makeMatch('m1', 1, tA, tB, undefined, undefined, 'wb');
    const { nodes } = computeBracketNodes(['a', 'b'], [match], [tA, tB]);

    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toHaveLength(1);
    expect(nodes[0][0].type).toBe('match');
    expect(nodes[0][0].match?.id).toBe('m1');
  });

  it('4 teams, no results: 2 rounds; R1 has 2 match nodes; R2 has 1 tbd node', () => {
    const m1 = makeMatch('m1', 1, tA, tB, undefined, undefined, 'wb');
    const m2 = makeMatch('m2', 1, tC, tD, undefined, undefined, 'wb');
    const { nodes } = computeBracketNodes(['a', 'b', 'c', 'd'], [m1, m2], [tA, tB, tC, tD]);

    expect(nodes).toHaveLength(2);
    expect(nodes[0]).toHaveLength(2);
    expect(nodes[0][0].type).toBe('match');
    expect(nodes[0][1].type).toBe('match');
    expect(nodes[1]).toHaveLength(1);
    expect(nodes[1][0].type).toBe('tbd');
    expect(nodes[1][0].team1).toBeNull();
    expect(nodes[1][0].team2).toBeNull();
  });

  it('4 teams, R1 complete: R2 node becomes match type after both R1 winners determined', () => {
    const m1 = makeMatch('m1', 1, tA, tB, 1, undefined, 'wb');
    const m2 = makeMatch('m2', 1, tC, tD, 2, undefined, 'wb');
    const final = makeMatch('mf', 2, tA, tD, undefined, undefined, 'wb');
    const { nodes } = computeBracketNodes(['a', 'b', 'c', 'd'], [m1, m2, final], [tA, tB, tC, tD]);

    expect(nodes[1][0].type).toBe('match');
    expect(nodes[1][0].match?.id).toBe('mf');
    expect(nodes[1][0].team1?.id).toBe('a');
    expect(nodes[1][0].team2?.id).toBe('d');
  });

  it('3 teams (1 bye): R1 has 1 match + 1 bye-advance', () => {
    const m1 = makeMatch('m1', 1, tB, tC, undefined, undefined, 'wb');
    const seeding: SeedSlot[] = ['a', SEED_ABSENT, 'b', 'c'];
    const { nodes } = computeBracketNodes(seeding, [m1], [tA, tB, tC]);

    expect(nodes[0]).toHaveLength(2);
    expect(nodes[0][0].type).toBe('bye-advance');
    expect(nodes[0][0].team1?.id).toBe('a');
    expect(nodes[0][1].type).toBe('match');
  });

  it('bye-advance: team1 is the bye team', () => {
    const seeding: SeedSlot[] = ['a', SEED_ABSENT, 'b', 'c'];
    const { nodes } = computeBracketNodes(seeding, [], [tA, tB, tC]);

    const byeNode = nodes[0][0];
    expect(byeNode.type).toBe('bye-advance');
    expect(byeNode.team1?.id).toBe('a');
    expect(byeNode.team2).toBeNull();
  });

  it('6 teams (2 byes): R1 has 4 nodes (2 match + 2 bye-advance)', () => {
    const m1 = makeMatch('m1', 1, tB, tC, undefined, undefined, 'wb');
    const m2 = makeMatch('m2', 1, tE, tF, undefined, undefined, 'wb');
    const seeding: SeedSlot[] = ['a', SEED_ABSENT, 'b', 'c', 'd', SEED_ABSENT, 'e', 'f'];
    const { nodes } = computeBracketNodes(seeding, [m1, m2], [tA, tB, tC, tD, tE, tF]);

    expect(nodes[0]).toHaveLength(4);
    const types = nodes[0].map(n => n.type);
    expect(types.filter(t => t === 'bye-advance')).toHaveLength(2);
    expect(types.filter(t => t === 'match')).toHaveLength(2);
  });

  it('advancer resolution: after R1 winner set, R2 picks up correct teams', () => {
    const m1 = makeMatch('m1', 1, tA, tB, 2, undefined, 'wb');
    const m2 = makeMatch('m2', 1, tC, tD, 1, undefined, 'wb');
    const { nodes } = computeBracketNodes(['a', 'b', 'c', 'd'], [m1, m2], [tA, tB, tC, tD]);

    expect(nodes[1][0].type).toBe('tbd');
    expect(nodes[1][0].team1?.id).toBe('b');
    expect(nodes[1][0].team2?.id).toBe('c');
  });
});

// ---------------------------------------------------------------------------
// Winners bracket geometry
// ---------------------------------------------------------------------------

describe('computeBracketNodes — winners bracket geometry', () => {
  it('connectorTypes are all bracket', () => {
    const { connectorTypes } = computeBracketNodes(['a', 'b', 'c', 'd'], [], [tA, tB, tC, tD]);
    expect(connectorTypes).toEqual(['bracket']);
  });
});

// ---------------------------------------------------------------------------
// Consolation bracket structure
// ---------------------------------------------------------------------------

describe('computeBracketNodes — consolation bracket (8 teams, before R1)', () => {
  it('returns 2 cols [2, 1] all tbd before round 1', () => {
    const tG = makeTeam('g', 'Gus');
    const tH = makeTeam('h', 'Hana');
    const teams = [tA, tB, tC, tD, tE, tF, tG, tH];
    // 8 teams → 4 real pairs → 4 losers TBD
    const consolSeeding: SeedSlot[] = [SEED_TBD, SEED_TBD, SEED_TBD, SEED_TBD];
    const { nodes } = computeBracketNodes(consolSeeding, [], teams);

    expect(nodes).toHaveLength(2);
    expect(nodes[0]).toHaveLength(2);
    expect(nodes[1]).toHaveLength(1);
    nodes.flat().forEach(n => expect(n.type).toBe('tbd'));
  });
});

describe('computeBracketNodes — consolation bracket (6 teams)', () => {
  const teams = [tA, tB, tC, tD, tE, tF];
  // 6 teams: 3 real pairs → 3 losers TBD, pad to power of 2 → [TBD, TBD, TBD, ABSENT]
  const consolSeedingBefore: SeedSlot[] = [SEED_TBD, SEED_TBD, SEED_TBD, SEED_ABSENT];

  it('returns 2 cols [2, 1] before round 1', () => {
    const { nodes } = computeBracketNodes(consolSeedingBefore, [], teams);
    expect(nodes).toHaveLength(2);
    expect(nodes[0]).toHaveLength(2);
    expect(nodes[1]).toHaveLength(1);
  });

  it('col 0: both nodes are tbd before R1 (TBD+TBD and TBD+ABSENT pairs)', () => {
    const { nodes } = computeBracketNodes(consolSeedingBefore, [], teams);
    expect(nodes[0][0].type).toBe('tbd');
    expect(nodes[0][1].type).toBe('tbd');
  });

  it('after R1: col 0 has [match, bye-advance]', () => {
    // WB R1 complete: a beats b (loser=b), c beats d (loser=d), e beats f (loser=f)
    // consolSeeding after R1: [b, d, f, ABSENT] — f gets a bye
    const consolSeeding: SeedSlot[] = ['b', 'd', 'f', SEED_ABSENT];
    const lb1 = makeMatch('lb1', 1, tB, tD, undefined, undefined, 'lb');
    const { nodes } = computeBracketNodes(consolSeeding, [lb1], teams);

    expect(nodes[0][0].type).toBe('match');
    expect(nodes[0][0].match?.id).toBe('lb1');
    expect(nodes[0][1].type).toBe('bye-advance');
    expect(nodes[0][1].team1?.id).toBe('f');
  });

  it('connectorTypes are all bracket', () => {
    const { connectorTypes } = computeBracketNodes(consolSeedingBefore, [], teams);
    expect(connectorTypes).toEqual(['bracket']);
  });
});

// ---------------------------------------------------------------------------
// Consolation bracket (4 teams)
// ---------------------------------------------------------------------------

describe('computeBracketNodes — consolation bracket (4 teams)', () => {
  it('returns 1 col with 1 tbd node before R1', () => {
    // 4 teams → 2 real pairs → 2 losers TBD
    const consolSeeding: SeedSlot[] = [SEED_TBD, SEED_TBD];
    const { nodes } = computeBracketNodes(consolSeeding, [], [tA, tB, tC, tD]);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toHaveLength(1);
    expect(nodes[0][0].type).toBe('tbd');
  });

  it('returns empty for empty seeding (no consolation bracket)', () => {
    const { nodes } = computeBracketNodes([], [], [tA, tB]);
    expect(nodes).toHaveLength(0);
  });
});
