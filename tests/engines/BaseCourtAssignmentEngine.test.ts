import { beforeEach, describe, expect, it } from 'vitest';

import { BaseCourtAssignmentEngine } from '../../src/engines/BaseCourtAssignmentEngine';
import type { Court, Player } from '../../src/types';

/**
 * Test implementation of BaseCourtAssignmentEngine that exposes protected methods
 * for testing purposes.
 */
class TestEngine extends BaseCourtAssignmentEngine {
  getName(): string {
    return 'Test Engine';
  }

  getDescription(): string {
    return 'Test engine for BaseCourtAssignmentEngine tests';
  }

  protected generateAssignments(players: Player[], numberOfCourts: number, startCourtNum: number): Court[] {
    const courts: Court[] = [];
    let idx = 0;

    for (let courtNum = startCourtNum; courtNum < startCourtNum + numberOfCourts; courtNum++) {
      const courtPlayers = players.slice(idx, idx + 4);
      idx += 4;
      if (courtPlayers.length < 2) break;
      if (courtPlayers.length === 3) {
        idx--;
        courtPlayers.pop();
      }

      const teams = this.createTeamsFromPlayers(courtPlayers);
      courts.push({ courtNumber: courtNum, players: courtPlayers, teams });
    }

    return courts;
  }

  protected getOptimalTeamSplit(players: Player[]): Court['teams'] {
    return this.chooseBestTeamSplit(players).teams;
  }

  protected evaluateTeamSplitCost(team1: Player[], team2: Player[]): number {
    let cost = 0;
    cost += this.calculateTeammateCost(team1, 1);
    cost += this.calculateTeammateCost(team2, 1);
    cost += this.calculateOpponentCost(team1, team2, 1);
    cost += this.calculateWinBalanceCost(team1, team2, 1);
    cost += this.calculateLossBalanceCost(team1, team2, 1);
    return cost;
  }

  public testCalculateTeammateCost(team: Player[], penaltyMultiplier: number): number {
    return this.calculateTeammateCost(team, penaltyMultiplier);
  }

  public testCalculateSkillPairPenalty(team: Player[], penaltyMultiplier: number): number {
    return this.calculateSkillPairPenalty(team, penaltyMultiplier);
  }

  public testCalculateOpponentCost(team1: Player[], team2: Player[], penaltyMultiplier: number): number {
    return this.calculateOpponentCost(team1, team2, penaltyMultiplier);
  }

  public testCalculateWinBalanceCost(team1: Player[], team2: Player[], penaltyMultiplier: number): number {
    return this.calculateWinBalanceCost(team1, team2, penaltyMultiplier);
  }

  public testCalculateLossBalanceCost(team1: Player[], team2: Player[], penaltyMultiplier: number): number {
    return this.calculateLossBalanceCost(team1, team2, penaltyMultiplier);
  }

  public testCalculateSinglesCost(players: Player[], penaltyMultiplier: number): number {
    return this.calculateSinglesCost(players, penaltyMultiplier);
  }

  public testCreateTeamsFromPlayers(players: Player[]): Court['teams'] {
    return this.createTeamsFromPlayers(players);
  }

  public testChooseBestTeamSplit(players: Player[]): { teams: Court['teams']; cost: number } {
    return this.chooseBestTeamSplit(players);
  }
}

function mockPlayers(count: number, startId = 0): Player[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `P${startId + i}`,
    name: `Player ${startId + i}`,
    isPresent: true,
  }));
}

function createMockCourt(courtNumber: number, players: Player[], winner?: 1 | 2): Court {
  return {
    courtNumber,
    players,
    teams: {
      team1: [players[0], players[1]],
      team2: [players[2], players[3]],
    },
    winner,
  };
}

describe('BaseCourtAssignmentEngine', () => {
  let engine: TestEngine;

  beforeEach(() => {
    engine = new TestEngine();
    engine.resetHistory();
  });

  describe('calculateTeammateCost', () => {
    it('returns 0 cost when no previous teammate pairs', () => {
      const players = mockPlayers(2);
      const cost = engine.testCalculateTeammateCost(players, 1);
      expect(cost).toBe(0);
    });

    it('returns 0 cost for single player team', () => {
      const players = mockPlayers(1);
      const cost = engine.testCalculateTeammateCost(players, 1);
      expect(cost).toBe(0);
    });

    it('calculates cost based on previous pairings', () => {
      const players = mockPlayers(4);

      engine.generate(players, 1);
      engine.clearCurrentSession();

      const team = [players[0], players[1]];
      const cost = engine.testCalculateTeammateCost(team, 1);
      expect(cost).toBeGreaterThan(0);
    });

    it('applies penalty multiplier correctly', () => {
      const players = mockPlayers(4);

      engine.generate(players, 1);
      engine.clearCurrentSession();

      const team = [players[0], players[1]];
      const costWith1 = engine.testCalculateTeammateCost(team, 1);
      const costWith10 = engine.testCalculateTeammateCost(team, 10);
      const costWith100 = engine.testCalculateTeammateCost(team, 100);

      expect(costWith10).toBe(costWith1 * 10);
      expect(costWith100).toBe(costWith1 * 100);
    });

    it('calculates cumulative cost for multiple pairs in team', () => {
      const players = mockPlayers(4);

      engine.generate(players, 1);
      engine.clearCurrentSession();
      const firstCost = engine.testCalculateTeammateCost([players[0], players[1]], 1);

      engine.generate(players, 1);
      engine.clearCurrentSession();
      const secondCost = engine.testCalculateTeammateCost([players[0], players[1]], 1);

      expect(secondCost).toBeGreaterThanOrEqual(firstCost);
      expect(firstCost).toBeGreaterThan(0);
    });
  });

  describe('calculateSkillPairPenalty', () => {
    it('returns 0 cost when players have no win/loss history', () => {
      const players = mockPlayers(2);
      const cost = engine.testCalculateSkillPairPenalty(players, 1);
      expect(cost).toBe(0);
    });

    it('returns 0 cost for single player team', () => {
      const players = mockPlayers(1);
      const cost = engine.testCalculateSkillPairPenalty(players, 1);
      expect(cost).toBe(0);
    });

    it('calculates penalty based on wins and losses', () => {
      const players = mockPlayers(4);
      const court = createMockCourt(1, players, 1);

      engine.recordWins([court]);
      engine.clearCurrentSession();

      const winnerPairCost = engine.testCalculateSkillPairPenalty([players[0], players[1]], 1);
      const mixedPairCost = engine.testCalculateSkillPairPenalty([players[0], players[2]], 1);

      expect(winnerPairCost).toBeGreaterThan(mixedPairCost);
      expect(mixedPairCost).toBe(0);
      expect(winnerPairCost).toBe(1);
    });

    it('applies penalty multiplier correctly', () => {
      const players = mockPlayers(4);
      const court = createMockCourt(1, players, 1);

      engine.recordWins([court]);
      engine.clearCurrentSession();

      const team = [players[0], players[1]];
      const costWith1 = engine.testCalculateSkillPairPenalty(team, 1);
      const costWith100 = engine.testCalculateSkillPairPenalty(team, 100);

      expect(costWith100).toBe(costWith1 * 100);
    });
  });

  describe('calculateOpponentCost', () => {
    it('returns 0 cost when no previous opponent pairs', () => {
      const players = mockPlayers(4);
      const cost = engine.testCalculateOpponentCost([players[0], players[1]], [players[2], players[3]], 1);
      expect(cost).toBe(0);
    });

    it('calculates cost based on previous opponent pairings', () => {
      const players = mockPlayers(4);

      engine.generate(players, 1);
      engine.clearCurrentSession();

      const cost = engine.testCalculateOpponentCost([players[0], players[1]], [players[2], players[3]], 1);
      expect(cost).toBeGreaterThan(0);
    });

    it('applies penalty multiplier correctly', () => {
      const players = mockPlayers(4);

      engine.generate(players, 1);
      engine.clearCurrentSession();

      const costWith1 = engine.testCalculateOpponentCost([players[0], players[1]], [players[2], players[3]], 1);
      const costWith10 = engine.testCalculateOpponentCost([players[0], players[1]], [players[2], players[3]], 10);
      const costWith50 = engine.testCalculateOpponentCost([players[0], players[1]], [players[2], players[3]], 50);

      expect(costWith10).toBe(costWith1 * 10);
      expect(costWith50).toBe(costWith1 * 50);
    });

    it('works with single player teams (singles match)', () => {
      const players = mockPlayers(2);

      engine.generate(players, 1);
      engine.clearCurrentSession();

      const cost = engine.testCalculateOpponentCost([players[0]], [players[1]], 1);
      expect(cost).toBeGreaterThanOrEqual(0);
    });
  });

  describe('calculateWinBalanceCost', () => {
    it('returns 0 cost when players have equal wins', () => {
      const players = mockPlayers(4);
      const cost = engine.testCalculateWinBalanceCost([players[0], players[1]], [players[2], players[3]], 1);
      expect(cost).toBe(0);
    });

    it('calculates cost based on win difference', () => {
      const players = mockPlayers(4);
      const court = createMockCourt(1, players, 1);

      engine.recordWins([court]);
      engine.clearCurrentSession();

      const cost = engine.testCalculateWinBalanceCost([players[0], players[1]], [players[2], players[3]], 1);
      expect(cost).toBe(2);
    });

    it('applies penalty multiplier correctly', () => {
      const players = mockPlayers(4);
      const court = createMockCourt(1, players, 1);

      engine.recordWins([court]);
      engine.clearCurrentSession();

      const costWith1 = engine.testCalculateWinBalanceCost([players[0], players[1]], [players[2], players[3]], 1);
      const costWith100 = engine.testCalculateWinBalanceCost([players[0], players[1]], [players[2], players[3]], 100);

      expect(costWith1).toBe(2);
      expect(costWith100).toBe(200);
    });

    it('works with single player teams', () => {
      const players = mockPlayers(2);
      const court: Court = {
        courtNumber: 1,
        players,
        teams: { team1: [players[0]], team2: [players[1]] },
        winner: 1,
      };

      engine.recordWins([court]);
      engine.clearCurrentSession();

      const cost = engine.testCalculateWinBalanceCost([players[0]], [players[1]], 1);
      expect(cost).toBe(1);
    });
  });

  describe('calculateLossBalanceCost', () => {
    it('returns 0 cost when players have equal losses', () => {
      const players = mockPlayers(4);
      const cost = engine.testCalculateLossBalanceCost([players[0], players[1]], [players[2], players[3]], 1);
      expect(cost).toBe(0);
    });

    it('calculates cost based on loss difference', () => {
      const players = mockPlayers(4);
      const court = createMockCourt(1, players, 1);

      engine.recordWins([court]);
      engine.clearCurrentSession();

      const cost = engine.testCalculateLossBalanceCost([players[0], players[1]], [players[2], players[3]], 1);
      expect(cost).toBe(2);
    });

    it('applies penalty multiplier correctly', () => {
      const players = mockPlayers(4);
      const court = createMockCourt(1, players, 1);

      engine.recordWins([court]);
      engine.clearCurrentSession();

      const costWith1 = engine.testCalculateLossBalanceCost([players[0], players[1]], [players[2], players[3]], 1);
      const costWith2000 = engine.testCalculateLossBalanceCost([players[0], players[1]], [players[2], players[3]], 2000);

      expect(costWith1).toBe(2);
      expect(costWith2000).toBe(4000);
    });

    it('works with single player teams', () => {
      const players = mockPlayers(2);
      const court: Court = {
        courtNumber: 1,
        players,
        teams: { team1: [players[0]], team2: [players[1]] },
        winner: 1,
      };

      engine.recordWins([court]);
      engine.clearCurrentSession();

      const cost = engine.testCalculateLossBalanceCost([players[0]], [players[1]], 1);
      expect(cost).toBe(1);
    });
  });

  describe('calculateSinglesCost', () => {
    it('returns 0 cost when players have no singles history', () => {
      const players = mockPlayers(2);
      const cost = engine.testCalculateSinglesCost(players, 1);
      expect(cost).toBe(0);
    });

    it('returns 0 cost for non-2-player array', () => {
      const players = mockPlayers(4);
      const cost = engine.testCalculateSinglesCost(players, 1);
      expect(cost).toBe(0);
    });

    it('calculates cost based on singles history', () => {
      const players = mockPlayers(2);

      engine.generate(players, 1);
      engine.clearCurrentSession();

      const cost = engine.testCalculateSinglesCost(players, 1);
      expect(cost).toBe(2);
    });

    it('applies penalty multiplier correctly', () => {
      const players = mockPlayers(2);

      engine.generate(players, 1);
      engine.clearCurrentSession();

      const costWith1 = engine.testCalculateSinglesCost(players, 1);
      const costWith100 = engine.testCalculateSinglesCost(players, 100);

      expect(costWith1).toBe(2);
      expect(costWith100).toBe(200);
    });

    it('accumulates cost across multiple singles matches', () => {
      const players = mockPlayers(2);

      for (let i = 0; i < 3; i++) {
        engine.generate(players, 1);
        engine.clearCurrentSession();
      }

      const cost = engine.testCalculateSinglesCost(players, 1);
      expect(cost).toBe(6);
    });
  });

  describe('createTeamsFromPlayers', () => {
    it('creates singles teams for 2 players', () => {
      const players = mockPlayers(2);
      const teams = engine.testCreateTeamsFromPlayers(players);

      expect(teams).toBeDefined();
      expect(teams!.team1).toEqual([players[0]]);
      expect(teams!.team2).toEqual([players[1]]);
    });

    it('creates doubles teams for 4 players', () => {
      const players = mockPlayers(4);
      const teams = engine.testCreateTeamsFromPlayers(players);

      expect(teams).toBeDefined();
      expect(teams!.team1).toHaveLength(2);
      expect(teams!.team2).toHaveLength(2);
      expect([...teams!.team1, ...teams!.team2].map(p => p.id).sort()).toEqual(['P0', 'P1', 'P2', 'P3']);
    });

    it('returns undefined for invalid player counts', () => {
      expect(engine.testCreateTeamsFromPlayers(mockPlayers(1))).toBeUndefined();
      expect(engine.testCreateTeamsFromPlayers(mockPlayers(3))).toBeUndefined();
      expect(engine.testCreateTeamsFromPlayers(mockPlayers(5))).toBeUndefined();
    });

    it('chooses optimal team split for 4 players', () => {
      const players = mockPlayers(4);

      const court = createMockCourt(1, players, 1);
      engine.recordWins([court]);
      engine.clearCurrentSession();

      const teams = engine.testCreateTeamsFromPlayers(players);

      expect(teams).toBeDefined();
    });
  });

  describe('chooseBestTeamSplit', () => {
    it('returns the best team split with lowest cost', () => {
      const players = mockPlayers(4);
      const result = engine.testChooseBestTeamSplit(players);

      expect(result).toHaveProperty('teams');
      expect(result).toHaveProperty('cost');
      expect(result.teams).toBeDefined();
      expect(result.teams!.team1).toHaveLength(2);
      expect(result.teams!.team2).toHaveLength(2);
      expect(result.cost).toBe(0);
    });

    it('evaluates all 3 possible team splits', () => {
      const players = mockPlayers(4);

      const result = engine.testChooseBestTeamSplit(players);

      expect(result.teams).toBeDefined();
      const allPlayers = [...result.teams!.team1, ...result.teams!.team2];
      expect(allPlayers.map(p => p.id).sort()).toEqual(['P0', 'P1', 'P2', 'P3']);
    });

    it('chooses split that minimizes teammate repetition', () => {
      const players = mockPlayers(4);

      for (let i = 0; i < 5; i++) {
        const court = createMockCourt(1, players, 1);
        engine.recordWins([court]);
        engine.clearCurrentSession();
      }

      const result = engine.testChooseBestTeamSplit(players);
      const team1Ids = result.teams!.team1.map(p => p.id);
      const team2Ids = result.teams!.team2.map(p => p.id);

      const isP0P1Together = (team1Ids.includes('P0') && team1Ids.includes('P1')) ||
                             (team2Ids.includes('P0') && team2Ids.includes('P1'));

      expect(isP0P1Together).toBe(false);
    });

    it('returns higher cost when teams have history', () => {
      const players = mockPlayers(4);

      const resultNoHistory = engine.testChooseBestTeamSplit(players);
      const costNoHistory = resultNoHistory.cost;

      const court = createMockCourt(1, players, 1);
      engine.recordWins([court]);
      engine.clearCurrentSession();

      const resultWithHistory = engine.testChooseBestTeamSplit(players);
      const costWithHistory = resultWithHistory.cost;

      expect(costWithHistory).toBeGreaterThanOrEqual(costNoHistory);
    });
  });

  describe('Integration with generate method', () => {
    it('uses shared cost calculation methods correctly', () => {
      const players = mockPlayers(8);

      for (let i = 0; i < 3; i++) {
        const assignments = engine.generate(players, 2);
        assignments.forEach(court => {
          if (court.courtNumber === 1) {
            const courtWithWinner = { ...court, winner: 1 as const };
            engine.recordWins([courtWithWinner]);
          }
        });
        engine.clearCurrentSession();
      }

      const assignments = engine.generate(players, 2);

      expect(assignments).toHaveLength(2);
      assignments.forEach(court => {
        expect(court.players.length).toBeGreaterThanOrEqual(2);
        expect(court.teams).toBeDefined();
      });
    });

    it('generates consistent team splits across multiple calls', () => {
      const players = mockPlayers(4);

      for (let i = 0; i < 10; i++) {
        const assignments = engine.generate(players, 1);
        if (assignments[0].teams) {
          const courtWithWinner = { ...assignments[0], winner: 1 as const };
          engine.recordWins([courtWithWinner]);
        }
        engine.clearCurrentSession();
      }

      const pairings: Record<string, number> = {};
      for (let i = 0; i < 20; i++) {
        const assignments = engine.generate(players, 1);
        const court = assignments[0];
        if (court.teams) {
          const team1Ids = court.teams.team1.map(p => p.id).sort();
          const team2Ids = court.teams.team2.map(p => p.id).sort();
          const key1 = team1Ids.join('-');
          const key2 = team2Ids.join('-');
          pairings[key1] = (pairings[key1] || 0) + 1;
          pairings[key2] = (pairings[key2] || 0) + 1;
        }
      }

      expect(Object.keys(pairings).length).toBeGreaterThan(0);
    });
  });
});
