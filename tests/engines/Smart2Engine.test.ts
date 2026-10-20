import { beforeEach, describe, expect, it } from 'vitest';

import { engine, getEngineType, setEngine } from '../../src/engines/engineSelector';
import { engineSL2, Smart2Engine } from '../../src/engines/Smart2Engine';
import type { Court, Player } from '../../src/types';
import { DEFAULT_LEVEL } from '../../src/types';
import { pairKey } from '../../src/utils/playerUtils';

/** Test harness subclass exposing tracker static maps for controlled assertions. */
class TestSmart2Engine extends Smart2Engine {
  /** Mutates win record count for specified player. */
  setWins(playerId: string, wins: number): void {
    TestSmart2Engine.winCountMap.set(playerId, wins);
  }

  /** Mutates loss record count for specified player. */
  setLosses(playerId: string, losses: number): void {
    TestSmart2Engine.lossCountMap.set(playerId, losses);
  }

  /** Mutates teammate pairing count for pair key. */
  setTeammates(key: string, count: number): void {
    TestSmart2Engine.teammateCountMap.set(key, count);
  }

  /** Mutates opponent pairing count for pair key. */
  setOpponents(key: string, count: number): void {
    TestSmart2Engine.opponentCountMap.set(key, count);
  }
}

/** Factory helper for creating test player fixtures. */
function makePlayer(id: string, gender?: Player['gender'], level?: number): Player {
  return { id, name: `Player ${id}`, isPresent: true, gender, level };
}

describe('Smart2Engine', () => {
  let testEngine: TestSmart2Engine;

  beforeEach(() => {
    testEngine = new TestSmart2Engine();
    testEngine.resetHistory();
    engineSL2.resetHistory();
  });

  describe('Initial Defaults and Configure Updates', () => {
    it('initializes with specified default weights and hyperparameter values', () => {
      expect(testEngine.COOLING_RATE).toBe(0.9985);
      expect(testEngine.levelWeight).toBe(150);
      expect(testEngine.varietyWeight).toBe(800);
      expect(testEngine.mixedDoublesWeight).toBe(200);
      expect(testEngine.winStreakWeight).toBe(300);
      expect(testEngine.windowTolerance).toBe(25);
      expect(testEngine.podRepeatThreshold).toBe(3);
      expect(testEngine.SA_ITERATIONS).toBe(500);
      expect(testEngine.INITIAL_TEMPERATURE).toBe(2000.0);
    });

    it('updates hyperparameter weights and simulated annealing settings via configure', () => {
      testEngine.configure({
        levelWeight: 220,
        varietyWeight: 950,
        mixedDoublesWeight: 310,
        winStreakWeight: 450,
        windowTolerance: 15,
        podRepeatThreshold: 4,
        iterations: 800,
        initialTemperature: 1500,
        coolingRate: 0.999,
      });

      expect(testEngine.levelWeight).toBe(220);
      expect(testEngine.varietyWeight).toBe(950);
      expect(testEngine.mixedDoublesWeight).toBe(310);
      expect(testEngine.winStreakWeight).toBe(450);
      expect(testEngine.windowTolerance).toBe(15);
      expect(testEngine.podRepeatThreshold).toBe(4);
      expect(testEngine.SA_ITERATIONS).toBe(800);
      expect(testEngine.INITIAL_TEMPERATURE).toBe(1500);
      expect(testEngine.COOLING_RATE).toBe(0.999);
    });

    it('ignores invalid non-numeric parameters during configure', () => {
      testEngine.configure({
        levelWeight: 'high',
        varietyWeight: null,
        windowTolerance: undefined,
      });

      expect(testEngine.levelWeight).toBe(150);
      expect(testEngine.varietyWeight).toBe(800);
      expect(testEngine.windowTolerance).toBe(25);
    });
  });

  describe('Effective Level Calculation and Win Momentum', () => {
    it('falls back to DEFAULT_LEVEL when level is missing and player has no match history', () => {
      const p = makePlayer('p1');
      expect(testEngine.calculateEffectiveLevel(p)).toBe(DEFAULT_LEVEL);
    });

    it('preserves base level when player has zero net win-loss difference', () => {
      const p = makePlayer('p1', undefined, 70);
      expect(testEngine.calculateEffectiveLevel(p)).toBe(70);
    });

    it('applies positive momentum adjustment for net wins', () => {
      const p = makePlayer('p1', undefined, 60);
      testEngine.setWins('p1', 3);
      testEngine.setLosses('p1', 1);
      expect(testEngine.calculateEffectiveLevel(p)).toBe(66);
    });

    it('applies negative momentum adjustment for net losses', () => {
      const p = makePlayer('p1', undefined, 60);
      testEngine.setWins('p1', 1);
      testEngine.setLosses('p1', 3);
      expect(testEngine.calculateEffectiveLevel(p)).toBe(54);
    });

    it('clamps upper bound of effective level to 100', () => {
      const p = makePlayer('p1', undefined, 95);
      testEngine.setWins('p1', 5);
      expect(testEngine.calculateEffectiveLevel(p)).toBe(100);
    });

    it('clamps lower bound of effective level to 0', () => {
      const p = makePlayer('p1', undefined, 5);
      testEngine.setLosses('p1', 5);
      expect(testEngine.calculateEffectiveLevel(p)).toBe(0);
    });
  });

  describe('Sliding Window Level Cost and Grouping', () => {
    it('computes team balance cost as absolute level average difference multiplied by levelWeight', () => {
      const t1 = [makePlayer('1', undefined, 80), makePlayer('2', undefined, 80)];
      const t2 = [makePlayer('3', undefined, 60), makePlayer('4', undefined, 60)];
      expect(testEngine.calculateTeamBalanceCost(t1, t2)).toBe(20 * 150);
    });

    it('returns zero team balance cost when opposing teams have identical average level', () => {
      const t1 = [makePlayer('1', undefined, 70), makePlayer('2', undefined, 50)];
      const t2 = [makePlayer('3', undefined, 60), makePlayer('4', undefined, 60)];
      expect(testEngine.calculateTeamBalanceCost(t1, t2)).toBe(0);
    });

    it('returns zero court spread cost when player level spread is within tolerance', () => {
      const players = [
        makePlayer('1', undefined, 50),
        makePlayer('2', undefined, 60),
        makePlayer('3', undefined, 70),
        makePlayer('4', undefined, 75),
      ];
      expect(testEngine.calculateCourtSpreadCost(players)).toBe(0);
    });

    it('penalizes player level spread exceeding tolerance by excess times levelWeight', () => {
      const players = [
        makePlayer('1', undefined, 20),
        makePlayer('2', undefined, 30),
        makePlayer('3', undefined, 60),
        makePlayer('4', undefined, 80),
      ];
      expect(testEngine.calculateCourtSpreadCost(players)).toBe((60 - 25) * 150);
    });

    it('evaluates weak vs weak grouping within tolerance with zero spread penalty', () => {
      const weakPlayers = [
        makePlayer('w1', 'M', 15),
        makePlayer('w2', 'F', 20),
        makePlayer('w3', 'M', 25),
        makePlayer('w4', 'F', 30),
      ];
      expect(testEngine.calculateCourtSpreadCost(weakPlayers)).toBe(0);
    });

    it('evaluates strong vs strong grouping within tolerance with zero spread penalty', () => {
      const strongPlayers = [
        makePlayer('s1', 'M', 75),
        makePlayer('s2', 'F', 80),
        makePlayer('s3', 'M', 85),
        makePlayer('s4', 'F', 90),
      ];
      expect(testEngine.calculateCourtSpreadCost(strongPlayers)).toBe(0);
    });

    it('demonstrates medium bridging players span adjacent groups within tolerance', () => {
      const lowerCourt = [
        makePlayer('1', 'M', 35),
        makePlayer('2', 'F', 40),
        makePlayer('3', 'M', 50),
        makePlayer('4', 'F', 60),
      ];
      const upperCourt = [
        makePlayer('5', 'M', 60),
        makePlayer('6', 'F', 70),
        makePlayer('7', 'M', 80),
        makePlayer('8', 'F', 85),
      ];
      expect(testEngine.calculateCourtSpreadCost(lowerCourt)).toBe(0);
      expect(testEngine.calculateCourtSpreadCost(upperCourt)).toBe(0);
    });

    it('assigns lower total court cost to segregated skill courts over mixed skill courts', () => {
      const s1 = makePlayer('s1', 'M', 90);
      const s2 = makePlayer('s2', 'F', 90);
      const s3 = makePlayer('s3', 'M', 90);
      const s4 = makePlayer('s4', 'F', 90);
      const w1 = makePlayer('w1', 'M', 10);
      const w2 = makePlayer('w2', 'F', 10);
      const w3 = makePlayer('w3', 'M', 10);
      const w4 = makePlayer('w4', 'F', 10);

      const segregatedCourt1: Court = {
        courtNumber: 1,
        players: [s1, s2, s3, s4],
        teams: { team1: [s1, s2], team2: [s3, s4] },
      };
      const segregatedCourt2: Court = {
        courtNumber: 2,
        players: [w1, w2, w3, w4],
        teams: { team1: [w1, w2], team2: [w3, w4] },
      };

      const mixedCourt1: Court = {
        courtNumber: 1,
        players: [s1, s2, w1, w2],
        teams: { team1: [s1, w1], team2: [s2, w2] },
      };
      const mixedCourt2: Court = {
        courtNumber: 2,
        players: [s3, s4, w3, w4],
        teams: { team1: [s3, w3], team2: [s4, w4] },
      };

      const segregatedCost = testEngine.courtSpecificCost(segregatedCourt1)
        + testEngine.courtSpecificCost(segregatedCourt2);
      const mixedCost = testEngine.courtSpecificCost(mixedCourt1)
        + testEngine.courtSpecificCost(mixedCourt2);

      expect(segregatedCost).toBeLessThan(mixedCost);
      expect(mixedCost - segregatedCost).toBeGreaterThanOrEqual(16000);
    });

    it('generates valid courts for players of varying skill levels', () => {
      const players = [
        makePlayer('1', 'M', 80),
        makePlayer('2', 'F', 75),
        makePlayer('3', 'M', 55),
        makePlayer('4', 'F', 50),
        makePlayer('5', 'M', 45),
        makePlayer('6', 'F', 40),
        makePlayer('7', 'M', 20),
        makePlayer('8', 'F', 15),
      ];

      const { courts } = testEngine.generate(players, 2);
      expect(courts).toHaveLength(2);
      expect(courts.every(c => c.players.length === 4)).toBe(true);
    });
  });

  describe('Mixed Doubles Soft Preference', () => {
    it('penalizes FF vs MM matchup with mixedDoublesWeight', () => {
      const t1 = [makePlayer('1', 'F'), makePlayer('2', 'F')];
      const t2 = [makePlayer('3', 'M'), makePlayer('4', 'M')];
      expect(testEngine.calculateMixedDoublesCost(t1, t2)).toBe(200);
    });

    it('penalizes MM vs FF matchup with mixedDoublesWeight', () => {
      const t1 = [makePlayer('1', 'M'), makePlayer('2', 'M')];
      const t2 = [makePlayer('3', 'F'), makePlayer('4', 'F')];
      expect(testEngine.calculateMixedDoublesCost(t1, t2)).toBe(200);
    });

    it('deducts mixedDoublesWeight as bonus when both teams are 1M+1F', () => {
      const t1 = [makePlayer('1', 'M'), makePlayer('2', 'F')];
      const t2 = [makePlayer('3', 'F'), makePlayer('4', 'M')];
      expect(testEngine.calculateMixedDoublesCost(t1, t2)).toBe(-200);
    });

    it('returns zero cost when matchup is homogeneous same-gender on both sides', () => {
      const t1 = [makePlayer('1', 'M'), makePlayer('2', 'M')];
      const t2 = [makePlayer('3', 'M'), makePlayer('4', 'M')];
      expect(testEngine.calculateMixedDoublesCost(t1, t2)).toBe(0);
    });

    it('returns zero cost for singles or unknown genders', () => {
      const s1 = [makePlayer('1', 'M')];
      const s2 = [makePlayer('2', 'F')];
      expect(testEngine.calculateMixedDoublesCost(s1, s2)).toBe(0);

      const u1 = [makePlayer('1', 'Unknown'), makePlayer('2', 'F')];
      const u2 = [makePlayer('3', 'M'), makePlayer('4', 'M')];
      expect(testEngine.calculateMixedDoublesCost(u1, u2)).toBe(0);
    });

    it('favors mixed doubles split when assigning 2M and 2F players on a court', () => {
      const players = [
        makePlayer('m1', 'M', 50),
        makePlayer('m2', 'M', 50),
        makePlayer('f1', 'F', 50),
        makePlayer('f2', 'F', 50),
      ];

      const { courts } = testEngine.generate(players, 1);
      expect(courts).toHaveLength(1);

      const court = courts[0];
      expect(court.teams).toBeDefined();

      const t1Genders = court.teams!.team1.map(p => p.gender).sort();
      const t2Genders = court.teams!.team2.map(p => p.gender).sort();

      expect(t1Genders).toEqual(['F', 'M']);
      expect(t2Genders).toEqual(['F', 'M']);
    });
  });

  describe('Opponent Repeat Penalty and Pod Repeat Avoidance', () => {
    it('uses varietyWeight for opponent cost inside sharedTeamCost', () => {
      const t1 = [makePlayer('1'), makePlayer('2')];
      const t2 = [makePlayer('3'), makePlayer('4')];
      testEngine.setOpponents(pairKey('1', '3'), 1);

      const cost = testEngine.sharedTeamCost(t1, t2);
      expect(cost).toBeGreaterThanOrEqual(800);
    });

    it('returns zero pod repeat cost when repeated co-play pairs remain below threshold', () => {
      const players = [makePlayer('1'), makePlayer('2'), makePlayer('3'), makePlayer('4')];
      testEngine.setTeammates(pairKey('1', '2'), 1);
      testEngine.setOpponents(pairKey('3', '4'), 1);
      expect(testEngine.calculatePodRepeatCost(players)).toBe(0);
    });

    it('calculates pod repeat penalty when 3 or more pairs have co-played', () => {
      const players = [makePlayer('1'), makePlayer('2'), makePlayer('3'), makePlayer('4')];
      testEngine.setTeammates(pairKey('1', '2'), 1);
      testEngine.setOpponents(pairKey('1', '3'), 1);
      testEngine.setTeammates(pairKey('2', '3'), 1);

      expect(testEngine.calculatePodRepeatCost(players)).toBe(3 * 800);
    });

    it('penalizes full pod repetition when all six pairs have co-played', () => {
      const players = [makePlayer('1'), makePlayer('2'), makePlayer('3'), makePlayer('4')];
      for (let i = 0; i < players.length; i++) {
        for (let j = i + 1; j < players.length; j++) {
          testEngine.setTeammates(pairKey(players[i].id, players[j].id), 1);
        }
      }

      expect(testEngine.calculatePodRepeatCost(players)).toBe(6 * 800);
    });

    it('avoids repeating identical pods on subsequent round generation', () => {
      const players = [
        makePlayer('1', 'M', 50),
        makePlayer('2', 'F', 50),
        makePlayer('3', 'M', 50),
        makePlayer('4', 'F', 50),
        makePlayer('5', 'M', 50),
        makePlayer('6', 'F', 50),
        makePlayer('7', 'M', 50),
        makePlayer('8', 'F', 50),
      ];

      const round1 = testEngine.generate(players, 2);
      const court1InitialIds = new Set(round1.courts[0].players.map(p => p.id));

      const round2 = testEngine.generate(players, 2);
      const court1SecondIds = new Set(round2.courts[0].players.map(p => p.id));

      const overlap = [...court1SecondIds].filter(id => court1InitialIds.has(id)).length;
      expect(overlap).toBeLessThan(4);
    });
  });

  describe('EngineSelector Support for sl', () => {
    it('switches engine type to sl and returns singleton engineSL2 instance', () => {
      setEngine('sl');
      expect(getEngineType()).toBe('sl');
      expect(engine()).toBe(engineSL2);
      expect(engine().name).toBe('Smart Matching v2');
      expect(engine().description).toBeTruthy();
    });

    it('generates court assignments via selector when sl is active', () => {
      setEngine('sl');
      const players = [
        makePlayer('1', 'M', 50),
        makePlayer('2', 'F', 50),
        makePlayer('3', 'M', 50),
        makePlayer('4', 'F', 50),
      ];

      const result = engine().generate(players, 1);
      expect(result.courts).toHaveLength(1);
      expect(result.courts[0].players).toHaveLength(4);
      expect(result.courts[0].teams).toBeDefined();
    });
  });
});
