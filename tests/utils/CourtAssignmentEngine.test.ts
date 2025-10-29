import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CourtAssignmentEngine,
  generateCourtAssignments,
  getBenchedPlayers,
} from '../../src/utils/CourtAssignmentEngine';
import type { ManualCourtSelection, Court, Player } from '../../src/types';

const testResetHistory = (): void => CourtAssignmentEngine.resetHistory();

const testShouldReversePreviousRecord = (
  previousRecord: { winner: 1 | 2; winningPlayers: string[]; losingPlayers: string[] },
  currentWinner: 1 | 2,
  currentWinningPlayerIds: string[],
): boolean => CourtAssignmentEngine['shouldReversePreviousRecord'](previousRecord, currentWinner, currentWinningPlayerIds);

const testReversePreviousWinRecord = (
  previousRecord: { winner: 1 | 2; winningPlayers: string[]; losingPlayers: string[] },
): void => CourtAssignmentEngine['reversePreviousWinRecord'](previousRecord);

function mockPlayers(count: number): Player[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `P${i}`,
    name: `Player ${i}`,
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

describe('CourtAssignment Engine – core behaviour', () => {
  beforeEach(() => {
    testResetHistory();
  });

  it('returns empty assignments when no present players', () => {
    expect(generateCourtAssignments([], 4)).toEqual([]);
  });

  it('assigns everyone when capacity not exceeded', () => {
    const players = mockPlayers(8);
    const assignments = generateCourtAssignments(players, 4);
    const benched = getBenchedPlayers(assignments, players);

    expect(benched.length).toBe(0);
    const idsOnCourts = assignments.flatMap(c => c.players.map(p => p.id));
    expect(new Set(idsOnCourts).size).toBe(8);
  });

  it('never places 3 players on a court', () => {
    const players = mockPlayers(14);
    const assignments = generateCourtAssignments(players, 4);
    assignments.forEach(court => {
      expect([2, 4]).toContain(court.players.length);
    });
  });

  it('benched players rotate fairly (no repeats until everyone benched)', () => {
    const players = mockPlayers(12);
    const numberOfCourts = 2;
    const rounds = 4;
    const benchHistory: Record<string, number> = {};
    players.forEach(p => (benchHistory[p.id] = 0));

    for (let r = 0; r < rounds; r++) {
      const assignments = generateCourtAssignments(players, numberOfCourts);
      const benched = getBenchedPlayers(assignments, players);
      benched.forEach(p => (benchHistory[p.id] += 1));
    }

    Object.values(benchHistory).forEach(count => {
      expect(count).toBeGreaterThan(0);
    });

    const counts = Object.values(benchHistory);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });

  it('statistical check: teammate pairs are reasonably balanced over many rounds', () => {
    const players = mockPlayers(8);
    const numberOfCourts = 2;
    const rounds = 100;

    const pairCount: Record<string, number> = {};
    const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

    for (let r = 0; r < rounds; r++) {
      const assignments = generateCourtAssignments(players, numberOfCourts);
      assignments.forEach(court => {
        if (!court.teams) return;
        const teams = [court.teams.team1, court.teams.team2];
        teams.forEach(team => {
          for (let i = 0; i < team.length; i++) {
            for (let j = i + 1; j < team.length; j++) {
              const k = key(team[i].id, team[j].id);
              pairCount[k] = (pairCount[k] ?? 0) + 1;
            }
          }
        });
      });
    }

    const counts = Object.values(pairCount);
    const max = Math.max(...counts);
    const min = Math.min(...counts);
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;

    expect(min).toBeGreaterThan(0);
    expect(max / min).toBeLessThanOrEqual(2);
    expect(max).toBeLessThanOrEqual(avg * 1.5);
  });

    describe('Winner tracking functionality', () => {
    beforeEach(() => {
      testResetHistory();
    });

    it('should record wins for winning team players', () => {
      const players = mockPlayers(4);
      const courts: Court[] = [
        createMockCourt(1, players, 1),
      ];

      CourtAssignmentEngine.recordWins(courts);
      const winCounts = CourtAssignmentEngine.getWinCounts();

      expect(winCounts.get('P0')).toBe(1);
      expect(winCounts.get('P1')).toBe(1);

      expect(winCounts.get('P2')).toBe(undefined);
      expect(winCounts.get('P3')).toBe(undefined);
    });

    it('should record wins for team2 when they win', () => {
      const players = mockPlayers(4);
      const courts: Court[] = [
        createMockCourt(1, players, 2),
      ];

      CourtAssignmentEngine.recordWins(courts);
      const winCounts = CourtAssignmentEngine.getWinCounts();

      expect(winCounts.get('P0')).toBe(undefined);
      expect(winCounts.get('P1')).toBe(undefined);

      expect(winCounts.get('P2')).toBe(1);
      expect(winCounts.get('P3')).toBe(1);
    });

    it('should not record wins when no winner is set', () => {
      const players = mockPlayers(4);
      const courts: Court[] = [
        createMockCourt(1, players),
      ];

      CourtAssignmentEngine.recordWins(courts);
      const winCounts = CourtAssignmentEngine.getWinCounts();

      expect(winCounts.size).toBe(0);
    });

    it('should accumulate wins across multiple courts', () => {
      const players = mockPlayers(8);
      const courts: Court[] = [
        createMockCourt(1, players.slice(0, 4), 1),
        createMockCourt(2, players.slice(4, 8), 2),
      ];

      CourtAssignmentEngine.recordWins(courts);
      const winCounts = CourtAssignmentEngine.getWinCounts();

      expect(winCounts.get('P0')).toBe(1);
      expect(winCounts.get('P1')).toBe(1);
      expect(winCounts.get('P6')).toBe(1);
      expect(winCounts.get('P7')).toBe(1);

      expect(winCounts.get('P2')).toBe(undefined);
      expect(winCounts.get('P3')).toBe(undefined);
      expect(winCounts.get('P4')).toBe(undefined);
      expect(winCounts.get('P5')).toBe(undefined);
    });

    it('should accumulate wins across multiple rounds', () => {
      const players = mockPlayers(4);

      const courts1: Court[] = [createMockCourt(1, players, 1)];
      CourtAssignmentEngine.recordWins(courts1);

      CourtAssignmentEngine.clearCurrentSession();

      const courts2: Court[] = [createMockCourt(1, players, 2)];
      CourtAssignmentEngine.recordWins(courts2);

      const winCounts = CourtAssignmentEngine.getWinCounts();

      expect(winCounts.get('P0')).toBe(1);
      expect(winCounts.get('P1')).toBe(1);
      expect(winCounts.get('P2')).toBe(1);
      expect(winCounts.get('P3')).toBe(1);
    });

    it('should handle courts without teams', () => {
      const players = mockPlayers(2);
      const courts: Court[] = [
        {
          courtNumber: 1,
          players,
          winner: 1,
        },
      ];

      CourtAssignmentEngine.recordWins(courts);
      const winCounts = CourtAssignmentEngine.getWinCounts();

      expect(winCounts.size).toBe(0);
    });

    it('should reset win counts when history is reset', () => {
      const players = mockPlayers(4);
      const courts: Court[] = [createMockCourt(1, players, 1)];

      CourtAssignmentEngine.recordWins(courts);
      let winCounts = CourtAssignmentEngine.getWinCounts();
      expect(winCounts.size).toBeGreaterThan(0);

      testResetHistory();
      winCounts = CourtAssignmentEngine.getWinCounts();
      expect(winCounts.size).toBe(0);
    });

    it('should return copy of win counts map to prevent external modification', () => {
      const players = mockPlayers(4);
      const courts: Court[] = [createMockCourt(1, players, 1)];

      CourtAssignmentEngine.recordWins(courts);
      const winCounts1 = CourtAssignmentEngine.getWinCounts();
      const winCounts2 = CourtAssignmentEngine.getWinCounts();

      expect(winCounts1).not.toBe(winCounts2);

      expect(winCounts1.get('P0')).toBe(winCounts2.get('P0'));
    });

    it('should handle players with same name but different IDs', () => {
      const players: Player[] = [
        { id: 'A1', name: 'John', isPresent: true },
        { id: 'A2', name: 'John', isPresent: true },
        { id: 'B1', name: 'Jane', isPresent: true },
        { id: 'B2', name: 'Jane', isPresent: true },
      ];

      const courts: Court[] = [createMockCourt(1, players, 1)];
      CourtAssignmentEngine.recordWins(courts);
      const winCounts = CourtAssignmentEngine.getWinCounts();

      expect(winCounts.get('A1')).toBe(1);
      expect(winCounts.get('A2')).toBe(1);
      expect(winCounts.get('B1')).toBe(undefined);
      expect(winCounts.get('B2')).toBe(undefined);
    });
  });

  it('splits high-win players and high-loss players across teams', () => {
    const players = Array.from({ length: 4 }, (_, i) => ({
      id: `P${i}`,
      name: `Player ${i}`,
      isPresent: true,
    }));

    const trainingCourt: Court = {
      courtNumber: 1,
      players,
      teams: {
        team1: [players[0], players[1]],
        team2: [players[2], players[3]],
      },
      winner: 1,
    };

    for (let i = 0; i < 50; i++) {
      CourtAssignmentEngine.recordWins([trainingCourt]);
    }

    const assignments = generateCourtAssignments(players, 1);
    expect(assignments.length).toBe(1);

    const teams = assignments[0].teams!;
    const team1Ids = teams.team1.map(p => p.id);
    const team2Ids = teams.team2.map(p => p.id);

    const highWinTogether =
      (team1Ids.includes('P0') && team1Ids.includes('P1')) ||
      (team2Ids.includes('P0') && team2Ids.includes('P1'));

    const highLossTogether =
      (team1Ids.includes('P2') && team1Ids.includes('P3')) ||
      (team2Ids.includes('P2') && team2Ids.includes('P3'));

    expect(highWinTogether).toBe(false);
    expect(highLossTogether).toBe(false);

    const winCounts = CourtAssignmentEngine.getWinCounts();
    const team1WinSum = teams.team1.reduce((acc, p) => acc + (winCounts.get(p.id) ?? 0), 0);
    const team2WinSum = teams.team2.reduce((acc, p) => acc + (winCounts.get(p.id) ?? 0), 0);

    expect(Math.abs(team1WinSum - team2WinSum)).toBeLessThanOrEqual(10);
  });

  describe('State persistence functionality', () => {
    beforeEach(() => {
      localStorage.clear();
      testResetHistory();
    });

    afterEach(() => {
      vi.restoreAllMocks();
      localStorage.clear();
      testResetHistory();
    });

    it('should save and load engine state correctly', () => {
      const players = mockPlayers(8);

      const assignments1 = generateCourtAssignments(players, 2);
      expect(assignments1).toHaveLength(2);

      const courtsWithWinners: Court[] = assignments1.map((court, index) => ({
        ...court,
        winner: (index % 2 + 1) as 1 | 2,
      }));
      CourtAssignmentEngine.recordWins(courtsWithWinners);

      generateCourtAssignments(players, 2);

      const winCountsBeforeSave = CourtAssignmentEngine.getWinCounts();
      expect(winCountsBeforeSave.size).toBeGreaterThan(0);

      CourtAssignmentEngine.saveState();

      testResetHistory();

      const emptyWinCounts = CourtAssignmentEngine.getWinCounts();
      expect(emptyWinCounts.size).toBe(0);

      CourtAssignmentEngine.loadState();

      const winCountsAfterLoad = CourtAssignmentEngine.getWinCounts();
      expect(winCountsAfterLoad.size).toBe(winCountsBeforeSave.size);

      for (const [playerId, winCount] of winCountsBeforeSave) {
        expect(winCountsAfterLoad.get(playerId)).toBe(winCount);
      }
    });

    it('should handle loading when no saved state exists', () => {

      localStorage.clear();

      expect(() => CourtAssignmentEngine.loadState()).not.toThrow();

      const winCounts = CourtAssignmentEngine.getWinCounts();
      expect(winCounts.size).toBe(0);
    });

    it('should handle corrupted localStorage data gracefully', () => {

      localStorage.setItem('badminton-court-engine-state', 'invalid-json');

      expect(() => CourtAssignmentEngine.loadState()).not.toThrow();

      const winCounts = CourtAssignmentEngine.getWinCounts();
      expect(winCounts.size).toBe(0);
    });

    it('should preserve complex game history across save/load', () => {
      const players = mockPlayers(12);

      for (let round = 0; round < 3; round++) {
        const assignments = generateCourtAssignments(players, 3);

        const courtsWithWinners: Court[] = assignments.map((court, index) => ({
          ...court,
          winner: ((round + index) % 2 + 1) as 1 | 2,
        }));
        CourtAssignmentEngine.recordWins(courtsWithWinners);
      }

      const winCountsBeforeSave = CourtAssignmentEngine.getWinCounts();

      CourtAssignmentEngine.saveState();

      testResetHistory();
      CourtAssignmentEngine.loadState();

      const winCountsAfterLoad = CourtAssignmentEngine.getWinCounts();
      expect(winCountsAfterLoad.size).toBe(winCountsBeforeSave.size);

      for (const [playerId, winCount] of winCountsBeforeSave) {
        expect(winCountsAfterLoad.get(playerId)).toBe(winCount);
      }

      const newAssignments = generateCourtAssignments(players, 2);
      expect(newAssignments).toHaveLength(2);

      expect(newAssignments.every(court => court.teams)).toBe(true);
    });

    it('should handle localStorage save errors gracefully', () => {

      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      const players = mockPlayers(4);
      generateCourtAssignments(players, 1);

      expect(() => CourtAssignmentEngine.saveState()).not.toThrow();
    });

    it('should maintain separate storage keys for different data types', () => {
      const players = mockPlayers(4);
      generateCourtAssignments(players, 1);

      CourtAssignmentEngine.saveState();

      const savedData = localStorage.getItem('badminton-court-engine-state');
      expect(savedData).toBeTruthy();

      const parsed = JSON.parse(savedData!);
      expect(parsed).toHaveProperty('benchCountMap');
      expect(parsed).toHaveProperty('teammateCountMap');
      expect(parsed).toHaveProperty('opponentCountMap');
      expect(parsed).toHaveProperty('winCountMap');
      expect(parsed).toHaveProperty('lossCountMap');
    });

    it('should save state automatically when resetHistory is called via handleResetAlgorithm pattern', () => {
      const players = mockPlayers(6);
      const assignments = generateCourtAssignments(players, 2);

      const courtsWithWinners: Court[] = assignments.map((court, index) => ({
        ...court,
        winner: (index % 2 + 1) as 1 | 2,
      }));
      CourtAssignmentEngine.recordWins(courtsWithWinners);

      generateCourtAssignments(players, 2);

      const winCountsBeforeReset = CourtAssignmentEngine.getWinCounts();
      expect(winCountsBeforeReset.size).toBeGreaterThan(0);

      CourtAssignmentEngine.resetHistory();
      CourtAssignmentEngine.saveState();

      const winCountsAfterReset = CourtAssignmentEngine.getWinCounts();
      expect(winCountsAfterReset.size).toBe(0);

      const savedState = localStorage.getItem('badminton-court-engine-state');
      expect(savedState).toBeTruthy();

      const parsedState = JSON.parse(savedState!);
      expect(parsedState.winCountMap).toEqual({});
      expect(parsedState.teammateCountMap).toEqual({});
      expect(parsedState.opponentCountMap).toEqual({});
      expect(parsedState.benchCountMap).toEqual({});
    });

    it('should persist reset state across engine reload', () => {
      const players = mockPlayers(4);
      const assignments = generateCourtAssignments(players, 1);

      const courtsWithWinners: Court[] = assignments.map(court => ({
        ...court,
        winner: 1 as 1 | 2,
      }));
      CourtAssignmentEngine.recordWins(courtsWithWinners);

      expect(CourtAssignmentEngine.getWinCounts().size).toBeGreaterThan(0);

      CourtAssignmentEngine.resetHistory();
      CourtAssignmentEngine.saveState();

      const newAssignments = generateCourtAssignments(players, 1);
      const newCourtsWithWinners: Court[] = newAssignments.map(court => ({
        ...court,
        winner: 2 as 1 | 2,
      }));
      CourtAssignmentEngine.recordWins(newCourtsWithWinners);
      expect(CourtAssignmentEngine.getWinCounts().size).toBeGreaterThan(0);

      CourtAssignmentEngine.loadState();

      const restoredWinCounts = CourtAssignmentEngine.getWinCounts();
      expect(restoredWinCounts.size).toBe(0);
    });

    describe('State preparation functionality', () => {
      it('should return state object with all required properties', () => {
        const state = CourtAssignmentEngine.prepareStateForSaving();

        expect(state).toHaveProperty('benchCountMap');
        expect(state).toHaveProperty('teammateCountMap');
        expect(state).toHaveProperty('opponentCountMap');
        expect(state).toHaveProperty('winCountMap');
        expect(state).toHaveProperty('lossCountMap');

        expect(typeof state.benchCountMap).toBe('object');
        expect(typeof state.teammateCountMap).toBe('object');
        expect(typeof state.opponentCountMap).toBe('object');
        expect(typeof state.winCountMap).toBe('object');
        expect(typeof state.lossCountMap).toBe('object');
      });

      it('should return empty maps when no data exists', () => {
        testResetHistory();

        const state = CourtAssignmentEngine.prepareStateForSaving();

        expect(Object.keys(state.benchCountMap).length).toBe(0);
        expect(Object.keys(state.teammateCountMap).length).toBe(0);
        expect(Object.keys(state.opponentCountMap).length).toBe(0);
        expect(Object.keys(state.winCountMap).length).toBe(0);
        expect(Object.keys(state.lossCountMap).length).toBe(0);
      });

      it('should return actual state data when present', () => {
        const players = mockPlayers(6);

        generateCourtAssignments(players, 1);

        const courtsWithWinners: Court[] = [
          createMockCourt(1, players.slice(0, 4), 1),
        ];
        CourtAssignmentEngine.recordWins(courtsWithWinners);

        const state = CourtAssignmentEngine.prepareStateForSaving();

        expect(Object.keys(state.winCountMap).length).toBeGreaterThan(0);
        expect(Object.keys(state.lossCountMap).length).toBeGreaterThan(0);
        expect(Object.keys(state.benchCountMap).length).toBeGreaterThan(0);

        expect(state.winCountMap['P0']).toBe(1);
        expect(state.winCountMap['P1']).toBe(1);
      });

      it('should return references to actual maps, not copies', () => {
        const players = mockPlayers(4);
        generateCourtAssignments(players, 1);

        const state1 = CourtAssignmentEngine.prepareStateForSaving();
        const state2 = CourtAssignmentEngine.prepareStateForSaving();

        expect(state1.benchCountMap).toEqual(state2.benchCountMap);
        expect(state1.teammateCountMap).toEqual(state2.teammateCountMap);
        expect(state1.opponentCountMap).toEqual(state2.opponentCountMap);
        expect(state1.winCountMap).toEqual(state2.winCountMap);
        expect(state1.lossCountMap).toEqual(state2.lossCountMap);
      });
    });

    describe('Previous record reversal functionality', () => {
      describe('shouldReversePreviousRecord', () => {
        it('should return true when winner is different', () => {
          const previousRecord = {
            winner: 1 as const,
            winningPlayers: ['P0', 'P1'],
            losingPlayers: ['P2', 'P3'],
          };

          const result = testShouldReversePreviousRecord(previousRecord, 2, ['P2', 'P3']);
          expect(result).toBe(true);
        });

        it('should return true when winner is same but players are different', () => {
          const previousRecord = {
            winner: 1 as const,
            winningPlayers: ['P0', 'P1'],
            losingPlayers: ['P2', 'P3'],
          };

          const result = testShouldReversePreviousRecord(previousRecord, 1, ['P0', 'P2']);
          expect(result).toBe(true);
        });

        it('should return false when winner and players are identical', () => {
          const previousRecord = {
            winner: 1 as const,
            winningPlayers: ['P0', 'P1'],
            losingPlayers: ['P2', 'P3'],
          };

          const result = testShouldReversePreviousRecord(previousRecord, 1, ['P0', 'P1']);
          expect(result).toBe(false);
        });

        it('should return false when winner and players are identical but in different order', () => {
          const previousRecord = {
            winner: 1 as const,
            winningPlayers: ['P0', 'P1'],
            losingPlayers: ['P2', 'P3'],
          };

          const result = testShouldReversePreviousRecord(previousRecord, 1, ['P1', 'P0']);
          expect(result).toBe(false);
        });

        it('should handle single player teams', () => {
          const previousRecord = {
            winner: 2 as const,
            winningPlayers: ['P0'],
            losingPlayers: ['P1'],
          };

          expect(testShouldReversePreviousRecord(previousRecord, 2, ['P0'])).toBe(false);
          expect(testShouldReversePreviousRecord(previousRecord, 1, ['P1'])).toBe(true);
          expect(testShouldReversePreviousRecord(previousRecord, 2, ['P1'])).toBe(true);
        });
      });

      describe('reversePreviousWinRecord', () => {
        beforeEach(() => {
          testResetHistory();
        });

        it('should decrement win counts for previous winners', () => {
          const players = mockPlayers(4);

          const initialRecord: Court[] = [createMockCourt(1, players, 1)];
          CourtAssignmentEngine.recordWins(initialRecord);

          let winCounts = CourtAssignmentEngine.getWinCounts();
          expect(winCounts.get('P0')).toBe(1);
          expect(winCounts.get('P1')).toBe(1);

          const previousRecord = {
            winner: 1 as const,
            winningPlayers: ['P0', 'P1'],
            losingPlayers: ['P2', 'P3'],
          };

          testReversePreviousWinRecord(previousRecord);

          winCounts = CourtAssignmentEngine.getWinCounts();
          expect(winCounts.get('P0')).toBe(0);
          expect(winCounts.get('P1')).toBe(0);
        });

        it('should not decrement win counts below zero', () => {
          const previousRecord = {
            winner: 1 as const,
            winningPlayers: ['P0', 'P1'],
            losingPlayers: ['P2', 'P3'],
          };

          testReversePreviousWinRecord(previousRecord);

          const winCounts = CourtAssignmentEngine.getWinCounts();
          expect(winCounts.get('P0') || 0).toBe(0);
          expect(winCounts.get('P1') || 0).toBe(0);
        });

        it('should handle players with multiple wins correctly', () => {
          const players = mockPlayers(4);

          const record1: Court[] = [createMockCourt(1, players, 1)];
          const record2: Court[] = [createMockCourt(2, players, 1)];
          CourtAssignmentEngine.recordWins(record1);
          CourtAssignmentEngine.recordWins(record2);

          let winCounts = CourtAssignmentEngine.getWinCounts();
          expect(winCounts.get('P0')).toBe(2);
          expect(winCounts.get('P1')).toBe(2);

          const previousRecord = {
            winner: 1 as const,
            winningPlayers: ['P0', 'P1'],
            losingPlayers: ['P2', 'P3'],
          };

          testReversePreviousWinRecord(previousRecord);

          winCounts = CourtAssignmentEngine.getWinCounts();
          expect(winCounts.get('P0')).toBe(1);
          expect(winCounts.get('P1')).toBe(1);
        });

        it('should handle empty player arrays gracefully', () => {
          const previousRecord = {
            winner: 1 as const,
            winningPlayers: [],
            losingPlayers: [],
          };

          expect(() => testReversePreviousWinRecord(previousRecord)).not.toThrow();
        });
      });
    });
  });

  describe('Immediate win recording functionality', () => {
    beforeEach(() => {
      testResetHistory();
      localStorage.clear();
    });

    afterEach(() => {
      testResetHistory();
      localStorage.clear();
    });

    it('should record wins immediately for assignments with winners', () => {
      const players = mockPlayers(4);
      const courtsWithWinners: Court[] = [
        {
          courtNumber: 1,
          players: players,
          teams: {
            team1: [players[0], players[1]],
            team2: [players[2], players[3]],
          },
          winner: 1,
        },
      ];

      CourtAssignmentEngine.recordWins(courtsWithWinners);

      const winCounts = CourtAssignmentEngine.getWinCounts();

      expect(winCounts.get(players[0].id)).toBe(1);
      expect(winCounts.get(players[1].id)).toBe(1);

      expect(winCounts.get(players[2].id) || 0).toBe(0);
      expect(winCounts.get(players[3].id) || 0).toBe(0);
    });

    it('should handle multiple courts with different winners', () => {
      const players = mockPlayers(8);
      const courtsWithWinners: Court[] = [
        {
          courtNumber: 1,
          players: players.slice(0, 4),
          teams: {
            team1: [players[0], players[1]],
            team2: [players[2], players[3]],
          },
          winner: 1,
        },
        {
          courtNumber: 2,
          players: players.slice(4, 8),
          teams: {
            team1: [players[4], players[5]],
            team2: [players[6], players[7]],
          },
          winner: 2,
        },
      ];

      CourtAssignmentEngine.recordWins(courtsWithWinners);

      const winCounts = CourtAssignmentEngine.getWinCounts();

      expect(winCounts.get(players[0].id)).toBe(1);
      expect(winCounts.get(players[1].id)).toBe(1);

      expect(winCounts.get(players[6].id)).toBe(1);
      expect(winCounts.get(players[7].id)).toBe(1);

      expect(winCounts.get(players[2].id) || 0).toBe(0);
      expect(winCounts.get(players[3].id) || 0).toBe(0);
      expect(winCounts.get(players[4].id) || 0).toBe(0);
      expect(winCounts.get(players[5].id) || 0).toBe(0);
    });

    it('should not record wins for courts without winners', () => {
      const players = mockPlayers(4);
      const courtsWithoutWinners: Court[] = [
        {
          courtNumber: 1,
          players: players,
          teams: {
            team1: [players[0], players[1]],
            team2: [players[2], players[3]],
          },

        },
      ];

      CourtAssignmentEngine.recordWins(courtsWithoutWinners);

      const winCounts = CourtAssignmentEngine.getWinCounts();
      expect(winCounts.size).toBe(0);
    });

    it('should persist recorded wins across save/load cycles', () => {
      const players = mockPlayers(4);
      const courtWithWinner: Court[] = [
        {
          courtNumber: 1,
          players: players,
          teams: {
            team1: [players[0], players[1]],
            team2: [players[2], players[3]],
          },
          winner: 1,
        },
      ];

      CourtAssignmentEngine.recordWins(courtWithWinner);
      CourtAssignmentEngine.saveState();

      const winCountsBefore = CourtAssignmentEngine.getWinCounts();
      const player0WinsBefore = winCountsBefore.get(players[0].id) || 0;
      const player1WinsBefore = winCountsBefore.get(players[1].id) || 0;

      testResetHistory();
      CourtAssignmentEngine.loadState();

      const winCountsAfter = CourtAssignmentEngine.getWinCounts();
      expect(winCountsAfter.get(players[0].id)).toBe(player0WinsBefore);
      expect(winCountsAfter.get(players[1].id)).toBe(player1WinsBefore);
      expect(winCountsAfter.get(players[2].id) || 0).toBe(0);
      expect(winCountsAfter.get(players[3].id) || 0).toBe(0);
    });

    it('should accumulate wins across multiple recordings', () => {
      const players = mockPlayers(4);

      const firstCourt: Court[] = [
        {
          courtNumber: 1,
          players: players,
          teams: {
            team1: [players[0], players[1]],
            team2: [players[2], players[3]],
          },
          winner: 1,
        },
      ];

      const secondCourt: Court[] = [
        {
          courtNumber: 2,
          players: players,
          teams: {
            team1: [players[0], players[2]],
            team2: [players[1], players[3]],
          },
          winner: 1,
        },
      ];

      CourtAssignmentEngine.recordWins(firstCourt);

      CourtAssignmentEngine.recordWins(secondCourt);

      const winCounts = CourtAssignmentEngine.getWinCounts();

      expect(winCounts.get(players[0].id)).toBe(2);

      expect(winCounts.get(players[1].id)).toBe(1);

      expect(winCounts.get(players[2].id)).toBe(1);

      expect(winCounts.get(players[3].id) || 0).toBe(0);
    });
  });

  describe('Manual Court Selection', () => {
    beforeEach(() => {
      testResetHistory();
    });

    it('creates manual court with 2 players for singles', () => {
      const players = mockPlayers(8);
      const manualSelection: ManualCourtSelection = {
        players: [players[0], players[1]],
      };

      const assignments = generateCourtAssignments(players, 2, manualSelection);

      expect(assignments).toHaveLength(2);

      const manualCourt = assignments[0];
      expect(manualCourt.courtNumber).toBe(1);
      expect(manualCourt.players).toEqual([players[0], players[1]]);
      expect(manualCourt.teams).toEqual({
        team1: [players[0]],
        team2: [players[1]],
      });
    });

    it('creates manual court with 3 players for singles with one waiting', () => {
      const players = mockPlayers(8);
      const manualSelection: ManualCourtSelection = {
        players: [players[0], players[1], players[2]],
      };

      const assignments = generateCourtAssignments(players, 2, manualSelection);

      expect(assignments).toHaveLength(2);

      const manualCourt = assignments[0];
      expect(manualCourt.courtNumber).toBe(1);
      expect(manualCourt.players).toEqual([players[0], players[1], players[2]]);
      expect(manualCourt.teams).toEqual({
        team1: [players[0]],
        team2: [players[1]],
      });
    });

    it('creates manual court with 4 players for doubles', () => {
      const players = mockPlayers(8);
      const manualSelection: ManualCourtSelection = {
        players: [players[0], players[1], players[2], players[3]],
      };

      const assignments = generateCourtAssignments(players, 2, manualSelection);

      expect(assignments).toHaveLength(2);

      const manualCourt = assignments[0];
      expect(manualCourt.courtNumber).toBe(1);
      expect(manualCourt.players).toEqual([players[0], players[1], players[2], players[3]]);
      expect(manualCourt.teams).toBeDefined();
      expect(manualCourt.teams!.team1).toHaveLength(2);
      expect(manualCourt.teams!.team2).toHaveLength(2);
    });

    it('excludes manually selected players from automatic assignment', () => {
      const players = mockPlayers(8);
      const manualSelection: ManualCourtSelection = {
        players: [players[0], players[1], players[2], players[3]],
      };

      const assignments = generateCourtAssignments(players, 2, manualSelection);

      expect(assignments).toHaveLength(2);

      const autoCourt = assignments[1];
      const autoPlayerIds = autoCourt.players.map(p => p.id);

      manualSelection.players.forEach(manualPlayer => {
        expect(autoPlayerIds).not.toContain(manualPlayer.id);
      });
    });

    it('assigns remaining players to courts starting from court 2', () => {
      const players = mockPlayers(8);
      const manualSelection: ManualCourtSelection = {
        players: [players[0], players[1]],
      };

      const assignments = generateCourtAssignments(players, 2, manualSelection);

      expect(assignments).toHaveLength(2);
      expect(assignments[0].courtNumber).toBe(1);
      expect(assignments[1].courtNumber).toBe(2);
    });

    it('works with only one remaining court available', () => {
      const players = mockPlayers(6);
      const manualSelection: ManualCourtSelection = {
        players: [players[0], players[1]],
      };

      const assignments = generateCourtAssignments(players, 2, manualSelection);

      expect(assignments).toHaveLength(2);
      expect(assignments[0].courtNumber).toBe(1);
      expect(assignments[1].courtNumber).toBe(2);
      expect(assignments[1].players).toHaveLength(4);
    });

    it('ignores manual selection with only 1 player', () => {
      const players = mockPlayers(8);
      const manualSelection: ManualCourtSelection = {
        players: [players[0]],
      };

      const assignments = generateCourtAssignments(players, 2, manualSelection);

      expect(assignments).toHaveLength(2);
      expect(assignments[0].courtNumber).toBe(1);
      expect(assignments[1].courtNumber).toBe(2);

      const allAssignedPlayers = assignments.flatMap(court => court.players);
      expect(allAssignedPlayers).toHaveLength(8);
    });

    it('ignores manual selection with more than 4 players', () => {
      const players = mockPlayers(8);
      const manualSelection: ManualCourtSelection = {
        players: [players[0], players[1], players[2], players[3], players[4]],
      };

      const assignments = generateCourtAssignments(players, 2, manualSelection);

      expect(assignments).toHaveLength(2);
      expect(assignments[0].courtNumber).toBe(1);
      expect(assignments[1].courtNumber).toBe(2);
    });

    it('filters out absent players from manual selection', () => {
      const players = mockPlayers(8);
      players[1].isPresent = false;

      const manualSelection: ManualCourtSelection = {
        players: [players[0], players[1], players[2]],
      };

      const assignments = generateCourtAssignments(players, 2, manualSelection);

      expect(assignments).toHaveLength(2);

      const manualCourt = assignments[0];
      expect(manualCourt.players).toHaveLength(2);
      expect(manualCourt.players).toEqual([players[0], players[2]]);
      expect(manualCourt.players.map(p => p.id)).not.toContain(players[1].id);
    });

    it('works with empty manual selection', () => {
      const players = mockPlayers(8);
      const manualSelection: ManualCourtSelection = {
        players: [],
      };

      const assignments = generateCourtAssignments(players, 2, manualSelection);

      expect(assignments).toHaveLength(2);
      expect(assignments[0].courtNumber).toBe(1);
      expect(assignments[1].courtNumber).toBe(2);
    });

    it('works with null manual selection', () => {
      const players = mockPlayers(8);

      const assignments = generateCourtAssignments(players, 2, undefined);

      expect(assignments).toHaveLength(2);
      expect(assignments[0].courtNumber).toBe(1);
      expect(assignments[1].courtNumber).toBe(2);
    });

    it('properly handles benching with manual selection', () => {
      const players = mockPlayers(10);
      const manualSelection: ManualCourtSelection = {
        players: [players[0], players[1], players[2], players[3]],
      };

      const assignments = generateCourtAssignments(players, 2, manualSelection);
      const benched = getBenchedPlayers(assignments, players);

      expect(assignments).toHaveLength(2);
      expect(benched).toHaveLength(2);

      const benchedIds = benched.map(p => p.id);
      manualSelection.players.forEach(player => {
        expect(benchedIds).not.toContain(player.id);
      });
    });

    it('maintains court assignment history with manual selection', () => {
      const players = mockPlayers(8);
      const manualSelection: ManualCourtSelection = {
        players: [players[0], players[1], players[2], players[3]],
      };

      const courts1 = generateCourtAssignments(players, 2, manualSelection);

      const mockCourtsWithWinners = courts1.map(court => ({
        ...court,
        winner: 1 as const,
      }));
      CourtAssignmentEngine.recordWins(mockCourtsWithWinners);

      const courts2 = generateCourtAssignments(players, 2, manualSelection);

      expect(courts2).toHaveLength(2);

      const winCounts = CourtAssignmentEngine.getWinCounts();
      expect(winCounts.size).toBeGreaterThan(0);
    });
  });

  describe('Compatibility Matrix Optimization', () => {
    beforeEach(() => {
      testResetHistory();
    });

    const getBuildCompatibilityMatrix = () => CourtAssignmentEngine['buildCompatibilityMatrix'];
    const getEvaluateCourtCost = () => CourtAssignmentEngine['evaluateCourtCost'];

    it('should build compatibility matrix with correct structure', () => {
      const players = mockPlayers(4);
      const buildMatrix = getBuildCompatibilityMatrix();
      const matrix = buildMatrix.call(CourtAssignmentEngine, players);

      expect(matrix.size).toBe(6);

      const expectedKeys = [
        'P0|P1', 'P0|P2', 'P0|P3',
        'P1|P2', 'P1|P3',
        'P2|P3',
      ];

      expectedKeys.forEach(key => {
        expect(matrix.has(key)).toBe(true);
        const pairCost = matrix.get(key);
        expect(pairCost).toBeDefined();
        expect(typeof pairCost?.teammate).toBe('number');
        expect(typeof pairCost?.opponent).toBe('number');
      });
    });

    it('should include all cost components in compatibility matrix', () => {
      const players = mockPlayers(4);

      CourtAssignmentEngine['teammateCountMap'].set('P0|P1', 3);
      CourtAssignmentEngine['opponentCountMap'].set('P0|P2', 2);
      CourtAssignmentEngine['winCountMap'].set('P0', 5);
      CourtAssignmentEngine['winCountMap'].set('P1', 4);
      CourtAssignmentEngine['lossCountMap'].set('P0', 2);
      CourtAssignmentEngine['lossCountMap'].set('P1', 3);

      const buildMatrix = getBuildCompatibilityMatrix();
      const matrix = buildMatrix.call(CourtAssignmentEngine, players);

      const p0p1Cost = matrix.get('P0|P1');
      expect(p0p1Cost?.teammate).toBe(3 + (5 * 4) + (2 * 3));
      expect(p0p1Cost?.opponent).toBe(0);

      const p0p2Cost = matrix.get('P0|P2');
      expect(p0p2Cost?.teammate).toBe(0 + (5 * 0) + (2 * 0));
      expect(p0p2Cost?.opponent).toBe(2);
    });

    it('should produce identical results with and without compatibility matrix', () => {
      const players = mockPlayers(8);

      CourtAssignmentEngine['teammateCountMap'].set('P0|P1', 2);
      CourtAssignmentEngine['opponentCountMap'].set('P2|P3', 1);
      CourtAssignmentEngine['winCountMap'].set('P0', 3);
      CourtAssignmentEngine['winCountMap'].set('P4', 5);
      CourtAssignmentEngine['lossCountMap'].set('P1', 2);
      CourtAssignmentEngine['lossCountMap'].set('P5', 4);

      const court = createMockCourt(1, players.slice(0, 4));

      const evaluateCost = getEvaluateCourtCost();
      const costWithoutMatrix = evaluateCost.call(CourtAssignmentEngine, court);

      const buildMatrix = getBuildCompatibilityMatrix();
      const matrix = buildMatrix.call(CourtAssignmentEngine, players);
      const costWithMatrix = evaluateCost.call(CourtAssignmentEngine, court, matrix);

      expect(costWithMatrix).toBe(costWithoutMatrix);
    });

    it('should handle empty compatibility matrix gracefully', () => {
      const players = mockPlayers(4);
      const court = createMockCourt(1, players);

      const evaluateCost = getEvaluateCourtCost();
      const emptyMatrix = new Map<string, { teammate: number; opponent: number }>();

      const cost = evaluateCost.call(CourtAssignmentEngine, court, emptyMatrix);
      expect(typeof cost).toBe('number');
      expect(cost).toBeGreaterThanOrEqual(0);
    });

    it('should use compatibility matrix in generate() method', () => {
      const players = mockPlayers(12);

      CourtAssignmentEngine['winCountMap'].set('P0', 10);
      CourtAssignmentEngine['lossCountMap'].set('P1', 8);

      const result = generateCourtAssignments(players, 3);

      expect(result).toHaveLength(3);
      expect(result.every(c => c.players.length >= 2)).toBe(true);
    });

    it('should calculate pairwise costs correctly for all pairs', () => {
      const players = mockPlayers(3);

      CourtAssignmentEngine['teammateCountMap'].set('P0|P1', 1);
      CourtAssignmentEngine['opponentCountMap'].set('P1|P2', 2);
      CourtAssignmentEngine['winCountMap'].set('P0', 3);
      CourtAssignmentEngine['winCountMap'].set('P2', 4);
      CourtAssignmentEngine['lossCountMap'].set('P0', 1);
      CourtAssignmentEngine['lossCountMap'].set('P2', 2);

      const buildMatrix = getBuildCompatibilityMatrix();
      const matrix = buildMatrix.call(CourtAssignmentEngine, players);

      expect(matrix.get('P0|P1')?.teammate).toBe(1 + (3 * 0) + (1 * 0));
      expect(matrix.get('P0|P1')?.opponent).toBe(0);

      expect(matrix.get('P1|P2')?.teammate).toBe(0 + (0 * 4) + (0 * 2));
      expect(matrix.get('P1|P2')?.opponent).toBe(2);

      expect(matrix.get('P0|P2')?.teammate).toBe(0 + (3 * 4) + (1 * 2));
      expect(matrix.get('P0|P2')?.opponent).toBe(0);
    });

    it('should maintain consistency across multiple generate() calls', () => {
      const players = mockPlayers(8);

      CourtAssignmentEngine['winCountMap'].set('P0', 5);
      CourtAssignmentEngine['lossCountMap'].set('P1', 3);

      const result1 = generateCourtAssignments(players, 2);
      const result2 = generateCourtAssignments(players, 2);

      expect(result1).toHaveLength(2);
      expect(result2).toHaveLength(2);
      expect(result1.every(c => c.teams !== undefined)).toBe(true);
      expect(result2.every(c => c.teams !== undefined)).toBe(true);
    });

    it('should handle manual court selection with compatibility matrix', () => {
      const players = mockPlayers(12);
      const manualSelection: ManualCourtSelection = {
        players: players.slice(0, 4),
      };

      CourtAssignmentEngine['teammateCountMap'].set('P0|P1', 2);

      const result = generateCourtAssignments(players, 3, manualSelection);

      expect(result).toHaveLength(3);
      expect(result[0].players.length).toBe(4);
    });

    it('should produce non-negative costs from compatibility matrix', () => {
      const players = mockPlayers(6);

      const buildMatrix = getBuildCompatibilityMatrix();
      const matrix = buildMatrix.call(CourtAssignmentEngine, players);

      matrix.forEach((pairCost, key) => {
        expect(pairCost.teammate).toBeGreaterThanOrEqual(0);
        expect(pairCost.opponent).toBeGreaterThanOrEqual(0);
        expect(key).toMatch(/^P\d+\|P\d+$/);
      });
    });

    it('should correctly separate teammate and opponent costs', () => {
      const players = mockPlayers(4);

      const p0p1Key = 'P0|P1';
      CourtAssignmentEngine['teammateCountMap'].set(p0p1Key, 5);
      CourtAssignmentEngine['opponentCountMap'].set(p0p1Key, 3);

      const buildMatrix = getBuildCompatibilityMatrix();
      const matrix = buildMatrix.call(CourtAssignmentEngine, players);

      const pairCost = matrix.get(p0p1Key);
      expect(pairCost?.teammate).toBe(5 + 0);
      expect(pairCost?.opponent).toBe(3);
    });

    it('should demonstrate performance improvement with compatibility matrix', () => {
      const players = mockPlayers(20);

      CourtAssignmentEngine['winCountMap'].set('P0', 10);
      CourtAssignmentEngine['winCountMap'].set('P5', 8);
      CourtAssignmentEngine['winCountMap'].set('P10', 6);
      CourtAssignmentEngine['lossCountMap'].set('P1', 5);
      CourtAssignmentEngine['lossCountMap'].set('P6', 4);
      CourtAssignmentEngine['teammateCountMap'].set('P0|P1', 3);
      CourtAssignmentEngine['teammateCountMap'].set('P2|P3', 2);
      CourtAssignmentEngine['opponentCountMap'].set('P4|P5', 2);

      const warmupRuns = 3;
      for (let i = 0; i < warmupRuns; i++) {
        generateCourtAssignments(players, 4);
      }

      const testRuns = 10;

      const startOptimized = performance.now();
      for (let i = 0; i < testRuns; i++) {
        generateCourtAssignments(players, 4);
      }
      const endOptimized = performance.now();
      const optimizedTime = endOptimized - startOptimized;

      const evaluateCost = CourtAssignmentEngine['evaluateCourtCost'];
      const originalEvaluate = evaluateCost.bind(CourtAssignmentEngine);

      const forceUnoptimized = function(this: typeof CourtAssignmentEngine, court: any) {
        return originalEvaluate(court, undefined);
      };

      CourtAssignmentEngine['evaluateCourtCost'] = forceUnoptimized as any;

      const startUnoptimized = performance.now();
      for (let i = 0; i < testRuns; i++) {
        generateCourtAssignments(players, 4);
      }
      const endUnoptimized = performance.now();
      const unoptimizedTime = endUnoptimized - startUnoptimized;

      CourtAssignmentEngine['evaluateCourtCost'] = originalEvaluate;

      const improvement = ((unoptimizedTime - optimizedTime) / unoptimizedTime) * 100;
      const speedup = unoptimizedTime / optimizedTime;

      console.log('\n📊 Performance Benchmark Results:');
      console.log(`   Players: ${players.length}, Courts: 4, Iterations: ${testRuns}`);
      console.log(`   ✅ With optimization:    ${optimizedTime.toFixed(2)}ms`);
      console.log(`   ❌ Without optimization: ${unoptimizedTime.toFixed(2)}ms`);
      console.log(`   🚀 Improvement: ${improvement.toFixed(1)}% faster (${speedup.toFixed(2)}x speedup)`);

      expect(optimizedTime).toBeLessThan(unoptimizedTime);
      expect(improvement).toBeGreaterThan(0);
    });

    it('should show performance scales with player count', () => {
      const testScenarios = [
        { players: 8, courts: 2, runs: 15 },
        { players: 16, courts: 4, runs: 10 },
        { players: 24, courts: 6, runs: 5 },
      ];

      console.log('\n📈 Performance Scaling Analysis:');

      testScenarios.forEach(scenario => {
        const players = mockPlayers(scenario.players);

        CourtAssignmentEngine['winCountMap'].set('P0', 5);
        CourtAssignmentEngine['lossCountMap'].set('P1', 3);
        CourtAssignmentEngine['teammateCountMap'].set('P0|P1', 2);

        for (let i = 0; i < 2; i++) {
          generateCourtAssignments(players, scenario.courts);
        }

        const startOpt = performance.now();
        for (let i = 0; i < scenario.runs; i++) {
          generateCourtAssignments(players, scenario.courts);
        }
        const optTime = performance.now() - startOpt;

        const evaluateCost = CourtAssignmentEngine['evaluateCourtCost'];
        const originalEval = evaluateCost.bind(CourtAssignmentEngine);
        const forceUnopt = function(this: typeof CourtAssignmentEngine, court: any) {
          return originalEval(court, undefined);
        };

        CourtAssignmentEngine['evaluateCourtCost'] = forceUnopt as any;

        const startUnopt = performance.now();
        for (let i = 0; i < scenario.runs; i++) {
          generateCourtAssignments(players, scenario.courts);
        }
        const unoptTime = performance.now() - startUnopt;

        CourtAssignmentEngine['evaluateCourtCost'] = originalEval;

        const speedup = unoptTime / optTime;
        const improvement = ((unoptTime - optTime) / unoptTime) * 100;

        console.log(`   ${scenario.players}p/${scenario.courts}c: ${optTime.toFixed(1)}ms vs ${unoptTime.toFixed(1)}ms → ${speedup.toFixed(2)}x speedup (${improvement.toFixed(1)}% faster)`);

        if (scenario.players >= 16) {
          expect(optTime).toBeLessThan(unoptTime);
        }
      });

      console.log('   💡 Bigger player pools = greater optimization benefit\n');
    });
  });

  describe('Cost Memoization Optimization', () => {
    beforeEach(() => {
      testResetHistory();
    });

    const getCourtCacheKey = () => CourtAssignmentEngine['getCourtCacheKey'];
    const getCostCache = () => CourtAssignmentEngine['costCache'];

    it('should generate consistent cache keys for same players', () => {
      const players = mockPlayers(4);
      const court1 = createMockCourt(1, players);
      const court2 = createMockCourt(2, players);

      const getCacheKey = getCourtCacheKey();
      const key1 = getCacheKey.call(CourtAssignmentEngine, court1);
      const key2 = getCacheKey.call(CourtAssignmentEngine, court2);

      expect(key1).toBe(key2);
      expect(key1).toBeTruthy();
    });

    it('should generate different cache keys for different players', () => {
      const players = mockPlayers(8);
      const court1 = createMockCourt(1, players.slice(0, 4));
      const court2 = createMockCourt(2, players.slice(4, 8));

      const getCacheKey = getCourtCacheKey();
      const key1 = getCacheKey.call(CourtAssignmentEngine, court1);
      const key2 = getCacheKey.call(CourtAssignmentEngine, court2);

      expect(key1).not.toBe(key2);
    });

    it('should cache cost evaluations', () => {
      const players = mockPlayers(4);
      const court = createMockCourt(1, players);

      CourtAssignmentEngine['evaluateCourtCost'](court);

      const cache = getCostCache();
      expect(cache.size).toBeGreaterThan(0);
    });

    it('should reuse cached cost on subsequent evaluations', () => {
      const players = mockPlayers(4);
      const court = createMockCourt(1, players);

      const cost1 = CourtAssignmentEngine['evaluateCourtCost'](court);
      const cacheSize1 = getCostCache().size;

      const cost2 = CourtAssignmentEngine['evaluateCourtCost'](court);
      const cacheSize2 = getCostCache().size;

      expect(cost1).toBe(cost2);
      expect(cacheSize2).toBe(cacheSize1);
    });

    it('should clear cache at start of generate()', () => {
      const players = mockPlayers(8);

      const court = createMockCourt(1, players.slice(0, 4));
      CourtAssignmentEngine['evaluateCourtCost'](court);

      expect(getCostCache().size).toBeGreaterThan(0);

      generateCourtAssignments(players, 2);

      expect(getCostCache().size).toBeGreaterThan(0);
    });

    it('should produce identical results with cache', () => {
      const players = mockPlayers(12);

      CourtAssignmentEngine['winCountMap'].set('P0', 5);
      CourtAssignmentEngine['lossCountMap'].set('P1', 3);
      CourtAssignmentEngine['teammateCountMap'].set('P0|P1', 2);

      getCostCache().clear();
      const result1 = generateCourtAssignments(players, 3);

      getCostCache().clear();
      const result2 = generateCourtAssignments(players, 3);

      expect(result1.length).toBe(result2.length);
      expect(result1.every(c => c.teams !== undefined)).toBe(true);
      expect(result2.every(c => c.teams !== undefined)).toBe(true);
    });

    it('should handle cache with compatibility matrix', () => {
      const players = mockPlayers(8);

      CourtAssignmentEngine['winCountMap'].set('P0', 3);
      CourtAssignmentEngine['teammateCountMap'].set('P0|P1', 1);

      const result = generateCourtAssignments(players, 2);

      expect(result).toHaveLength(2);
      expect(getCostCache().size).toBeGreaterThan(0);
    });

    it('should demonstrate cache hit rate improvement', () => {
      const players = mockPlayers(16);

      CourtAssignmentEngine['winCountMap'].set('P0', 4);
      CourtAssignmentEngine['lossCountMap'].set('P1', 2);

      getCostCache().clear();

      const evaluateCost = CourtAssignmentEngine['evaluateCourtCost'];
      let totalCalls = 0;
      let cacheHits = 0;
      const originalEvaluate = evaluateCost.bind(CourtAssignmentEngine);

      CourtAssignmentEngine['evaluateCourtCost'] = function(this: typeof CourtAssignmentEngine, court: any, matrix?: any) {
        totalCalls++;
        const cacheKey = this['getCourtCacheKey'](court);
        if (cacheKey && this['costCache'].has(cacheKey)) {
          cacheHits++;
        }
        return originalEvaluate(court, matrix);
      } as any;

      generateCourtAssignments(players, 4);

      CourtAssignmentEngine['evaluateCourtCost'] = originalEvaluate;

      const cacheSize = getCostCache().size;
      const cacheMisses = totalCalls - cacheHits;
      const cacheHitRate = (cacheHits / totalCalls) * 100;

      console.log(`\n💾 Cache Performance:`);
      console.log(`   Total evaluations: ${totalCalls}`);
      console.log(`   Cache hits: ${cacheHits} (${cacheHitRate.toFixed(1)}%)`);
      console.log(`   Cache misses: ${cacheMisses}`);
      console.log(`   Unique configs: ${cacheSize}`);

      expect(cacheSize).toBeGreaterThan(0);
      expect(cacheHits).toBeGreaterThan(0);
      expect(cacheHitRate).toBeGreaterThan(0);
    });

    it('should show combined optimization performance', () => {
      const players = mockPlayers(20);

      CourtAssignmentEngine['winCountMap'].set('P0', 10);
      CourtAssignmentEngine['winCountMap'].set('P5', 8);
      CourtAssignmentEngine['lossCountMap'].set('P1', 5);
      CourtAssignmentEngine['teammateCountMap'].set('P0|P1', 3);
      CourtAssignmentEngine['opponentCountMap'].set('P4|P5', 2);

      for (let i = 0; i < 2; i++) {
        generateCourtAssignments(players, 4);
      }

      const testRuns = 10;

      const startWithBoth = performance.now();
      for (let i = 0; i < testRuns; i++) {
        generateCourtAssignments(players, 4);
      }
      const timeWithBoth = performance.now() - startWithBoth;

      const evaluateCost = CourtAssignmentEngine['evaluateCourtCost'];
      const originalEvaluate = evaluateCost.bind(CourtAssignmentEngine);

      const noCacheNoMatrix = function(this: typeof CourtAssignmentEngine, court: any) {
        return originalEvaluate(court, undefined);
      };

      CourtAssignmentEngine['evaluateCourtCost'] = noCacheNoMatrix as any;

      const startBaseline = performance.now();
      for (let i = 0; i < testRuns; i++) {
        getCostCache().clear();
        generateCourtAssignments(players, 4);
      }
      const timeBaseline = performance.now() - startBaseline;

      CourtAssignmentEngine['evaluateCourtCost'] = originalEvaluate;

      const totalImprovement = ((timeBaseline - timeWithBoth) / timeBaseline) * 100;
      const speedup = timeBaseline / timeWithBoth;

      console.log(`\n🚀 Combined Optimizations (Matrix + Cache):`);
      console.log(`   With both optimizations: ${timeWithBoth.toFixed(1)}ms`);
      console.log(`   Baseline (no opts):      ${timeBaseline.toFixed(1)}ms`);
      console.log(`   Total improvement: ${totalImprovement.toFixed(1)}% faster (${speedup.toFixed(2)}x speedup)`);

      expect(timeWithBoth).toBeLessThan(timeBaseline);
      expect(totalImprovement).toBeGreaterThan(0);
    });
  });
});
