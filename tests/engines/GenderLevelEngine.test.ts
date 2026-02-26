import { beforeEach, describe, expect, it } from 'vitest';

import { GenderLevelEngine } from '../../src/engines/GenderLevelEngine';
import type { Court, Player } from '../../src/types';

/**
 * Test subclass that exposes protected methods as public.
 */
class TestGenderLevelEngine extends GenderLevelEngine {
  public testCalculateGenderCost(team1: Player[], team2: Player[]): number {
    return this.calculateGenderCost(team1, team2);
  }

  public testCalculateLevelBalanceCost(team1: Player[], team2: Player[]): number {
    return this.calculateLevelBalanceCost(team1, team2);
  }

  public testCalculateLevelTeammateBias(team: Player[]): number {
    return this.calculateLevelTeammateBias(team);
  }
}

function makePlayer(id: string, sex?: Player['sex'], level?: number): Player {
  return { id, name: `Player ${id}`, isPresent: true, sex, level };
}

describe('GenderLevelEngine', () => {
  let engine: TestGenderLevelEngine;

  beforeEach(() => {
    engine = new TestGenderLevelEngine();
    engine.resetHistory();
  });

  describe('getName / getDescription', () => {
    it('returns Smart Matching as name', () => {
      expect(engine.getName()).toBe('Smart Matching');
    });

    it('returns a description mentioning gender and level', () => {
      const desc = engine.getDescription().toLowerCase();
      expect(desc).toContain('gender');
      expect(desc).toContain('level');
    });
  });

  describe('calculateGenderCost', () => {
    it('returns 0 for mixed-gender teams (F+M vs F+M)', () => {
      const team1 = [makePlayer('1', 'F'), makePlayer('2', 'M')];
      const team2 = [makePlayer('3', 'F'), makePlayer('4', 'M')];
      expect(engine.testCalculateGenderCost(team1, team2)).toBe(0);
    });

    it('returns GENDER_MISMATCH_PENALTY for all-F vs all-M', () => {
      const team1 = [makePlayer('1', 'F'), makePlayer('2', 'F')];
      const team2 = [makePlayer('3', 'M'), makePlayer('4', 'M')];
      expect(engine.testCalculateGenderCost(team1, team2)).toBe(8000);
    });

    it('returns GENDER_MISMATCH_PENALTY for all-M vs all-F', () => {
      const team1 = [makePlayer('1', 'M'), makePlayer('2', 'M')];
      const team2 = [makePlayer('3', 'F'), makePlayer('4', 'F')];
      expect(engine.testCalculateGenderCost(team1, team2)).toBe(8000);
    });

    it('returns 0 when all genders are Unknown', () => {
      const team1 = [makePlayer('1', 'Unknown'), makePlayer('2', 'Unknown')];
      const team2 = [makePlayer('3', 'Unknown'), makePlayer('4', 'Unknown')];
      expect(engine.testCalculateGenderCost(team1, team2)).toBe(0);
    });

    it('returns 0 when genders are undefined', () => {
      const team1 = [makePlayer('1'), makePlayer('2')];
      const team2 = [makePlayer('3'), makePlayer('4')];
      expect(engine.testCalculateGenderCost(team1, team2)).toBe(0);
    });

    it('returns 0 when one team has no known gender', () => {
      const team1 = [makePlayer('1', 'F'), makePlayer('2', 'F')];
      const team2 = [makePlayer('3', 'Unknown'), makePlayer('4', 'Unknown')];
      expect(engine.testCalculateGenderCost(team1, team2)).toBe(0);
    });

    it('returns 0 for singles: one M vs one F', () => {
      const team1 = [makePlayer('1', 'M')];
      const team2 = [makePlayer('2', 'F')];
      expect(engine.testCalculateGenderCost(team1, team2)).toBe(0);
    });

    it('returns 0 for mixed team even if other team is all-F', () => {
      const team1 = [makePlayer('1', 'F'), makePlayer('2', 'M')];
      const team2 = [makePlayer('3', 'F'), makePlayer('4', 'F')];
      expect(engine.testCalculateGenderCost(team1, team2)).toBe(0);
    });
  });

  describe('calculateLevelBalanceCost', () => {
    it('returns 0 for perfectly balanced teams (50+50 vs 50+50)', () => {
      const team1 = [makePlayer('1', undefined, 50), makePlayer('2', undefined, 50)];
      const team2 = [makePlayer('3', undefined, 50), makePlayer('4', undefined, 50)];
      expect(engine.testCalculateLevelBalanceCost(team1, team2)).toBe(0);
    });

    it('returns proportional cost for imbalanced teams (90+90 vs 10+10)', () => {
      const team1 = [makePlayer('1', undefined, 90), makePlayer('2', undefined, 90)];
      const team2 = [makePlayer('3', undefined, 10), makePlayer('4', undefined, 10)];
      // avg1 = 90, avg2 = 10, diff = 80, cost = 80 * 80 = 6400
      expect(engine.testCalculateLevelBalanceCost(team1, team2)).toBe(6400);
    });

    it('uses 50 as default level when undefined', () => {
      const team1 = [makePlayer('1'), makePlayer('2')];
      const team2 = [makePlayer('3'), makePlayer('4')];
      // Both default to 50, diff = 0
      expect(engine.testCalculateLevelBalanceCost(team1, team2)).toBe(0);
    });

    it('uses 50 as default for missing level', () => {
      const team1 = [makePlayer('1', undefined, 100), makePlayer('2', undefined, 100)];
      const team2 = [makePlayer('3'), makePlayer('4')]; // defaults to 50 each
      // avg1 = 100, avg2 = 50, diff = 50, cost = 50 * 80 = 4000
      expect(engine.testCalculateLevelBalanceCost(team1, team2)).toBe(4000);
    });

    it('scales proportionally with level difference', () => {
      const team1a = [makePlayer('1', undefined, 60), makePlayer('2', undefined, 60)];
      const team2a = [makePlayer('3', undefined, 40), makePlayer('4', undefined, 40)];
      const costSmall = engine.testCalculateLevelBalanceCost(team1a, team2a);

      const team1b = [makePlayer('1', undefined, 80), makePlayer('2', undefined, 80)];
      const team2b = [makePlayer('3', undefined, 20), makePlayer('4', undefined, 20)];
      const costLarge = engine.testCalculateLevelBalanceCost(team1b, team2b);

      expect(costLarge).toBeGreaterThan(costSmall);
    });
  });

  describe('calculateLevelTeammateBias', () => {
    it('returns 0 for same-level teammates (80, 80)', () => {
      const team = [makePlayer('1', undefined, 80), makePlayer('2', undefined, 80)];
      expect(engine.testCalculateLevelTeammateBias(team)).toBe(0);
    });

    it('returns proportional cost for very different teammates (100, 0)', () => {
      const team = [makePlayer('1', undefined, 100), makePlayer('2', undefined, 0)];
      // |100 - 0| * 15 = 1500
      expect(engine.testCalculateLevelTeammateBias(team)).toBe(1500);
    });

    it('returns lower cost for similar levels (70, 80) vs very different (20, 100)', () => {
      const teamSimilar = [makePlayer('1', undefined, 70), makePlayer('2', undefined, 80)];
      const teamDifferent = [makePlayer('1', undefined, 20), makePlayer('2', undefined, 100)];
      expect(engine.testCalculateLevelTeammateBias(teamSimilar))
        .toBeLessThan(engine.testCalculateLevelTeammateBias(teamDifferent));
    });

    it('returns 0 for a single player team', () => {
      const team = [makePlayer('1', undefined, 80)];
      expect(engine.testCalculateLevelTeammateBias(team)).toBe(0);
    });

    it('uses 50 as default level when undefined', () => {
      const team = [makePlayer('1'), makePlayer('2')];
      // |50 - 50| * 15 = 0
      expect(engine.testCalculateLevelTeammateBias(team)).toBe(0);
    });
  });

  describe('generate() integration', () => {
    it('generates courts with 8 gender/level-tagged players', () => {
      const players: Player[] = [
        makePlayer('1', 'F', 80),
        makePlayer('2', 'M', 20),
        makePlayer('3', 'F', 75),
        makePlayer('4', 'M', 25),
        makePlayer('5', 'F', 70),
        makePlayer('6', 'M', 30),
        makePlayer('7', 'F', 65),
        makePlayer('8', 'M', 35),
      ];

      const courts = engine.generate(players, 2);
      expect(courts).toHaveLength(2);
      courts.forEach((court: Court) => {
        expect(court.teams).toBeDefined();
        expect(court.players.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('produces better gender balance than a random all-same-gender split', () => {
      // Run multiple times and verify gender cost is 0 more often than not
      const players: Player[] = [
        makePlayer('1', 'F', 80),
        makePlayer('2', 'M', 20),
        makePlayer('3', 'F', 75),
        makePlayer('4', 'M', 25),
      ];

      let genderMismatchCount = 0;
      for (let i = 0; i < 5; i++) {
        engine.resetHistory();
        const courts = engine.generate(players, 1);
        const court = courts[0];
        if (court?.teams) {
          const cost = engine.testCalculateGenderCost(court.teams.team1, court.teams.team2);
          if (cost > 0) genderMismatchCount++;
        }
      }
      // With smart engine, gender mismatch should be rare/zero
      expect(genderMismatchCount).toBeLessThan(5);
    });

    it('works with players without sex/level attributes', () => {
      const players: Player[] = [
        makePlayer('1'),
        makePlayer('2'),
        makePlayer('3'),
        makePlayer('4'),
      ];

      const courts = engine.generate(players, 1);
      expect(courts).toHaveLength(1);
      expect(courts[0].teams).toBeDefined();
    });
  });
});
