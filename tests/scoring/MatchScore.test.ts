import { describe, expect, it } from 'vitest';

import { MatchScore } from '../../src/scoring/MatchScore';

describe('MatchScore', () => {
  describe('defaultSingle', () => {
    it('gives the clicked team 21 and the other 18', () => {
      expect(MatchScore.defaultSingle(1)).toEqual({ team1: 21, team2: 18 });
      expect(MatchScore.defaultSingle(2)).toEqual({ team1: 18, team2: 21 });
    });
  });

  describe('resolve — best-of-1', () => {
    const blank = { team1: null, team2: null };

    it('defaults a blank set to 21–18 for the clicked team', () => {
      const r1 = MatchScore.resolve([blank], 1, 1);
      expect(r1?.winner).toBe(1);
      expect(r1?.sets).toEqual([{ team1: 21, team2: 18 }]);

      const r2 = MatchScore.resolve([blank], 2, 1);
      expect(r2?.winner).toBe(2);
      expect(r2?.sets).toEqual([{ team1: 18, team2: 21 }]);
    });

    it('lets the score decide the winner even when the losing team was clicked', () => {
      const r = MatchScore.resolve([{ team1: 15, team2: 21 }], 1, 1);
      expect(r?.winner).toBe(2);
      expect(r?.sets).toEqual([{ team1: 15, team2: 21 }]);
    });
  });

  describe('resolve — best-of-N', () => {
    const blank = { team1: null, team2: null };

    it('records the majority winner and drops blank sets', () => {
      const r = MatchScore.resolve([{ team1: 21, team2: 15 }, { team1: 21, team2: 10 }, blank], 2, 3);
      expect(r?.winner).toBe(1);
      expect(r?.sets).toEqual([{ team1: 21, team2: 15 }, { team1: 21, team2: 10 }]);
    });

    it('records no winner (null) on a set tie or with nothing entered', () => {
      expect(MatchScore.resolve([{ team1: 21, team2: 15 }, { team1: 15, team2: 21 }, blank], 1, 3)).toBeNull();
      expect(MatchScore.resolve([blank, blank, blank], 1, 3)).toBeNull();
    });

    it('is undecided (null) while a lead is short of the majority', () => {
      expect(MatchScore.resolve([{ team1: 21, team2: 15 }, blank, blank], 1, 3)).toBeNull();
      expect(MatchScore.resolve([{ team1: 21, team2: 15 }, { team1: 21, team2: 10 }, blank], 1, 5)).toBeNull();
    });

    it('records the winner once a majority of sets is clinched', () => {
      const r = MatchScore.resolve(
        [{ team1: 15, team2: 21 }, { team1: 21, team2: 10 }, { team1: 21, team2: 18 }], 1, 3,
      );
      expect(r?.winner).toBe(1);
      expect(r?.sets).toHaveLength(3);
    });
  });

  describe('tallies and rendering (of)', () => {
    it('counts sets won, ignoring ties', () => {
      const s = MatchScore.of([{ team1: 21, team2: 10 }, { team1: 15, team2: 21 }, { team1: 20, team2: 20 }], 1);
      expect(s.setsWon()).toEqual({ team1: 1, team2: 1 });
    });

    it('sums points across every set', () => {
      const s = MatchScore.of([{ team1: 21, team2: 10 }, { team1: 15, team2: 21 }], 1);
      expect(s.points()).toEqual({ team1: 36, team2: 31 });
    });

    it('renders sets as a dash-joined string, or null when empty', () => {
      expect(MatchScore.of([{ team1: 21, team2: 14 }, { team1: 18, team2: 21 }], 1).formatted()).toBe('21 – 14, 18 – 21');
      expect(MatchScore.of([], 1).formatted()).toBeNull();
    });

    it('reports whether a winner is set', () => {
      expect(MatchScore.of([], undefined).isDecided()).toBe(false);
      expect(MatchScore.of([{ team1: 21, team2: 18 }], 1).isDecided()).toBe(true);
    });
  });

  describe('eloScore — averages sets to one ~21-point game', () => {
    it('returns undefined when no set was scored', () => {
      expect(MatchScore.of([], 1).eloScore()).toBeUndefined();
    });

    it('passes a single set straight through', () => {
      expect(MatchScore.of([{ team1: 21, team2: 15 }], 1).eloScore()).toEqual({ team1: 21, team2: 15 });
    });

    it('averages (not sums) a best-of-N so the margin scale still applies', () => {
      expect(MatchScore.of([{ team1: 21, team2: 15 }, { team1: 21, team2: 18 }], 1).eloScore())
        .toEqual({ team1: 21, team2: 17 });
    });
  });
});
