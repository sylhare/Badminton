import { describe, expect, it } from 'vitest';

import { computeCBTree, computeWBTree, roundLabel } from '../../src/tournament/bracketTree';
import { EliminationTournament } from '../../src/tournament/EliminationTournament';
import { createTournamentTeam, createTournamentTeams } from '../data/testFactories';

describe('roundLabel', () => {
  it('last round is Final', () => {
    expect(roundLabel(3, 3)).toBe('Final');
    expect(roundLabel(1, 1)).toBe('Final');
  });

  it('second-to-last is Semi Final', () => {
    expect(roundLabel(2, 3)).toBe('Semi Final');
  });

  it('third-to-last is 4th of Final', () => {
    expect(roundLabel(1, 3)).toBe('4th of Final');
  });

  it('fourth-to-last is 8th of Final', () => {
    expect(roundLabel(1, 4)).toBe('8th of Final');
  });
});

describe('computeWBTree', () => {
  describe('4 teams (bracketSize=4)', () => {
    const [A, B, C, D] = createTournamentTeams(['A', 'B', 'C', 'D']);
    const teams = [A, B, C, D];
    const bracketSize = 4;

    it('produces 2 rounds', () => {
      const tree = computeWBTree(teams, bracketSize, []);
      expect(tree).toHaveLength(2);
    });

    it('round 1 has 2 tbd nodes when no matches provided', () => {
      const tree = computeWBTree(teams, bracketSize, []);
      expect(tree[0]).toHaveLength(2);
      expect(tree[0][0].type).toBe('tbd');
      expect(tree[0][1].type).toBe('tbd');
    });

    it('round 2 is tbd before any results', () => {
      const tree = computeWBTree(teams, bracketSize, []);
      expect(tree[1]).toHaveLength(1);
      expect(tree[1][0].type).toBe('tbd');
    });

    it('round 2 becomes a match node after WB R1 is complete', () => {
      let t = EliminationTournament.create().start(teams, 4);
      const [m0, m1] = t.wbMatchesForRound(1);
      t = t.withMatchResult(m0.id, 1);
      t = t.withMatchResult(m1.id, 1);

      const wbMatches = t.wbMatches();
      const tree = computeWBTree(teams, bracketSize, wbMatches);
      expect(tree[1][0].type).toBe('match');
    });

    it('slotIndex matches position in round', () => {
      const tree = computeWBTree(teams, bracketSize, []);
      expect(tree[0][0].slotIndex).toBe(0);
      expect(tree[0][1].slotIndex).toBe(1);
      expect(tree[1][0].slotIndex).toBe(0);
    });
  });

  describe('8 teams (bracketSize=8)', () => {
    const teams = createTournamentTeams(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
    const bracketSize = 8;

    it('produces 3 rounds', () => {
      expect(computeWBTree(teams, bracketSize, [])).toHaveLength(3);
    });

    it('round 1 has 4 tbd nodes when no matches provided', () => {
      const r1 = computeWBTree(teams, bracketSize, [])[0];
      expect(r1).toHaveLength(4);
      expect(r1.every(n => n.type === 'tbd')).toBe(true);
    });

    it('round 2 has 2 tbd nodes before results', () => {
      const r2 = computeWBTree(teams, bracketSize, [])[1];
      expect(r2).toHaveLength(2);
      expect(r2.every(n => n.type === 'tbd')).toBe(true);
    });

    it('round 3 (final) has 1 tbd node before results', () => {
      const r3 = computeWBTree(teams, bracketSize, [])[2];
      expect(r3).toHaveLength(1);
      expect(r3[0].type).toBe('tbd');
    });
  });

  describe('5 teams (bracketSize=8) — byes at end', () => {
    const teams = createTournamentTeams(['A', 'B', 'C', 'D', 'E']);
    const bracketSize = 8;

    it('round 1 has 4 nodes: 2 tbd + 1 bye-advance + 1 empty', () => {
      const r1 = computeWBTree(teams, bracketSize, [])[0];
      expect(r1).toHaveLength(4);
      const types = r1.map(n => n.type);
      expect(types.filter(t => t === 'tbd')).toHaveLength(2);
      expect(types.filter(t => t === 'bye-advance')).toHaveLength(1);
      expect(types.filter(t => t === 'empty')).toHaveLength(1);
    });

    it('bye-advance node carries the right team (E at slot 4)', () => {
      const r1 = computeWBTree(teams, bracketSize, [])[0];
      const byeNode = r1.find(n => n.type === 'bye-advance');
      expect(byeNode?.team?.id).toBe('E');
    });

    it('round 2 has 2 nodes: 1 tbd + 1 bye-advance (E auto-advancing)', () => {
      const r2 = computeWBTree(teams, bracketSize, [])[1];
      expect(r2).toHaveLength(2);
      const types = r2.map(n => n.type);
      expect(types).toContain('tbd');
      expect(types).toContain('bye-advance');
    });
  });

  describe('3 teams (bracketSize=4)', () => {
    const [A, B, C] = createTournamentTeams(['A', 'B', 'C']);
    const teams = [A, B, C];
    const bracketSize = 4;

    it('round 1 has 2 nodes: 1 tbd (A vs B, no match yet) + 1 bye-advance (C)', () => {
      const r1 = computeWBTree(teams, bracketSize, [])[0];
      expect(r1).toHaveLength(2);
      expect(r1[0].type).toBe('tbd');
      expect(r1[1].type).toBe('bye-advance');
      expect(r1[1].team?.id).toBe(C.id);
    });
  });
});

describe('computeCBTree', () => {
  it('returns empty when fewer than 2 seeds', () => {
    expect(computeCBTree([], [], 4)).toHaveLength(0);
    expect(computeCBTree([createTournamentTeam('X')], [], 4)).toHaveLength(0);
  });

  describe('4 CB seeds (from 8-team WB R1)', () => {
    const seeds = createTournamentTeams(['L1', 'L2', 'L3', 'L4']);

    it('produces 2 rounds', () => {
      expect(computeCBTree(seeds, [], 8)).toHaveLength(2);
    });

    it('round 1 has 2 tbd nodes when no matches provided', () => {
      const r1 = computeCBTree(seeds, [], 8)[0];
      expect(r1).toHaveLength(2);
      expect(r1.every(n => n.type === 'tbd')).toBe(true);
    });

    it('round 2 (CB final) is tbd before results', () => {
      const r2 = computeCBTree(seeds, [], 8)[1];
      expect(r2).toHaveLength(1);
      expect(r2[0].type).toBe('tbd');
    });

    it('round 2 becomes a match after CB R1 results', () => {
      let t = EliminationTournament.create().start(createTournamentTeams(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']), 4);
      for (const m of t.wbMatchesForRound(1)) t = t.withMatchResult(m.id, 1);

      const cbSeeds = t.wbR1Losers();
      const cbR1 = t.cbMatchesForRound(1);
      let tree = computeCBTree(cbSeeds, cbR1, 8);
      expect(tree[1][0].type).toBe('tbd');

      for (const m of cbR1) t = t.withMatchResult(m.id, 1);
      tree = computeCBTree(cbSeeds, t.cbMatches(), 8);
      expect(tree[1][0].type).toBe('match');
    });
  });

  describe('2 CB seeds (from 4-team WB R1, bracketSize=4)', () => {
    const seeds = createTournamentTeams(['L1', 'L2']);

    it('produces 1 round (CB final only), tbd when no matches provided', () => {
      const tree = computeCBTree(seeds, [], 4);
      expect(tree).toHaveLength(1);
      expect(tree[0]).toHaveLength(1);
      expect(tree[0][0].type).toBe('tbd');
    });
  });

  describe('2 CB seeds (from 5-player WB R1, bracketSize=8)', () => {
    const seeds = createTournamentTeams(['L1', 'L2']);

    it('produces 2 rounds (CB R1 + extra CB Final from WB R2 loser)', () => {
      expect(computeCBTree(seeds, [], 8)).toHaveLength(2);
    });

    it('round 1 has 1 tbd node', () => {
      const r1 = computeCBTree(seeds, [], 8)[0];
      expect(r1).toHaveLength(1);
      expect(r1[0].type).toBe('tbd');
    });

    it('round 2 (extra) is tbd before CB R2 match generated', () => {
      const r2 = computeCBTree(seeds, [], 8)[1];
      expect(r2).toHaveLength(1);
      expect(r2[0].type).toBe('tbd');
    });

    it('round 2 becomes match node once CB R2 match is generated', () => {
      let t = EliminationTournament.create().start(createTournamentTeams(['A', 'B', 'C', 'D', 'E']), 4);
      const [m0, m1] = t.wbMatchesForRound(1);
      t = t.withMatchResult(m0.id, 1);
      t = t.withMatchResult(m1.id, 1);
      t = t.withMatchResult(t.cbMatchesForRound(1)[0].id, 1);
      t = t.withMatchResult(t.wbMatchesForRound(2)[0].id, 1);

      const cbSeeds = t.wbR1Losers();
      const tree = computeCBTree(cbSeeds, t.cbMatches(), 8);
      expect(tree).toHaveLength(2);
      expect(tree[1][0].type).toBe('match');
    });
  });
});
