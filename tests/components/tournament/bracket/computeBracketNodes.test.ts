import { describe, expect, it } from 'vitest';

import { computeBracketNodes } from '../../../../src/components/tournament/bracket/computeBracketNodes';
import type { EliminationSetup } from '../../../../src/types/tournament';
import { makeMatch, makeTeam } from '../../../data/tournamentFactories';

const tA = makeTeam('a', 'Alice');
const tB = makeTeam('b', 'Bob');
const tC = makeTeam('c', 'Carol');
const tD = makeTeam('d', 'Dana');
const tE = makeTeam('e', 'Eve');
const tF = makeTeam('f', 'Frank');

// ---------------------------------------------------------------------------
// Winners bracket (side='winners') — mirrors former computeBracketTree tests
// ---------------------------------------------------------------------------

describe('computeBracketNodes — winners bracket', () => {
  it('2 teams: 1 round, 1 match node', () => {
    const setup: EliminationSetup = { size: 2, seeding: ['a', 'b'] };
    const match = makeMatch('m1', 1, tA, tB, undefined, undefined, 'wb');
    const { nodes } = computeBracketNodes({ side: 'winners', setup }, [tA, tB], [match]);

    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toHaveLength(1);
    expect(nodes[0][0].type).toBe('match');
    expect(nodes[0][0].match?.id).toBe('m1');
  });

  it('4 teams, no results: 2 rounds; R1 has 2 match nodes; R2 has 1 tbd node', () => {
    const setup: EliminationSetup = { size: 4, seeding: ['a', 'b', 'c', 'd'] };
    const m1 = makeMatch('m1', 1, tA, tB, undefined, undefined, 'wb');
    const m2 = makeMatch('m2', 1, tC, tD, undefined, undefined, 'wb');
    const { nodes } = computeBracketNodes({ side: 'winners', setup }, [tA, tB, tC, tD], [m1, m2]);

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
    const setup: EliminationSetup = { size: 4, seeding: ['a', 'b', 'c', 'd'] };
    const m1 = makeMatch('m1', 1, tA, tB, 1, undefined, 'wb');
    const m2 = makeMatch('m2', 1, tC, tD, 2, undefined, 'wb');
    const final = makeMatch('mf', 2, tA, tD, undefined, undefined, 'wb');
    const { nodes } = computeBracketNodes({ side: 'winners', setup }, [tA, tB, tC, tD], [m1, m2, final]);

    expect(nodes[1][0].type).toBe('match');
    expect(nodes[1][0].match?.id).toBe('mf');
    expect(nodes[1][0].team1?.id).toBe('a');
    expect(nodes[1][0].team2?.id).toBe('d');
  });

  it('3 teams (1 bye): R1 has 1 match + 1 bye-advance', () => {
    const setup: EliminationSetup = { size: 4, seeding: ['a', null, 'b', 'c'] };
    const m1 = makeMatch('m1', 1, tB, tC, undefined, undefined, 'wb');
    const { nodes } = computeBracketNodes({ side: 'winners', setup }, [tA, tB, tC], [m1]);

    expect(nodes[0]).toHaveLength(2);
    expect(nodes[0][0].type).toBe('bye-advance');
    expect(nodes[0][0].team1?.id).toBe('a');
    expect(nodes[0][1].type).toBe('match');
  });

  it('bye-advance: team1 is the bye team', () => {
    const setup: EliminationSetup = { size: 4, seeding: ['a', null, 'b', 'c'] };
    const { nodes } = computeBracketNodes({ side: 'winners', setup }, [tA, tB, tC], []);

    const byeNode = nodes[0][0];
    expect(byeNode.type).toBe('bye-advance');
    expect(byeNode.team1?.id).toBe('a');
    expect(byeNode.team2).toBeNull();
  });

  it('6 teams (2 byes): R1 has 4 nodes (2 match + 2 bye-advance)', () => {
    const setup: EliminationSetup = {
      size: 8,
      seeding: ['a', null, 'b', 'c', 'd', null, 'e', 'f'],
    };
    const m1 = makeMatch('m1', 1, tB, tC, undefined, undefined, 'wb');
    const m2 = makeMatch('m2', 1, tE, tF, undefined, undefined, 'wb');
    const { nodes } = computeBracketNodes(
      { side: 'winners', setup },
      [tA, tB, tC, tD, tE, tF],
      [m1, m2],
    );

    expect(nodes[0]).toHaveLength(4);
    const types = nodes[0].map(n => n.type);
    expect(types.filter(t => t === 'bye-advance')).toHaveLength(2);
    expect(types.filter(t => t === 'match')).toHaveLength(2);
  });

  it('advancer resolution: after R1 winner set, R2 picks up correct teams', () => {
    const setup: EliminationSetup = { size: 4, seeding: ['a', 'b', 'c', 'd'] };
    const m1 = makeMatch('m1', 1, tA, tB, 2, undefined, 'wb');
    const m2 = makeMatch('m2', 1, tC, tD, 1, undefined, 'wb');
    const { nodes } = computeBracketNodes({ side: 'winners', setup }, [tA, tB, tC, tD], [m1, m2]);

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
    const setup: EliminationSetup = { size: 4, seeding: ['a', 'b', 'c', 'd'] };
    const { connectorTypes } = computeBracketNodes({ side: 'winners', setup }, [tA, tB, tC, tD], []);
    expect(connectorTypes).toEqual(['bracket']);
  });
});

// ---------------------------------------------------------------------------
// Consolation bracket structure
// ---------------------------------------------------------------------------

describe('computeBracketNodes — consolation bracket (8 teams, before R1)', () => {
  it('returns 3 cols [2, 2, 1] all tbd before round 1', () => {
    const setup: EliminationSetup = {
      size: 8,
      seeding: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
    };
    const teams = [tA, tB, tC, tD, tE, tF, makeTeam('g', 'Gus'), makeTeam('h', 'Hana')];
    const { nodes } = computeBracketNodes({ side: 'consolation', setup }, teams, []);

    expect(nodes).toHaveLength(3);
    expect(nodes[0]).toHaveLength(2);
    expect(nodes[1]).toHaveLength(2);
    expect(nodes[2]).toHaveLength(1);
    nodes.flat().forEach(n => expect(n.type).toBe('tbd'));
  });
});

describe('computeBracketNodes — consolation bracket (6 teams)', () => {
  const setup: EliminationSetup = {
    size: 8,
    seeding: ['a', 'b', 'c', 'd', 'e', 'f', null, null],
  };
  const teams = [tA, tB, tC, tD, tE, tF];

  it('returns 3 cols [2, 2, 1] before round 1', () => {
    const { nodes } = computeBracketNodes({ side: 'consolation', setup }, teams, []);
    expect(nodes).toHaveLength(3);
    expect(nodes[0]).toHaveLength(2);
    expect(nodes[1]).toHaveLength(2);
    expect(nodes[2]).toHaveLength(1);
  });

  it('col 0 node 1 is bye-advance (SEED_ABSENT partner) before R1', () => {
    const { nodes } = computeBracketNodes({ side: 'consolation', setup }, teams, []);
    // node 0: tbd (both losers TBD), node 1: bye (odd loser gets structural bye)
    expect(nodes[0][0].type).toBe('tbd');
    expect(nodes[0][1].type).toBe('bye-advance');
  });

  it('after R1: col 0 has [match, bye-advance]', () => {
    // Simulate WB R1 complete: a beats b (loser=b), c beats d (loser=d), e beats f (loser=f)
    const wb1 = [
      makeMatch('w1', 1, tA, tB, 1, undefined, 'wb'),
      makeMatch('w2', 1, tC, tD, 1, undefined, 'wb'),
      makeMatch('w3', 1, tE, tF, 1, undefined, 'wb'),
    ];
    const lb1 = makeMatch('lb1', 1, tB, tD, undefined, undefined, 'lb');
    const { nodes } = computeBracketNodes({ side: 'consolation', setup }, teams, [...wb1, lb1]);

    expect(nodes[0][0].type).toBe('match');
    expect(nodes[0][0].match?.id).toBe('lb1');
    expect(nodes[0][1].type).toBe('bye-advance');
    expect(nodes[0][1].team1?.id).toBe('f');
  });

  it('connectorTypes alternate straight/bracket', () => {
    const { connectorTypes } = computeBracketNodes({ side: 'consolation', setup }, teams, []);
    expect(connectorTypes).toEqual(['straight', 'bracket']);
  });
});

// ---------------------------------------------------------------------------
// Consolation bracket (4 teams)
// ---------------------------------------------------------------------------

describe('computeBracketNodes — consolation bracket (4 teams)', () => {
  it('returns 1 col with 1 tbd node before R1', () => {
    const setup: EliminationSetup = { size: 4, seeding: ['a', 'b', 'c', 'd'] };
    const { nodes } = computeBracketNodes({ side: 'consolation', setup }, [tA, tB, tC, tD], []);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toHaveLength(1);
    expect(nodes[0][0].type).toBe('tbd');
  });

  it('returns empty for 2 teams (no consolation bracket)', () => {
    const setup: EliminationSetup = { size: 2, seeding: ['a', 'b'] };
    const { nodes } = computeBracketNodes({ side: 'consolation', setup }, [tA, tB], []);
    expect(nodes).toHaveLength(0);
  });
});
