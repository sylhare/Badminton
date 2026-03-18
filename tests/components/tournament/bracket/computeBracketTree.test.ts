import { describe, expect, it } from 'vitest';

import { computeBracketTree } from '../../../../src/components/tournament/bracket/computeBracketTree';
import type { SEBracket, TournamentMatch, TournamentTeam } from '../../../../src/types/tournament';
import { createMockPlayer } from '../../../data/testFactories';

function makeTeam(id: string, name: string): TournamentTeam {
  return { id, players: [createMockPlayer({ id: `${id}-p0`, name })] };
}

function makeMatch(
  id: string,
  round: number,
  team1: TournamentTeam,
  team2: TournamentTeam,
  winner?: 1 | 2,
): TournamentMatch {
  return { id, round, courtNumber: 1, team1, team2, winner };
}

const tA = makeTeam('a', 'Alice');
const tB = makeTeam('b', 'Bob');
const tC = makeTeam('c', 'Carol');
const tD = makeTeam('d', 'Dana');
const tE = makeTeam('e', 'Eve');
const tF = makeTeam('f', 'Frank');

describe('computeBracketTree', () => {
  it('2 teams: 1 round, 1 match node', () => {
    const bracket: SEBracket = { size: 2, seeding: ['a', 'b'] };
    const match = makeMatch('m1', 1, tA, tB);
    const nodes = computeBracketTree(bracket, [tA, tB], [match]);

    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toHaveLength(1);
    expect(nodes[0][0].type).toBe('match');
    expect(nodes[0][0].match?.id).toBe('m1');
  });

  it('4 teams, no results: 2 rounds; R1 has 2 match nodes; R2 has 1 tbd node', () => {
    const bracket: SEBracket = { size: 4, seeding: ['a', 'b', 'c', 'd'] };
    const m1 = makeMatch('m1', 1, tA, tB);
    const m2 = makeMatch('m2', 1, tC, tD);
    const nodes = computeBracketTree(bracket, [tA, tB, tC, tD], [m1, m2]);

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
    const bracket: SEBracket = { size: 4, seeding: ['a', 'b', 'c', 'd'] };
    const m1 = makeMatch('m1', 1, tA, tB, 1);
    const m2 = makeMatch('m2', 1, tC, tD, 2);
    const final = makeMatch('mf', 2, tA, tD);
    const nodes = computeBracketTree(bracket, [tA, tB, tC, tD], [m1, m2, final]);

    expect(nodes[1][0].type).toBe('match');
    expect(nodes[1][0].match?.id).toBe('mf');
    expect(nodes[1][0].team1?.id).toBe('a');
    expect(nodes[1][0].team2?.id).toBe('d');
  });

  it('3 teams (1 bye): R1 has 1 match + 1 bye-advance', () => {
    const bracket: SEBracket = { size: 4, seeding: ['a', null, 'b', 'c'] };
    const m1 = makeMatch('m1', 1, tB, tC);
    const nodes = computeBracketTree(bracket, [tA, tB, tC], [m1]);

    expect(nodes[0]).toHaveLength(2);
    expect(nodes[0][0].type).toBe('bye-advance');
    expect(nodes[0][0].team1?.id).toBe('a');
    expect(nodes[0][1].type).toBe('match');
  });

  it('bye-advance: team1 is the bye team', () => {
    const bracket: SEBracket = { size: 4, seeding: ['a', null, 'b', 'c'] };
    const nodes = computeBracketTree(bracket, [tA, tB, tC], []);

    const byeNode = nodes[0][0];
    expect(byeNode.type).toBe('bye-advance');
    expect(byeNode.team1?.id).toBe('a');
    expect(byeNode.team2).toBeNull();
  });

  it('6 teams (2 byes): R1 has 4 nodes (2 match + 2 bye-advance)', () => {
    const bracket: SEBracket = {
      size: 8,
      seeding: ['a', null, 'b', 'c', 'd', null, 'e', 'f'],
    };
    const m1 = makeMatch('m1', 1, tB, tC);
    const m2 = makeMatch('m2', 1, tE, tF);
    const nodes = computeBracketTree(bracket, [tA, tB, tC, tD, tE, tF], [m1, m2]);

    expect(nodes[0]).toHaveLength(4);
    const types = nodes[0].map(n => n.type);
    expect(types.filter(t => t === 'bye-advance')).toHaveLength(2);
    expect(types.filter(t => t === 'match')).toHaveLength(2);
  });

  it('advancer resolution: after R1 winner set, R2 picks up correct teams', () => {
    const bracket: SEBracket = { size: 4, seeding: ['a', 'b', 'c', 'd'] };
    const m1 = makeMatch('m1', 1, tA, tB, 2); // Bob wins
    const m2 = makeMatch('m2', 1, tC, tD, 1); // Carol wins
    const nodes = computeBracketTree(bracket, [tA, tB, tC, tD], [m1, m2]);

    // R2 tbd node should have t1=Bob, t2=Carol
    expect(nodes[1][0].type).toBe('tbd');
    expect(nodes[1][0].team1?.id).toBe('b');
    expect(nodes[1][0].team2?.id).toBe('c');
  });
});
