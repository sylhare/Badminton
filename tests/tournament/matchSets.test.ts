import { describe, expect, it } from 'vitest';

import { setsWonBy, totalPoints, winnerFromSets } from '../../src/tournament/types';
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

  describe('winnerFromSets', () => {
    it('returns the side that won more sets', () => {
      expect(winnerFromSets(match([{ team1: 21, team2: 10 }, { team1: 21, team2: 18 }]))).toBe(1);
      expect(winnerFromSets(match([{ team1: 10, team2: 21 }, { team1: 18, team2: 21 }]))).toBe(2);
    });

    it('is undefined when sets are split evenly', () => {
      expect(winnerFromSets(match([{ team1: 21, team2: 10 }, { team1: 10, team2: 21 }]))).toBeUndefined();
    });

    it('is undefined with no sets', () => {
      expect(winnerFromSets(match([]))).toBeUndefined();
    });
  });
});
