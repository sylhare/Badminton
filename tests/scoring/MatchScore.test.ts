import { describe, expect, it } from 'vitest';

import { MatchScore } from '../../src/scoring/MatchScore';

describe('MatchScore', () => {
  describe('defaultSingle', () => {
    it('gives the clicked team 21 and the other 18', () => {
      expect(MatchScore.defaultSingle(1)).toEqual({ team1: 21, team2: 18 });
      expect(MatchScore.defaultSingle(2)).toEqual({ team1: 18, team2: 21 });
    });

    it('scales the default to a configured set size (winner setSize, loser setSize − 3)', () => {
      expect(MatchScore.defaultSingle(1, 15)).toEqual({ team1: 15, team2: 12 });
      expect(MatchScore.defaultSingle(2, 11)).toEqual({ team1: 8, team2: 11 });
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

    it('settles a blank loser to win-by-two once the winner runs past setSize (deuce)', () => {
      expect(MatchScore.resolve([{ team1: 23, team2: null }], 1, 1)?.sets).toEqual([{ team1: 23, team2: 21 }]);
      expect(MatchScore.resolve([{ team1: null, team2: 25 }], 2, 1)?.sets).toEqual([{ team1: 23, team2: 25 }]);
    });

    it('keeps the clicked team the winner when only their low score is entered', () => {
      const r = MatchScore.resolve([{ team1: 10, team2: null }], 1, 1);
      expect(r?.winner).toBe(1);
      expect(r?.sets[0].team2).toBeLessThan(10);
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

    it('drops sets played after the clinch — no 3–0 in a best of 3', () => {
      const r = MatchScore.resolve(
        [{ team1: 21, team2: 15 }, { team1: 21, team2: 10 }, { team1: 21, team2: 5 }], 1, 3,
      );
      expect(r?.winner).toBe(1);
      expect(r?.sets).toEqual([{ team1: 21, team2: 15 }, { team1: 21, team2: 10 }]);
    });

    it('honours the set size for a blank best-of-1 default', () => {
      const r = MatchScore.resolve([{ team1: null, team2: null }], 1, 1, 15);
      expect(r?.sets).toEqual([{ team1: 15, team2: 12 }]);
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

    describe('averagePointMargin — per-set so best-of-N stays on a single-game scale', () => {
      it('is the plain margin for a single set', () => {
        expect(MatchScore.of([{ team1: 21, team2: 15 }], 1).averagePointMargin()).toBe(6);
      });

      it('averages the per-set margins rather than summing them', () => {
        const s = MatchScore.of([{ team1: 21, team2: 11 }, { team1: 21, team2: 15 }], 1);
        expect(s.points()).toEqual({ team1: 42, team2: 26 });
        expect(s.averagePointMargin()).toBe(8);
      });

      it('rounds the average and stays symmetric for the losing side', () => {
        const win = MatchScore.of([{ team1: 21, team2: 5 }, { team1: 5, team2: 21 }, { team1: 21, team2: 5 }], 1);
        const loss = MatchScore.of([{ team1: 5, team2: 21 }, { team1: 21, team2: 5 }, { team1: 5, team2: 21 }], 2);
        expect(win.averagePointMargin()).toBe(5);
        expect(loss.averagePointMargin()).toBe(-5);
      });

      it('is zero when no set was scored', () => {
        expect(MatchScore.of([], 1).averagePointMargin()).toBe(0);
      });
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
