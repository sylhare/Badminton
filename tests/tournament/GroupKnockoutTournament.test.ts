import { describe, expect, it } from 'vitest';

import { GroupKnockoutTournament } from '../../src/tournament/GroupKnockoutTournament';
import type { TournamentMatch } from '../../src/tournament/types';
import { createTournamentTeams } from '../data/testFactories';

/** Decide every currently-listed match, team1 winning by the given set score. */
function decideAll(
  tournament: GroupKnockoutTournament,
  score: { team1: number; team2: number } = { team1: 21, team2: 10 },
): GroupKnockoutTournament {
  let current = tournament;
  for (const id of current.matches().map(m => m.id)) {
    current = current.withMatchResult(id, 1, [score]);
  }
  return current;
}

const start = (teamIds: string[], groupSize: number, qualifiersPerGroup: number) =>
  GroupKnockoutTournament
    .create('doubles', 2, 1, groupSize, qualifiersPerGroup)
    .start(createTournamentTeams(teamIds), 2);

describe('GroupKnockoutTournament — group phase', () => {
  describe('start', () => {
    it('splits 8 teams into two groups of four and tags every match with its group', () => {
      const t = start(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], 4, 2);
      const groupMatches = t.groupMatches();
      expect(t.groups().map(g => g.length)).toEqual([4, 4]);
      // Each group of 4 is a full round-robin: 6 matches per group, 12 total.
      expect(groupMatches).toHaveLength(12);
      expect(groupMatches.every((m: TournamentMatch) => m.group !== undefined)).toBe(true);
    });

    it('phase is active and matches carry the best-of set model', () => {
      const t = start(['a', 'b', 'c', 'd'], 2, 1);
      expect(t.phase()).toBe('active');
      expect(t.matches().every(m => Array.isArray(m.sets))).toBe(true);
    });
  });

  describe('groups', () => {
    it('assigns every team to exactly one group', () => {
      const t = start(['a', 'b', 'c', 'd', 'e', 'f'], 3, 2);
      const ids = t.groups().flat().map(team => team.id).sort();
      expect(ids).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
      expect(t.groups()).toHaveLength(2);
    });
  });

  describe('groupPhaseComplete', () => {
    it('is false until every group match is decided, then true', () => {
      const t = start(['a', 'b', 'c', 'd'], 2, 1);
      expect(t.groupPhaseComplete()).toBe(false);
      expect(decideAll(t).groupPhaseComplete()).toBe(true);
    });
  });

  describe('groupStandings', () => {
    it('ranks the group winner first', () => {
      // Two groups of two → one match each. team1 wins both.
      const decided = decideAll(start(['a', 'b', 'c', 'd'], 2, 1));
      for (let g = 0; g < decided.groups().length; g++) {
        const standings = decided.groupStandings(g);
        expect(standings[0].won).toBe(1);
        expect(standings[0].points).toBe(2);
        expect(standings[1].lost).toBe(1);
      }
    });
  });

  describe('qualifiers', () => {
    it('is empty until the group phase completes', () => {
      expect(start(['a', 'b', 'c', 'd'], 2, 1).qualifiers()).toEqual([]);
    });

    it('returns one qualifier per group when qualifiersPerGroup is 1', () => {
      const decided = decideAll(start(['a', 'b', 'c', 'd'], 2, 1));
      const qualifiers = decided.qualifiers();
      expect(qualifiers).toHaveLength(2);
      // Each qualifier is the winner (team1) of its group's single match.
      const groupWinners = decided.groups().map((_, g) => decided.groupStandings(g)[0].team.id).sort();
      expect(qualifiers.map(t => t.id).sort()).toEqual(groupWinners);
    });

    it('returns qualifiersPerGroup teams from each group', () => {
      const decided = decideAll(start(['a', 'b', 'c', 'd', 'e', 'f'], 3, 2));
      expect(decided.qualifiers()).toHaveLength(4); // 2 groups × 2 qualifiers
    });
  });

  describe('knockout phase', () => {
    it('auto-seeds the knockout bracket when the group phase completes', () => {
      const decided = decideAll(start(['a', 'b', 'c', 'd'], 2, 1));
      expect(decided.knockoutStarted()).toBe(true);
      // Two group winners → a single knockout final; tournament not yet complete.
      expect(decided.knockoutMatches()).toHaveLength(1);
      expect(decided.isComplete()).toBe(false);
    });

    it('seeds the knockout final with the two group winners', () => {
      const decided = decideAll(start(['a', 'b', 'c', 'd'], 2, 1));
      const winners = decided.groups().map((_, g) => decided.groupStandings(g)[0].team.id).sort();
      const final = decided.knockoutMatches()[0];
      expect([final.team1.id, final.team2.id].sort()).toEqual(winners);
    });

    it('completes and marks the phase once the knockout final is decided', () => {
      let t = decideAll(start(['a', 'b', 'c', 'd'], 2, 1));
      const finalId = t.knockoutMatches()[0].id;
      t = t.withMatchResult(finalId, 1, [{ team1: 21, team2: 15 }]);
      expect(t.isComplete()).toBe(true);
      expect(t.phase()).toBe('completed');
    });

    it('builds a four-team knockout from two groups of four', () => {
      const decided = decideAll(start(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], 4, 2));
      expect(decided.bracketSize()).toBe(4);
      // Four qualifiers → two seeded first-round (semi-final) matches.
      expect(decided.knockoutMatches().filter(m => m.round === 1)).toHaveLength(2);
    });

    it('spans both phases in totalRounds once the knockout starts', () => {
      // Group phase: 1 round (groups of two). Knockout of two qualifiers: 1 round.
      expect(decideAll(start(['a', 'b', 'c', 'd'], 2, 1)).totalRounds()).toBe(2);
    });

    it('does not seed the knockout while the group phase is unfinished', () => {
      const t = start(['a', 'b', 'c', 'd', 'e', 'f'], 3, 2);
      expect(t.knockoutStarted()).toBe(false);
      expect(t.knockoutMatches()).toHaveLength(0);
    });
  });
});
