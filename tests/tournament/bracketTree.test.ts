import { describe, expect, it } from 'vitest';

import { ConsolationBracket, WinnersBracket, roundLabel } from '../../src/tournament/bracketTree';
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

describe('WinnersBracket.computeTree', () => {
  describe('4 teams (bracketSize=4)', () => {
    const [A, B, C, D] = createTournamentTeams(['A', 'B', 'C', 'D']);
    const teams = [A, B, C, D];
    const bracketSize = 4;

    it('produces 2 rounds', () => {
      const tree = new WinnersBracket(teams, [], bracketSize).computeTree();
      expect(tree).toHaveLength(2);
    });

    it('round 1 has 2 tbd nodes when no matches provided', () => {
      const tree = new WinnersBracket(teams, [], bracketSize).computeTree();
      expect(tree[0]).toHaveLength(2);
      expect(tree[0][0].type).toBe('tbd');
      expect(tree[0][1].type).toBe('tbd');
    });

    it('round 2 is tbd before any results', () => {
      const tree = new WinnersBracket(teams, [], bracketSize).computeTree();
      expect(tree[1]).toHaveLength(1);
      expect(tree[1][0].type).toBe('tbd');
    });

    it('round 2 becomes a match node after WB R1 is complete', () => {
      let t = EliminationTournament.create().start(teams, 4);
      const [m0, m1] = t.winners.matchesForRound(1);
      t = t.withMatchResult(m0.id, 1);
      t = t.withMatchResult(m1.id, 1);

      const tree = new WinnersBracket(teams, t.winners.matches(), bracketSize).computeTree();
      expect(tree[1][0].type).toBe('match');
    });

    it('slotIndex matches position in round', () => {
      const tree = new WinnersBracket(teams, [], bracketSize).computeTree();
      expect(tree[0][0].slotIndex).toBe(0);
      expect(tree[0][1].slotIndex).toBe(1);
      expect(tree[1][0].slotIndex).toBe(0);
    });
  });

  describe('8 teams (bracketSize=8)', () => {
    const teams = createTournamentTeams(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
    const bracketSize = 8;

    it('produces 3 rounds', () => {
      expect(new WinnersBracket(teams, [], bracketSize).computeTree()).toHaveLength(3);
    });

    it('round 1 has 4 tbd nodes when no matches provided', () => {
      const r1 = new WinnersBracket(teams, [], bracketSize).computeTree()[0];
      expect(r1).toHaveLength(4);
      expect(r1.every(n => n.type === 'tbd')).toBe(true);
    });

    it('round 2 has 2 tbd nodes before results', () => {
      const r2 = new WinnersBracket(teams, [], bracketSize).computeTree()[1];
      expect(r2).toHaveLength(2);
      expect(r2.every(n => n.type === 'tbd')).toBe(true);
    });

    it('round 3 (final) has 1 tbd node before results', () => {
      const r3 = new WinnersBracket(teams, [], bracketSize).computeTree()[2];
      expect(r3).toHaveLength(1);
      expect(r3[0].type).toBe('tbd');
    });
  });

  describe('5 teams (bracketSize=8) — byes at end', () => {
    const teams = createTournamentTeams(['A', 'B', 'C', 'D', 'E']);
    const bracketSize = 8;

    it('round 1 has 4 nodes: 2 tbd + 1 bye-advance + 1 empty', () => {
      const r1 = new WinnersBracket(teams, [], bracketSize).computeTree()[0];
      expect(r1).toHaveLength(4);
      const types = r1.map(n => n.type);
      expect(types.filter(t => t === 'tbd')).toHaveLength(2);
      expect(types.filter(t => t === 'bye-advance')).toHaveLength(1);
      expect(types.filter(t => t === 'empty')).toHaveLength(1);
    });

    it('bye-advance node carries the right team (E at slot 4)', () => {
      const r1 = new WinnersBracket(teams, [], bracketSize).computeTree()[0];
      const byeNode = r1.find(n => n.type === 'bye-advance');
      expect(byeNode?.team?.id).toBe('E');
    });

    it('round 2 has 2 nodes: 1 tbd + 1 bye-advance (E auto-advancing)', () => {
      const r2 = new WinnersBracket(teams, [], bracketSize).computeTree()[1];
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
      const r1 = new WinnersBracket(teams, [], bracketSize).computeTree()[0];
      expect(r1).toHaveLength(2);
      expect(r1[0].type).toBe('tbd');
      expect(r1[1].type).toBe('bye-advance');
      expect(r1[1].team?.id).toBe(C.id);
    });
  });
});

describe('ConsolationBracket.computeTree', () => {
  it('returns empty when fewer than 2 seeds', () => {
    expect(new ConsolationBracket([], [], 4).computeTree()).toHaveLength(0);
    expect(new ConsolationBracket([createTournamentTeam('X')], [], 4).computeTree()).toHaveLength(0);
  });

  describe('4 CB seeds (from 8-team WB R1)', () => {
    const seeds = createTournamentTeams(['L1', 'L2', 'L3', 'L4']);

    it('produces 2 rounds', () => {
      expect(new ConsolationBracket(seeds, [], 8).computeTree()).toHaveLength(2);
    });

    it('round 1 has 2 tbd nodes when no matches provided', () => {
      const r1 = new ConsolationBracket(seeds, [], 8).computeTree()[0];
      expect(r1).toHaveLength(2);
      expect(r1.every(n => n.type === 'tbd')).toBe(true);
    });

    it('round 2 (CB final) is tbd before results', () => {
      const r2 = new ConsolationBracket(seeds, [], 8).computeTree()[1];
      expect(r2).toHaveLength(1);
      expect(r2[0].type).toBe('tbd');
    });

    it('round 2 becomes a match after CB R1 results', () => {
      let t = EliminationTournament.create().start(createTournamentTeams(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']), 4);
      for (const m of t.winners.matchesForRound(1)) t = t.withMatchResult(m.id, 1);

      const cbSeeds = t.winners.firstRoundLosers();
      const cbR1 = t.consolation.matchesForRound(1);
      let tree = new ConsolationBracket(cbSeeds, cbR1, 8).computeTree();
      expect(tree[1][0].type).toBe('tbd');

      for (const m of cbR1) t = t.withMatchResult(m.id, 1);
      tree = new ConsolationBracket(cbSeeds, t.consolation.matches(), 8).computeTree();
      expect(tree[1][0].type).toBe('match');
    });
  });

  describe('2 CB seeds (from 4-team WB R1, bracketSize=4)', () => {
    const seeds = createTournamentTeams(['L1', 'L2']);

    it('produces 1 round (CB final only), tbd when no matches provided', () => {
      const tree = new ConsolationBracket(seeds, [], 4).computeTree();
      expect(tree).toHaveLength(1);
      expect(tree[0]).toHaveLength(1);
      expect(tree[0][0].type).toBe('tbd');
    });
  });

  describe('2 CB seeds (from 5-player WB R1, bracketSize=8)', () => {
    const seeds = createTournamentTeams(['L1', 'L2']);

    it('produces 2 rounds (CB R1 + extra CB Final from WB R2 loser)', () => {
      expect(new ConsolationBracket(seeds, [], 8).computeTree()).toHaveLength(2);
    });

    it('round 1 has 1 tbd node', () => {
      const r1 = new ConsolationBracket(seeds, [], 8).computeTree()[0];
      expect(r1).toHaveLength(1);
      expect(r1[0].type).toBe('tbd');
    });

    it('round 2 (extra) is tbd before CB R2 match generated', () => {
      const r2 = new ConsolationBracket(seeds, [], 8).computeTree()[1];
      expect(r2).toHaveLength(1);
      expect(r2[0].type).toBe('tbd');
    });

    it('round 2 becomes match node once CB R2 match is generated', () => {
      let t = EliminationTournament.create().start(createTournamentTeams(['A', 'B', 'C', 'D', 'E']), 4);
      const [m0, m1] = t.winners.matchesForRound(1);
      t = t.withMatchResult(m0.id, 1);
      t = t.withMatchResult(m1.id, 1);
      t = t.withMatchResult(t.consolation.matchesForRound(1)[0].id, 1);
      t = t.withMatchResult(t.winners.matchesForRound(2)[0].id, 1);

      const cbSeeds = t.winners.firstRoundLosers();
      const tree = new ConsolationBracket(cbSeeds, t.consolation.matches(), 8).computeTree();
      expect(tree).toHaveLength(2);
      expect(tree[1][0].type).toBe('match');
    });
  });
});
