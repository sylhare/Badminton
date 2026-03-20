import { describe, expect, it } from 'vitest';

import {
  computeBracketNodes,
  computeWinnersSeeding,
  computeConsolationSeeding,
  findMatch,
  makePairNode,
  makeSlotNode,
} from '../../src/tournament/BracketNodes.ts';
import { SEED_ABSENT, SEED_TBD } from '../../src/tournament/types';
import type { SeedSlot } from '../../src/tournament/types';
import { makeMatch, makeTeam } from '../data/tournamentFactories';

const tA = makeTeam('a', 'Alice');
const tB = makeTeam('b', 'Bob');
const tC = makeTeam('c', 'Carol');
const tD = makeTeam('d', 'Dana');
const tE = makeTeam('e', 'Eve');
const tF = makeTeam('f', 'Frank');

describe('computeWinnersSeeding', () => {
  it('passes string IDs through unchanged', () => {
    const result = computeWinnersSeeding({ size: 4, seeding: ['a', 'b', 'c', 'd'] });
    expect(result).toEqual(['a', 'b', 'c', 'd']);
  });

  it('maps null → SEED_ABSENT', () => {
    const result = computeWinnersSeeding({ size: 4, seeding: ['a', null, 'b', 'c'] });
    expect(result).toEqual(['a', SEED_ABSENT, 'b', 'c']);
  });

  it('handles all-real seeding with no nulls', () => {
    const result = computeWinnersSeeding({ size: 2, seeding: ['x', 'y'] });
    expect(result).toEqual(['x', 'y']);
  });
});

describe('computeConsolationSeeding', () => {
  it('before R1: all real pairs produce SEED_TBD entries', () => {
    const seBracket = { size: 4, seeding: ['a', 'b', 'c', 'd'] };
    const result = computeConsolationSeeding(seBracket, []);
    expect(result).toEqual([SEED_TBD, SEED_TBD]);
  });

  it('bye pairs (one null) are skipped', () => {

    const seBracket = { size: 4, seeding: ['a', 'b', 'c', null] };
    const result = computeConsolationSeeding(seBracket, []);

    expect(result).toEqual([SEED_TBD, SEED_ABSENT]);
  });

  it('null-null pairs are skipped', () => {
    const seBracket = { size: 4, seeding: ['a', 'b', null, null] };
    const result = computeConsolationSeeding(seBracket, []);

    expect(result).toEqual([SEED_TBD, SEED_ABSENT]);
  });

  it('after R1 results: loser IDs appear in output', () => {
    const seBracket = { size: 4, seeding: ['a', 'b', 'c', 'd'] };
    const m1 = makeMatch('m1', 1, tA, tB, 1, undefined, 'wb');
    const m2 = makeMatch('m2', 1, tC, tD, 2, undefined, 'wb');
    const result = computeConsolationSeeding(seBracket, [m1, m2]);
    expect(result).toEqual(['b', 'c']);
  });

  it('odd loser count: pads with SEED_ABSENT to make even', () => {

    const seBracket = { size: 6, seeding: ['a', 'b', 'c', 'd', 'e', 'f'] };
    const result = computeConsolationSeeding(seBracket, []);
    expect(result.length % 2).toBe(0);
    expect(result[3]).toBe(SEED_ABSENT);
  });

  it('result length is always a power of 2', () => {
    const isPow2 = (n: number) => n > 0 && (n & (n - 1)) === 0;
    const seBracket = { size: 6, seeding: ['a', 'b', 'c', 'd', 'e', 'f'] };
    const result = computeConsolationSeeding(seBracket, []);
    expect(isPow2(result.length)).toBe(true);
  });
});

describe('bracketNodes — winners bracket', () => {
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

describe('bracketNodes — winners bracket geometry', () => {
  it('connectorTypes are all bracket', () => {
    const { connectorTypes } = computeBracketNodes(['a', 'b', 'c', 'd'], [], [tA, tB, tC, tD]);
    expect(connectorTypes).toEqual(['bracket']);
  });
});

describe('bracketNodes — consolation bracket (8 teams, before R1)', () => {
  it('returns 2 cols [2, 1] all tbd before round 1', () => {
    const tG = makeTeam('g', 'Gus');
    const tH = makeTeam('h', 'Hana');
    const teams = [tA, tB, tC, tD, tE, tF, tG, tH];
    const consolSeeding: SeedSlot[] = [SEED_TBD, SEED_TBD, SEED_TBD, SEED_TBD];
    const { nodes } = computeBracketNodes(consolSeeding, [], teams);

    expect(nodes).toHaveLength(2);
    expect(nodes[0]).toHaveLength(2);
    expect(nodes[1]).toHaveLength(1);
    nodes.flat().forEach(n => expect(n.type).toBe('tbd'));
  });
});

describe('bracketNodes — consolation bracket (6 teams)', () => {
  const teams = [tA, tB, tC, tD, tE, tF];
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

describe('findMatch', () => {
  const m = makeMatch('m1', 1, tA, tB);

  it('returns match in canonical team order', () => {
    expect(findMatch([m], 1, 'a', 'b')).toBe(m);
  });

  it('returns match in reversed team order', () => {
    expect(findMatch([m], 1, 'b', 'a')).toBe(m);
  });

  it('returns undefined for wrong round', () => {
    expect(findMatch([m], 2, 'a', 'b')).toBeUndefined();
  });

  it('returns undefined when matches array is empty', () => {
    expect(findMatch([], 1, 'a', 'b')).toBeUndefined();
  });
});

describe('makePairNode', () => {
  const m = makeMatch('m1', 1, tA, tB);

  it('t1 null, t2 present → tbd', () => {
    expect(makePairNode(null, tB, 1, [])).toEqual({ type: 'tbd', team1: null, team2: tB });
  });

  it('t1 present, t2 null → tbd', () => {
    expect(makePairNode(tA, null, 1, [])).toEqual({ type: 'tbd', team1: tA, team2: null });
  });

  it('both null → tbd', () => {
    expect(makePairNode(null, null, 1, [])).toEqual({ type: 'tbd', team1: null, team2: null });
  });

  it('both present, no match → tbd with teams', () => {
    expect(makePairNode(tA, tB, 1, [])).toEqual({ type: 'tbd', team1: tA, team2: tB });
  });

  it('both present, match found (no winner) → match node', () => {
    expect(makePairNode(tA, tB, 1, [m])).toMatchObject({ type: 'match', match: m, team1: tA, team2: tB });
  });

  it('both present, match found with winner → match node', () => {
    const mWithWinner = makeMatch('m2', 1, tA, tB, 1);
    expect(makePairNode(tA, tB, 1, [mWithWinner])).toMatchObject({ type: 'match', match: mWithWinner });
  });
});

describe('makeSlotNode', () => {
  const m = makeMatch('m1', 1, tA, tB);

  it('both absent → empty', () => {
    expect(makeSlotNode(null, null, true, true, 1, [])).toEqual({ type: 'empty', team1: null, team2: null });
  });

  it('absent2 only → bye-advance with t1', () => {
    expect(makeSlotNode(tA, null, false, true, 1, [])).toEqual({ type: 'bye-advance', team1: tA, team2: null });
  });

  it('absent1 only → bye-advance with t2', () => {
    expect(makeSlotNode(null, tB, true, false, 1, [])).toEqual({ type: 'bye-advance', team1: tB, team2: null });
  });

  it('neither absent, no match → tbd with teams', () => {
    expect(makeSlotNode(tA, tB, false, false, 1, [])).toEqual({ type: 'tbd', team1: tA, team2: tB });
  });

  it('neither absent, match found → match node', () => {
    expect(makeSlotNode(tA, tB, false, false, 1, [m])).toMatchObject({ type: 'match', match: m });
  });

  it('neither absent, both t1/t2 null → tbd (null, null)', () => {
    expect(makeSlotNode(null, null, false, false, 1, [])).toEqual({ type: 'tbd', team1: null, team2: null });
  });
});

describe('bracketNodes — consolation bracket (4 teams)', () => {
  it('returns 1 col with 1 tbd node before R1', () => {
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
