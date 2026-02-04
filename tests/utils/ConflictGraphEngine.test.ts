import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ConflictGraphEngine,
  generateCourtAssignmentsCG,
  getBenchedPlayersCG,
} from '../../src/utils/ConflictGraphEngine';
import type { ManualCourtSelection, Court, Player } from '../../src/types';

const generateCourtAssignmentsConflictGraph = generateCourtAssignmentsCG;
const getBenchedPlayersConflictGraph = getBenchedPlayersCG;

const testResetHistory = (): void => ConflictGraphEngine.resetHistory();

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

describe('ConflictGraphEngine – core behaviour', () => {
  beforeEach(() => {
    testResetHistory();
  });

  it('returns empty assignments when no present players', () => {
    expect(generateCourtAssignmentsConflictGraph([], 4)).toEqual([]);
  });

  it('assigns everyone when capacity not exceeded', () => {
    const players = mockPlayers(8);
    const assignments = generateCourtAssignmentsConflictGraph(players, 4);
    const benched = getBenchedPlayersConflictGraph(assignments, players);

    expect(benched.length).toBe(0);
    const idsOnCourts = assignments.flatMap(c => c.players.map(p => p.id));
    expect(new Set(idsOnCourts).size).toBe(8);
  });

  it('never places 3 players on a court', () => {
    const players = mockPlayers(14);
    const assignments = generateCourtAssignmentsConflictGraph(players, 4);
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
      const assignments = generateCourtAssignmentsConflictGraph(players, numberOfCourts);
      const benched = getBenchedPlayersConflictGraph(assignments, players);
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
      const assignments = generateCourtAssignmentsConflictGraph(players, numberOfCourts);
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

    expect(max / min).toBeLessThanOrEqual(3);
    expect(max).toBeLessThanOrEqual(avg * 2);
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

      ConflictGraphEngine.recordWins(courts);
      const winCounts = ConflictGraphEngine.getWinCounts();

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

      ConflictGraphEngine.recordWins(courts);
      const winCounts = ConflictGraphEngine.getWinCounts();

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

      ConflictGraphEngine.recordWins(courts);
      const winCounts = ConflictGraphEngine.getWinCounts();

      expect(winCounts.size).toBe(0);
    });

    it('should accumulate wins across multiple courts', () => {
      const players = mockPlayers(8);
      const courts: Court[] = [
        createMockCourt(1, players.slice(0, 4), 1),
        createMockCourt(2, players.slice(4, 8), 2),
      ];

      ConflictGraphEngine.recordWins(courts);
      const winCounts = ConflictGraphEngine.getWinCounts();

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
      ConflictGraphEngine.recordWins(courts1);

      ConflictGraphEngine.clearCurrentSession();

      const courts2: Court[] = [createMockCourt(1, players, 2)];
      ConflictGraphEngine.recordWins(courts2);

      const winCounts = ConflictGraphEngine.getWinCounts();

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

      ConflictGraphEngine.recordWins(courts);
      const winCounts = ConflictGraphEngine.getWinCounts();

      expect(winCounts.size).toBe(0);
    });

    it('should reset win counts when history is reset', () => {
      const players = mockPlayers(4);
      const courts: Court[] = [createMockCourt(1, players, 1)];

      ConflictGraphEngine.recordWins(courts);
      let winCounts = ConflictGraphEngine.getWinCounts();
      expect(winCounts.size).toBeGreaterThan(0);

      testResetHistory();
      winCounts = ConflictGraphEngine.getWinCounts();
      expect(winCounts.size).toBe(0);
    });

    it('should return copy of win counts map to prevent external modification', () => {
      const players = mockPlayers(4);
      const courts: Court[] = [createMockCourt(1, players, 1)];

      ConflictGraphEngine.recordWins(courts);
      const winCounts1 = ConflictGraphEngine.getWinCounts();
      const winCounts2 = ConflictGraphEngine.getWinCounts();

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
      ConflictGraphEngine.recordWins(courts);
      const winCounts = ConflictGraphEngine.getWinCounts();

      expect(winCounts.get('A1')).toBe(1);
      expect(winCounts.get('A2')).toBe(1);
      expect(winCounts.get('B1')).toBe(undefined);
      expect(winCounts.get('B2')).toBe(undefined);
    });
  });

  it('balances teams by total wins and attempts to split high-win players', () => {
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
      ConflictGraphEngine.recordWins([trainingCourt]);
    }

    let splitCount = 0;
    const testRuns = 20;

    for (let run = 0; run < testRuns; run++) {
      const assignments = generateCourtAssignmentsConflictGraph(players, 1);
      expect(assignments.length).toBe(1);

      const teams = assignments[0].teams!;
      const winCounts = ConflictGraphEngine.getWinCounts();

      const team1WinSum = teams.team1.reduce((acc, p) => acc + (winCounts.get(p.id) ?? 0), 0);
      const team2WinSum = teams.team2.reduce((acc, p) => acc + (winCounts.get(p.id) ?? 0), 0);
      expect(Math.abs(team1WinSum - team2WinSum)).toBeLessThanOrEqual(10);

      const team1Ids = teams.team1.map(p => p.id);
      const p0OnTeam1 = team1Ids.includes('P0');
      const p1OnTeam1 = team1Ids.includes('P1');
      if (p0OnTeam1 !== p1OnTeam1) {
        splitCount++;
      }
    }

    expect(splitCount).toBeGreaterThanOrEqual(testRuns * 0.2);
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

      const assignments1 = generateCourtAssignmentsConflictGraph(players, 2);
      expect(assignments1).toHaveLength(2);

      const courtsWithWinners: Court[] = assignments1.map((court, index) => ({
        ...court,
        winner: (index % 2 + 1) as 1 | 2,
      }));
      ConflictGraphEngine.recordWins(courtsWithWinners);

      generateCourtAssignmentsConflictGraph(players, 2);

      const winCountsBeforeSave = ConflictGraphEngine.getWinCounts();
      expect(winCountsBeforeSave.size).toBeGreaterThan(0);

      ConflictGraphEngine.saveState();

      testResetHistory();

      const emptyWinCounts = ConflictGraphEngine.getWinCounts();
      expect(emptyWinCounts.size).toBe(0);

      ConflictGraphEngine.loadState();

      const winCountsAfterLoad = ConflictGraphEngine.getWinCounts();
      expect(winCountsAfterLoad.size).toBe(winCountsBeforeSave.size);

      for (const [playerId, winCount] of winCountsBeforeSave) {
        expect(winCountsAfterLoad.get(playerId)).toBe(winCount);
      }
    });

    it('should handle loading when no saved state exists', () => {
      localStorage.clear();

      expect(() => ConflictGraphEngine.loadState()).not.toThrow();

      const winCounts = ConflictGraphEngine.getWinCounts();
      expect(winCounts.size).toBe(0);
    });

    it('should handle corrupted localStorage data gracefully', () => {
      localStorage.setItem('badminton-court-engine-state', 'invalid-json');

      expect(() => ConflictGraphEngine.loadState()).not.toThrow();

      const winCounts = ConflictGraphEngine.getWinCounts();
      expect(winCounts.size).toBe(0);
    });

    it('should preserve complex game history across save/load', () => {
      const players = mockPlayers(12);

      for (let round = 0; round < 3; round++) {
        const assignments = generateCourtAssignmentsConflictGraph(players, 3);

        const courtsWithWinners: Court[] = assignments.map((court, index) => ({
          ...court,
          winner: ((round + index) % 2 + 1) as 1 | 2,
        }));
        ConflictGraphEngine.recordWins(courtsWithWinners);
      }

      const winCountsBeforeSave = ConflictGraphEngine.getWinCounts();

      ConflictGraphEngine.saveState();

      testResetHistory();
      ConflictGraphEngine.loadState();

      const winCountsAfterLoad = ConflictGraphEngine.getWinCounts();
      expect(winCountsAfterLoad.size).toBe(winCountsBeforeSave.size);

      for (const [playerId, winCount] of winCountsBeforeSave) {
        expect(winCountsAfterLoad.get(playerId)).toBe(winCount);
      }

      const newAssignments = generateCourtAssignmentsConflictGraph(players, 2);
      expect(newAssignments).toHaveLength(2);

      expect(newAssignments.every(court => court.teams)).toBe(true);
    });

    it('should handle localStorage save errors gracefully', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      const players = mockPlayers(4);
      generateCourtAssignmentsConflictGraph(players, 1);

      expect(() => ConflictGraphEngine.saveState()).not.toThrow();
    });

    it('should maintain separate storage keys for different data types', () => {
      const players = mockPlayers(4);
      generateCourtAssignmentsConflictGraph(players, 1);

      ConflictGraphEngine.saveState();

      const savedData = localStorage.getItem('badminton-court-engine-state');
      expect(savedData).toBeTruthy();

      const parsed = JSON.parse(savedData!);
      expect(parsed).toHaveProperty('benchCountMap');
      expect(parsed).toHaveProperty('teammateCountMap');
      expect(parsed).toHaveProperty('opponentCountMap');
      expect(parsed).toHaveProperty('winCountMap');
      expect(parsed).toHaveProperty('lossCountMap');
    });

    describe('State preparation functionality', () => {
      it('should return state object with all required properties', () => {
        const state = ConflictGraphEngine.prepareStateForSaving();

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

        const state = ConflictGraphEngine.prepareStateForSaving();

        expect(Object.keys(state.benchCountMap).length).toBe(0);
        expect(Object.keys(state.teammateCountMap).length).toBe(0);
        expect(Object.keys(state.opponentCountMap).length).toBe(0);
        expect(Object.keys(state.winCountMap).length).toBe(0);
        expect(Object.keys(state.lossCountMap).length).toBe(0);
      });

      it('should return actual state data when present', () => {
        const players = mockPlayers(6);

        generateCourtAssignmentsConflictGraph(players, 1);

        const courtsWithWinners: Court[] = [
          createMockCourt(1, players.slice(0, 4), 1),
        ];
        ConflictGraphEngine.recordWins(courtsWithWinners);

        const state = ConflictGraphEngine.prepareStateForSaving();

        expect(Object.keys(state.winCountMap).length).toBeGreaterThan(0);
        expect(Object.keys(state.lossCountMap).length).toBeGreaterThan(0);
        expect(Object.keys(state.benchCountMap).length).toBeGreaterThan(0);

        expect(state.winCountMap['P0']).toBe(1);
        expect(state.winCountMap['P1']).toBe(1);
      });
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

      const assignments = generateCourtAssignmentsConflictGraph(players, 2, manualSelection);

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

      const assignments = generateCourtAssignmentsConflictGraph(players, 2, manualSelection);

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

      const assignments = generateCourtAssignmentsConflictGraph(players, 2, manualSelection);

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

      const assignments = generateCourtAssignmentsConflictGraph(players, 2, manualSelection);

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

      const assignments = generateCourtAssignmentsConflictGraph(players, 2, manualSelection);

      expect(assignments).toHaveLength(2);
      expect(assignments[0].courtNumber).toBe(1);
      expect(assignments[1].courtNumber).toBe(2);
    });

    it('works with only one remaining court available', () => {
      const players = mockPlayers(6);
      const manualSelection: ManualCourtSelection = {
        players: [players[0], players[1]],
      };

      const assignments = generateCourtAssignmentsConflictGraph(players, 2, manualSelection);

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

      const assignments = generateCourtAssignmentsConflictGraph(players, 2, manualSelection);

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

      const assignments = generateCourtAssignmentsConflictGraph(players, 2, manualSelection);

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

      const assignments = generateCourtAssignmentsConflictGraph(players, 2, manualSelection);

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

      const assignments = generateCourtAssignmentsConflictGraph(players, 2, manualSelection);

      expect(assignments).toHaveLength(2);
      expect(assignments[0].courtNumber).toBe(1);
      expect(assignments[1].courtNumber).toBe(2);
    });

    it('works with null manual selection', () => {
      const players = mockPlayers(8);

      const assignments = generateCourtAssignmentsConflictGraph(players, 2, undefined);

      expect(assignments).toHaveLength(2);
      expect(assignments[0].courtNumber).toBe(1);
      expect(assignments[1].courtNumber).toBe(2);
    });

    it('properly handles benching with manual selection', () => {
      const players = mockPlayers(10);
      const manualSelection: ManualCourtSelection = {
        players: [players[0], players[1], players[2], players[3]],
      };

      const assignments = generateCourtAssignmentsConflictGraph(players, 2, manualSelection);
      const benched = getBenchedPlayersConflictGraph(assignments, players);

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

      const courts1 = generateCourtAssignmentsConflictGraph(players, 2, manualSelection);

      const mockCourtsWithWinners = courts1.map(court => ({
        ...court,
        winner: 1 as const,
      }));
      ConflictGraphEngine.recordWins(mockCourtsWithWinners);

      const courts2 = generateCourtAssignmentsConflictGraph(players, 2, manualSelection);

      expect(courts2).toHaveLength(2);

      const winCounts = ConflictGraphEngine.getWinCounts();
      expect(winCounts.size).toBeGreaterThan(0);
    });
  });

  describe('Conflict Graph Specific Features', () => {
    beforeEach(() => {
      testResetHistory();
    });

    it('should produce deterministic results for same input and state', () => {
      const players = mockPlayers(8);

      const result1 = generateCourtAssignmentsConflictGraph(players, 2);
      testResetHistory(); // Reset to same initial state
      const result2 = generateCourtAssignmentsConflictGraph(players, 2);

      expect(result1.length).toBe(result2.length);

      expect(result1.every(c => c.teams !== undefined)).toBe(true);
      expect(result2.every(c => c.teams !== undefined)).toBe(true);
    });

    it('should prefer placing high-conflict players first', () => {
      const players = mockPlayers(8);

      for (let i = 0; i < 10; i++) {
        const court: Court = {
          courtNumber: 1,
          players: players.slice(0, 4),
          teams: {
            team1: [players[0], players[1]],
            team2: [players[2], players[3]],
          },
          winner: 1,
        };
        ConflictGraphEngine.recordWins([court]);
        ConflictGraphEngine.clearCurrentSession();
      }

      const assignments = generateCourtAssignmentsConflictGraph(players, 2);

      expect(assignments.length).toBe(2);
      expect(assignments.every(c => c.players.length === 4)).toBe(true);
    });

    it('should handle edge case with exactly 2 players', () => {
      const players = mockPlayers(2);
      const assignments = generateCourtAssignmentsConflictGraph(players, 1);

      expect(assignments.length).toBe(1);
      expect(assignments[0].players.length).toBe(2);
      expect(assignments[0].teams?.team1.length).toBe(1);
      expect(assignments[0].teams?.team2.length).toBe(1);
      const assignedIds = [
        assignments[0].teams?.team1[0].id,
        assignments[0].teams?.team2[0].id,
      ].sort();
      expect(assignedIds).toEqual(['P0', 'P1']);
    });

    it('should handle edge case with 5 players and 2 courts', () => {
      const players = mockPlayers(5);
      const assignments = generateCourtAssignmentsConflictGraph(players, 2);

      const totalAssigned = assignments.reduce((sum, c) => sum + c.players.length, 0);
      expect(totalAssigned).toBe(4); // Only 4 can be assigned (need even numbers)

      const benched = getBenchedPlayersConflictGraph(assignments, players);
      expect(benched.length).toBe(1);
    });

    it('should handle large player counts efficiently', () => {
      const players = mockPlayers(60);
      const startTime = performance.now();

      const assignments = generateCourtAssignmentsConflictGraph(players, 15);

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(assignments.length).toBe(15);
      expect(assignments.every(c => c.players.length === 4)).toBe(true);

      expect(duration).toBeLessThan(100);
    });
  });

  describe('Observer Pattern', () => {
    beforeEach(() => {
      testResetHistory();
    });

    it('should notify listeners on state change', () => {
      const listener = vi.fn();
      const unsubscribe = ConflictGraphEngine.onStateChange(listener);

      const players = mockPlayers(4);
      const court: Court = createMockCourt(1, players, 1);
      ConflictGraphEngine.recordWins([court]);

      expect(listener).toHaveBeenCalled();

      unsubscribe();
    });

    it('should allow unsubscribing from state changes', () => {
      const listener = vi.fn();
      const unsubscribe = ConflictGraphEngine.onStateChange(listener);

      unsubscribe();

      const players = mockPlayers(4);
      const court: Court = createMockCourt(1, players, 1);
      ConflictGraphEngine.recordWins([court]);

      expect(listener).not.toHaveBeenCalled();
    });

    it('should notify on resetHistory', () => {
      const listener = vi.fn();
      ConflictGraphEngine.onStateChange(listener);

      ConflictGraphEngine.resetHistory();

      expect(listener).toHaveBeenCalled();
    });
  });

  describe('updateWinner functionality', () => {
    beforeEach(() => {
      testResetHistory();
    });

    it('should update winner and record wins', () => {
      const players = mockPlayers(4);
      const assignments: Court[] = [createMockCourt(1, players)];

      const updated = ConflictGraphEngine.updateWinner(1, 1, assignments);

      expect(updated[0].winner).toBe(1);

      const winCounts = ConflictGraphEngine.getWinCounts();
      expect(winCounts.get('P0')).toBe(1);
      expect(winCounts.get('P1')).toBe(1);
    });

    it('should reverse previous win when winner changes', () => {
      const players = mockPlayers(4);
      let assignments: Court[] = [createMockCourt(1, players)];

      assignments = ConflictGraphEngine.updateWinner(1, 1, assignments);

      let winCounts = ConflictGraphEngine.getWinCounts();
      expect(winCounts.get('P0')).toBe(1);
      expect(winCounts.get('P2')).toBe(undefined);

      ConflictGraphEngine.updateWinner(1, 2, assignments);

      winCounts = ConflictGraphEngine.getWinCounts();
      expect(winCounts.get('P0')).toBe(0);
      expect(winCounts.get('P2')).toBe(1);
    });

    it('should handle clearing winner', () => {
      const players = mockPlayers(4);
      let assignments: Court[] = [createMockCourt(1, players)];

      assignments = ConflictGraphEngine.updateWinner(1, 1, assignments);
      assignments = ConflictGraphEngine.updateWinner(1, undefined, assignments);

      expect(assignments[0].winner).toBe(undefined);
    });

    it('should return unchanged assignments if court not found', () => {
      const players = mockPlayers(4);
      const assignments: Court[] = [createMockCourt(1, players)];

      const updated = ConflictGraphEngine.updateWinner(99, 1, assignments);

      expect(updated).toEqual(assignments);
    });
  });
});
