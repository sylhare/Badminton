import { describe, expect, it } from 'vitest';

import { resolveMatchResult, setsWonBy, totalPoints } from '../../src/tournament/types';
import { createTournamentMatch, createTournamentTeam } from '../data/testFactories';

describe('match set helpers', () => {
  const teamA = createTournamentTeam('a', ['Alice']);
  const teamB = createTournamentTeam('b', ['Bob']);
  const match = (sets: { team1: number; team2: number }[]) =>
    createTournamentMatch('m1', 1, teamA, teamB, undefined, sets);

  describe('setsWonBy', () => {
    it('counts the sets each side took', () => {
      const result = setsWonBy(match([
        { team1: 21, team2: 10 }, { team1: 15, team2: 21 }, { team1: 21, team2: 18 },
      ]));
      expect(result).toEqual({ team1: 2, team2: 1 });
    });

    it('ignores tied sets', () => {
      expect(setsWonBy(match([{ team1: 20, team2: 20 }]))).toEqual({ team1: 0, team2: 0 });
    });

    it('returns zero for a match with no sets', () => {
      expect(setsWonBy(match([]))).toEqual({ team1: 0, team2: 0 });
    });
  });

  describe('totalPoints', () => {
    it('sums points across every set', () => {
      const result = totalPoints(match([{ team1: 21, team2: 10 }, { team1: 15, team2: 21 }]));
      expect(result).toEqual({ team1: 36, team2: 31 });
    });

    it('returns zero for a match with no sets', () => {
      expect(totalPoints(match([]))).toEqual({ team1: 0, team2: 0 });
    });
  });

  describe('resolveMatchResult', () => {
    const blank = { team1: null, team2: null };

    it('best-of-1: a blank set defaults to 21–18 for the clicked team', () => {
      expect(resolveMatchResult([blank], 1, 1)).toEqual({ winner: 1, sets: [{ team1: 21, team2: 18 }] });
      expect(resolveMatchResult([blank], 2, 1)).toEqual({ winner: 2, sets: [{ team1: 18, team2: 21 }] });
    });

    it('best-of-1: the score decides the winner even when the losing team was clicked', () => {
      expect(resolveMatchResult([{ team1: 15, team2: 21 }], 1, 1))
        .toEqual({ winner: 2, sets: [{ team1: 15, team2: 21 }] });
    });

    it('best-of-N: winner is the set majority; blank sets are dropped', () => {
      const result = resolveMatchResult([{ team1: 21, team2: 15 }, { team1: 21, team2: 10 }, blank], 2, 3);
      expect(result).toEqual({ winner: 1, sets: [{ team1: 21, team2: 15 }, { team1: 21, team2: 10 }] });
    });

    it('best-of-N: a set tie records no winner (null), not the clicked team', () => {
      expect(resolveMatchResult([{ team1: 21, team2: 15 }, { team1: 15, team2: 21 }, blank], 1, 3)).toBeNull();
      expect(resolveMatchResult([blank, blank, blank], 1, 3)).toBeNull();
    });

    it('best-of-N: a lead short of a majority is not yet decided (null)', () => {
      expect(resolveMatchResult([{ team1: 21, team2: 15 }, blank, blank], 1, 3)).toBeNull();
      expect(resolveMatchResult([{ team1: 21, team2: 15 }, { team1: 21, team2: 10 }, blank], 1, 5)).toBeNull();
    });

    it('best-of-N: records the winner once a majority of sets is clinched', () => {
      const bo3 = resolveMatchResult([{ team1: 15, team2: 21 }, { team1: 21, team2: 10 }, { team1: 21, team2: 18 }], 1, 3);
      expect(bo3).toEqual({
        winner: 1,
        sets: [{ team1: 15, team2: 21 }, { team1: 21, team2: 10 }, { team1: 21, team2: 18 }],
      });
    });
  });
});
