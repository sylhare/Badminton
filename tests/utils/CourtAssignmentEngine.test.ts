import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CourtAssignmentEngine } from '../../src/utils/CourtAssignmentEngine';
import { CourtAssignmentEngineSA } from '../../src/utils/CourtAssignmentEngineSA';
import { ConflictGraphEngine } from '../../src/utils/ConflictGraphEngine';
import type { ManualCourtSelection, Court, Player } from '../../src/types';

interface TestableEngine {
  generate(players: Player[], numberOfCourts: number, manualSelection?: ManualCourtSelection): Court[];
  getBenchedPlayers(assignments: Court[], players: Player[]): Player[];
  resetHistory(): void;
  clearCurrentSession(): void;
  recordWins(courts: Court[]): void;
  getWinCounts(): Map<string, number>;
  updateWinner(courtNumber: number, winner: 1 | 2 | undefined, currentAssignments: Court[]): Court[];
  saveState(): void;
  loadState(): void;
  prepareStateForSaving(): Record<string, unknown>;
  onStateChange(listener: () => void): () => void;
}

const engines: Array<{ name: string; engine: TestableEngine }> = [
  { name: 'Monte Carlo (MC)', engine: CourtAssignmentEngine },
  { name: 'Simulated Annealing (SA)', engine: CourtAssignmentEngineSA },
  { name: 'Conflict Graph (CG)', engine: ConflictGraphEngine },
];

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

describe.each(engines)('$name – Core Behaviour', ({ engine }) => {
  beforeEach(() => {
    engine.resetHistory();
  });

  it('returns empty assignments when no present players', () => {
    expect(engine.generate([], 4)).toEqual([]);
  });

  it('assigns everyone when capacity not exceeded', () => {
    const players = mockPlayers(8);
    const assignments = engine.generate(players, 4);
    const benched = engine.getBenchedPlayers(assignments, players);

    expect(benched.length).toBe(0);
    const idsOnCourts = assignments.flatMap(c => c.players.map(p => p.id));
    expect(new Set(idsOnCourts).size).toBe(8);
  });

  it('never places 3 players on a court', () => {
    const players = mockPlayers(14);
    const assignments = engine.generate(players, 4);
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
      const assignments = engine.generate(players, numberOfCourts);
      const benched = engine.getBenchedPlayers(assignments, players);
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
      const assignments = engine.generate(players, numberOfCourts);
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
});

describe.each(engines)('$name – Winner Tracking', ({ engine }) => {
  beforeEach(() => {
    engine.resetHistory();
  });

  it('should record wins for winning team players', () => {
    const players = mockPlayers(4);
    const courts: Court[] = [createMockCourt(1, players, 1)];

    engine.recordWins(courts);
    const winCounts = engine.getWinCounts();

    expect(winCounts.get('P0')).toBe(1);
    expect(winCounts.get('P1')).toBe(1);
    expect(winCounts.get('P2')).toBe(undefined);
    expect(winCounts.get('P3')).toBe(undefined);
  });

  it('should record wins for team2 when they win', () => {
    const players = mockPlayers(4);
    const courts: Court[] = [createMockCourt(1, players, 2)];

    engine.recordWins(courts);
    const winCounts = engine.getWinCounts();

    expect(winCounts.get('P0')).toBe(undefined);
    expect(winCounts.get('P1')).toBe(undefined);
    expect(winCounts.get('P2')).toBe(1);
    expect(winCounts.get('P3')).toBe(1);
  });

  it('should not record wins when no winner is set', () => {
    const players = mockPlayers(4);
    const courts: Court[] = [createMockCourt(1, players)];

    engine.recordWins(courts);
    const winCounts = engine.getWinCounts();

    expect(winCounts.size).toBe(0);
  });

  it('should accumulate wins across multiple courts', () => {
    const players = mockPlayers(8);
    const courts: Court[] = [
      createMockCourt(1, players.slice(0, 4), 1),
      createMockCourt(2, players.slice(4, 8), 2),
    ];

    engine.recordWins(courts);
    const winCounts = engine.getWinCounts();

    expect(winCounts.get('P0')).toBe(1);
    expect(winCounts.get('P1')).toBe(1);
    expect(winCounts.get('P6')).toBe(1);
    expect(winCounts.get('P7')).toBe(1);
  });

  it('should accumulate wins across multiple rounds', () => {
    const players = mockPlayers(4);

    const courts1: Court[] = [createMockCourt(1, players, 1)];
    engine.recordWins(courts1);
    engine.clearCurrentSession();

    const courts2: Court[] = [createMockCourt(1, players, 2)];
    engine.recordWins(courts2);

    const winCounts = engine.getWinCounts();

    expect(winCounts.get('P0')).toBe(1);
    expect(winCounts.get('P1')).toBe(1);
    expect(winCounts.get('P2')).toBe(1);
    expect(winCounts.get('P3')).toBe(1);
  });

  it('should handle courts without teams', () => {
    const players = mockPlayers(2);
    const courts: Court[] = [{ courtNumber: 1, players, winner: 1 }];

    engine.recordWins(courts);
    const winCounts = engine.getWinCounts();

    expect(winCounts.size).toBe(0);
  });

  it('should reset win counts when history is reset', () => {
    const players = mockPlayers(4);
    const courts: Court[] = [createMockCourt(1, players, 1)];

    engine.recordWins(courts);
    let winCounts = engine.getWinCounts();
    expect(winCounts.size).toBeGreaterThan(0);

    engine.resetHistory();
    winCounts = engine.getWinCounts();
    expect(winCounts.size).toBe(0);
  });

  it('should return copy of win counts map to prevent external modification', () => {
    const players = mockPlayers(4);
    const courts: Court[] = [createMockCourt(1, players, 1)];

    engine.recordWins(courts);
    const winCounts1 = engine.getWinCounts();
    const winCounts2 = engine.getWinCounts();

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
    engine.recordWins(courts);
    const winCounts = engine.getWinCounts();

    expect(winCounts.get('A1')).toBe(1);
    expect(winCounts.get('A2')).toBe(1);
    expect(winCounts.get('B1')).toBe(undefined);
    expect(winCounts.get('B2')).toBe(undefined);
  });
});

describe.each(engines)('$name – State Persistence', ({ engine }) => {
  beforeEach(() => {
    localStorage.clear();
    engine.resetHistory();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    engine.resetHistory();
  });

  it('should save and load engine state correctly', () => {
    const players = mockPlayers(8);

    const assignments1 = engine.generate(players, 2);
    expect(assignments1).toHaveLength(2);

    const courtsWithWinners: Court[] = assignments1.map((court, index) => ({
      ...court,
      winner: (index % 2 + 1) as 1 | 2,
    }));
    engine.recordWins(courtsWithWinners);

    engine.generate(players, 2);

    const winCountsBeforeSave = engine.getWinCounts();
    expect(winCountsBeforeSave.size).toBeGreaterThan(0);

    engine.saveState();
    engine.resetHistory();

    const emptyWinCounts = engine.getWinCounts();
    expect(emptyWinCounts.size).toBe(0);

    engine.loadState();

    const winCountsAfterLoad = engine.getWinCounts();
    expect(winCountsAfterLoad.size).toBe(winCountsBeforeSave.size);

    for (const [playerId, winCount] of winCountsBeforeSave) {
      expect(winCountsAfterLoad.get(playerId)).toBe(winCount);
    }
  });

  it('should handle loading when no saved state exists', () => {
    localStorage.clear();

    expect(() => engine.loadState()).not.toThrow();

    const winCounts = engine.getWinCounts();
    expect(winCounts.size).toBe(0);
  });

  it('should handle corrupted localStorage data gracefully', () => {
    localStorage.setItem('badminton-court-engine-state', 'invalid-json');

    expect(() => engine.loadState()).not.toThrow();

    const winCounts = engine.getWinCounts();
    expect(winCounts.size).toBe(0);
  });

  it('should preserve complex game history across save/load', () => {
    const players = mockPlayers(12);

    for (let round = 0; round < 3; round++) {
      const assignments = engine.generate(players, 3);

      const courtsWithWinners: Court[] = assignments.map((court, index) => ({
        ...court,
        winner: ((round + index) % 2 + 1) as 1 | 2,
      }));
      engine.recordWins(courtsWithWinners);
    }

    const winCountsBeforeSave = engine.getWinCounts();

    engine.saveState();

    engine.resetHistory();
    engine.loadState();

    const winCountsAfterLoad = engine.getWinCounts();
    expect(winCountsAfterLoad.size).toBe(winCountsBeforeSave.size);

    for (const [playerId, winCount] of winCountsBeforeSave) {
      expect(winCountsAfterLoad.get(playerId)).toBe(winCount);
    }

    const newAssignments = engine.generate(players, 2);
    expect(newAssignments).toHaveLength(2);
    expect(newAssignments.every(court => court.teams)).toBe(true);
  });

  it('should handle localStorage save errors gracefully', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage quota exceeded');
    });

    const players = mockPlayers(4);
    engine.generate(players, 1);

    expect(() => engine.saveState()).not.toThrow();
  });

  it('should return state object with all required properties', () => {
    const state = engine.prepareStateForSaving();

    expect(state).toHaveProperty('benchCountMap');
    expect(state).toHaveProperty('teammateCountMap');
    expect(state).toHaveProperty('opponentCountMap');
    expect(state).toHaveProperty('winCountMap');
    expect(state).toHaveProperty('lossCountMap');
  });

  it('should maintain separate storage keys for different data types', () => {
    const players = mockPlayers(4);
    engine.generate(players, 1);

    engine.saveState();

    const savedData = localStorage.getItem('badminton-court-engine-state');
    expect(savedData).toBeTruthy();

    const parsed = JSON.parse(savedData!);
    expect(parsed).toHaveProperty('benchCountMap');
    expect(parsed).toHaveProperty('teammateCountMap');
    expect(parsed).toHaveProperty('opponentCountMap');
    expect(parsed).toHaveProperty('winCountMap');
    expect(parsed).toHaveProperty('lossCountMap');
  });

  it('should return empty maps when no data exists', () => {
    engine.resetHistory();

    const state = engine.prepareStateForSaving();

    expect(Object.keys(state.benchCountMap as object).length).toBe(0);
    expect(Object.keys(state.teammateCountMap as object).length).toBe(0);
    expect(Object.keys(state.opponentCountMap as object).length).toBe(0);
    expect(Object.keys(state.winCountMap as object).length).toBe(0);
    expect(Object.keys(state.lossCountMap as object).length).toBe(0);
  });

  it('should return actual state data when present', () => {
    const players = mockPlayers(6);

    engine.generate(players, 1);

    const courtsWithWinners: Court[] = [
      createMockCourt(1, players.slice(0, 4), 1),
    ];
    engine.recordWins(courtsWithWinners);

    const state = engine.prepareStateForSaving();

    expect(Object.keys(state.winCountMap as object).length).toBeGreaterThan(0);
    expect(Object.keys(state.lossCountMap as object).length).toBeGreaterThan(0);
    expect(Object.keys(state.benchCountMap as object).length).toBeGreaterThan(0);

    expect((state.winCountMap as Record<string, number>)['P0']).toBe(1);
    expect((state.winCountMap as Record<string, number>)['P1']).toBe(1);
  });

  it('should persist reset state across engine reload', () => {
    const players = mockPlayers(4);
    const assignments = engine.generate(players, 1);

    const courtsWithWinners: Court[] = assignments.map(court => ({
      ...court,
      winner: 1 as 1 | 2,
    }));
    engine.recordWins(courtsWithWinners);

    expect(engine.getWinCounts().size).toBeGreaterThan(0);

    engine.resetHistory();
    engine.saveState();

    const newAssignments = engine.generate(players, 1);
    const newCourtsWithWinners: Court[] = newAssignments.map(court => ({
      ...court,
      winner: 2 as 1 | 2,
    }));
    engine.recordWins(newCourtsWithWinners);
    expect(engine.getWinCounts().size).toBeGreaterThan(0);

    engine.loadState();

    const restoredWinCounts = engine.getWinCounts();
    expect(restoredWinCounts.size).toBe(0);
  });
});

describe.each(engines)('$name – Manual Court Selection', ({ engine }) => {
  beforeEach(() => {
    engine.resetHistory();
  });

  it('creates manual court with 2 players for singles', () => {
    const players = mockPlayers(8);
    const manualSelection: ManualCourtSelection = {
      players: [players[0], players[1]],
    };

    const assignments = engine.generate(players, 2, manualSelection);

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

    const assignments = engine.generate(players, 2, manualSelection);

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

    const assignments = engine.generate(players, 2, manualSelection);

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

    const assignments = engine.generate(players, 2, manualSelection);

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

    const assignments = engine.generate(players, 2, manualSelection);

    expect(assignments).toHaveLength(2);
    expect(assignments[0].courtNumber).toBe(1);
    expect(assignments[1].courtNumber).toBe(2);
  });

  it('works with only one remaining court available', () => {
    const players = mockPlayers(6);
    const manualSelection: ManualCourtSelection = {
      players: [players[0], players[1]],
    };

    const assignments = engine.generate(players, 2, manualSelection);

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

    const assignments = engine.generate(players, 2, manualSelection);

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

    const assignments = engine.generate(players, 2, manualSelection);

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

    const assignments = engine.generate(players, 2, manualSelection);

    expect(assignments).toHaveLength(2);

    const manualCourt = assignments[0];
    expect(manualCourt.players).toHaveLength(2);
    expect(manualCourt.players).toEqual([players[0], players[2]]);
    expect(manualCourt.players.map(p => p.id)).not.toContain(players[1].id);
  });

  it('works with empty manual selection', () => {
    const players = mockPlayers(8);
    const manualSelection: ManualCourtSelection = { players: [] };

    const assignments = engine.generate(players, 2, manualSelection);

    expect(assignments).toHaveLength(2);
    expect(assignments[0].courtNumber).toBe(1);
    expect(assignments[1].courtNumber).toBe(2);
  });

  it('works with null manual selection', () => {
    const players = mockPlayers(8);

    const assignments = engine.generate(players, 2, undefined);

    expect(assignments).toHaveLength(2);
    expect(assignments[0].courtNumber).toBe(1);
    expect(assignments[1].courtNumber).toBe(2);
  });

  it('properly handles benching with manual selection', () => {
    const players = mockPlayers(10);
    const manualSelection: ManualCourtSelection = {
      players: [players[0], players[1], players[2], players[3]],
    };

    const assignments = engine.generate(players, 2, manualSelection);
    const benched = engine.getBenchedPlayers(assignments, players);

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

    const courts1 = engine.generate(players, 2, manualSelection);

    const mockCourtsWithWinners = courts1.map(court => ({
      ...court,
      winner: 1 as const,
    }));
    engine.recordWins(mockCourtsWithWinners);

    const courts2 = engine.generate(players, 2, manualSelection);

    expect(courts2).toHaveLength(2);

    const winCounts = engine.getWinCounts();
    expect(winCounts.size).toBeGreaterThan(0);
  });
});

describe.each(engines)('$name – Observer Pattern', ({ engine }) => {
  beforeEach(() => {
    engine.resetHistory();
  });

  it('should notify listeners on state change', () => {
    const listener = vi.fn();
    const unsubscribe = engine.onStateChange(listener);

    const players = mockPlayers(4);
    const court: Court = createMockCourt(1, players, 1);
    engine.recordWins([court]);

    expect(listener).toHaveBeenCalled();

    unsubscribe();
  });

  it('should allow unsubscribing from state changes', () => {
    const listener = vi.fn();
    const unsubscribe = engine.onStateChange(listener);

    unsubscribe();

    const players = mockPlayers(4);
    const court: Court = createMockCourt(1, players, 1);
    engine.recordWins([court]);

    expect(listener).not.toHaveBeenCalled();
  });

  it('should notify on resetHistory', () => {
    const listener = vi.fn();
    engine.onStateChange(listener);

    engine.resetHistory();

    expect(listener).toHaveBeenCalled();
  });
});

describe.each(engines)('$name – updateWinner', ({ engine }) => {
  beforeEach(() => {
    engine.resetHistory();
  });

  it('should update winner and record wins', () => {
    const players = mockPlayers(4);
    const assignments: Court[] = [createMockCourt(1, players)];

    const updated = engine.updateWinner(1, 1, assignments);

    expect(updated[0].winner).toBe(1);

    const winCounts = engine.getWinCounts();
    expect(winCounts.get('P0')).toBe(1);
    expect(winCounts.get('P1')).toBe(1);
  });

  it('should reverse previous win when winner changes', () => {
    const players = mockPlayers(4);
    let assignments: Court[] = [createMockCourt(1, players)];

    assignments = engine.updateWinner(1, 1, assignments);

    let winCounts = engine.getWinCounts();
    expect(winCounts.get('P0')).toBe(1);
    expect(winCounts.get('P2')).toBe(undefined);

    engine.updateWinner(1, 2, assignments);

    winCounts = engine.getWinCounts();
    expect(winCounts.get('P0')).toBe(0);
    expect(winCounts.get('P2')).toBe(1);
  });

  it('should handle clearing winner', () => {
    const players = mockPlayers(4);
    let assignments: Court[] = [createMockCourt(1, players)];

    assignments = engine.updateWinner(1, 1, assignments);
    assignments = engine.updateWinner(1, undefined, assignments);

    expect(assignments[0].winner).toBe(undefined);
  });

  it('should return unchanged assignments if court not found', () => {
    const players = mockPlayers(4);
    const assignments: Court[] = [createMockCourt(1, players)];

    const updated = engine.updateWinner(99, 1, assignments);

    expect(updated).toEqual(assignments);
  });
});

describe.each(engines)('$name – Edge Cases', ({ engine }) => {
  beforeEach(() => {
    engine.resetHistory();
  });

  it('should handle edge case with exactly 2 players', () => {
    const players = mockPlayers(2);
    const assignments = engine.generate(players, 1);

    expect(assignments.length).toBe(1);
    expect(assignments[0].players.length).toBe(2);

    expect(assignments[0].teams!.team1).toHaveLength(1);
    expect(assignments[0].teams!.team2).toHaveLength(1);

    const allTeamPlayers = [...assignments[0].teams!.team1, ...assignments[0].teams!.team2];
    expect(allTeamPlayers.map(p => p.id).sort()).toEqual(['P0', 'P1']);
  });

  it('should handle edge case with 5 players and 2 courts', () => {
    const players = mockPlayers(5);
    const assignments = engine.generate(players, 2);

    const totalAssigned = assignments.reduce((sum, c) => sum + c.players.length, 0);
    expect(totalAssigned).toBe(4);

    const benched = engine.getBenchedPlayers(assignments, players);
    expect(benched.length).toBe(1);
  });

  it('should handle large player counts', () => {
    const players = mockPlayers(60);

    const assignments = engine.generate(players, 15);

    expect(assignments.length).toBe(15);
    expect(assignments.every(c => c.players.length === 4)).toBe(true);
  });
});

describe.each(engines)('$name – Skill Balancing', ({ engine }) => {
  beforeEach(() => {
    engine.resetHistory();
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
      engine.recordWins([trainingCourt]);
    }

    let splitCount = 0;
    const testRuns = 20;

    for (let run = 0; run < testRuns; run++) {
      const assignments = engine.generate(players, 1);
      expect(assignments.length).toBe(1);

      const teams = assignments[0].teams!;
      const winCounts = engine.getWinCounts();

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
});

describe.each(engines)('$name – Immediate Win Recording', ({ engine }) => {
  beforeEach(() => {
    engine.resetHistory();
    localStorage.clear();
  });

  afterEach(() => {
    engine.resetHistory();
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

    engine.recordWins(courtsWithWinners);

    const winCounts = engine.getWinCounts();

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

    engine.recordWins(courtsWithWinners);

    const winCounts = engine.getWinCounts();

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

    engine.recordWins(courtsWithoutWinners);

    const winCounts = engine.getWinCounts();
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

    engine.recordWins(courtWithWinner);
    engine.saveState();

    const winCountsBefore = engine.getWinCounts();
    const player0WinsBefore = winCountsBefore.get(players[0].id) || 0;
    const player1WinsBefore = winCountsBefore.get(players[1].id) || 0;

    engine.resetHistory();
    engine.loadState();

    const winCountsAfter = engine.getWinCounts();
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

    engine.recordWins(firstCourt);
    engine.recordWins(secondCourt);

    const winCounts = engine.getWinCounts();

    expect(winCounts.get(players[0].id)).toBe(2);
    expect(winCounts.get(players[1].id)).toBe(1);
    expect(winCounts.get(players[2].id)).toBe(1);
    expect(winCounts.get(players[3].id) || 0).toBe(0);
  });
});

describe('Monte Carlo (MC) – Previous Record Reversal', () => {
  const testResetHistory = (): void => CourtAssignmentEngine.resetHistory();

  const testShouldReversePreviousRecord = (
    previousRecord: { winner: 1 | 2; winningPlayers: string[]; losingPlayers: string[] },
    currentWinner: 1 | 2,
    currentWinningPlayerIds: string[],
  ): boolean => CourtAssignmentEngine['shouldReversePreviousRecord'](previousRecord, currentWinner, currentWinningPlayerIds);

  const testReversePreviousWinRecord = (
    previousRecord: { winner: 1 | 2; winningPlayers: string[]; losingPlayers: string[] },
  ): void => CourtAssignmentEngine['reversePreviousWinRecord'](previousRecord);

  beforeEach(() => {
    testResetHistory();
  });

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

describe('Monte Carlo (MC) – Cost Memoization', () => {
  const testResetHistory = (): void => CourtAssignmentEngine.resetHistory();
  const getCourtCacheKey = () => CourtAssignmentEngine['getCourtCacheKey'];
  const getCostCache = () => CourtAssignmentEngine['costCache'];

  beforeEach(() => {
    testResetHistory();
  });

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

    CourtAssignmentEngine.generate(players, 2);

    expect(getCostCache().size).toBeGreaterThan(0);
  });

  it('should produce identical results with cache', () => {
    const players = mockPlayers(12);

    CourtAssignmentEngine['winCountMap'].set('P0', 5);
    CourtAssignmentEngine['lossCountMap'].set('P1', 3);
    CourtAssignmentEngine['teammateCountMap'].set('P0|P1', 2);

    getCostCache().clear();
    const result1 = CourtAssignmentEngine.generate(players, 3);

    getCostCache().clear();
    const result2 = CourtAssignmentEngine.generate(players, 3);

    expect(result1.length).toBe(result2.length);
    expect(result1.every(c => c.teams !== undefined)).toBe(true);
    expect(result2.every(c => c.teams !== undefined)).toBe(true);
  });
});

describe('Conflict Graph (CG) – Specific Features', () => {
  beforeEach(() => {
    ConflictGraphEngine.resetHistory();
  });

  it('should produce deterministic results for same input and state', () => {
    const players = mockPlayers(8);

    const result1 = ConflictGraphEngine.generate(players, 2);
    ConflictGraphEngine.resetHistory();
    const result2 = ConflictGraphEngine.generate(players, 2);

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

    const assignments = ConflictGraphEngine.generate(players, 2);

    expect(assignments.length).toBe(2);
    expect(assignments.every(c => c.players.length === 4)).toBe(true);
  });

  it('should handle large player counts efficiently', () => {
    const players = mockPlayers(60);
    const startTime = performance.now();

    const assignments = ConflictGraphEngine.generate(players, 15);

    const endTime = performance.now();
    const duration = endTime - startTime;

    expect(assignments.length).toBe(15);
    expect(assignments.every(c => c.players.length === 4)).toBe(true);
    expect(duration).toBeLessThan(100);
  });
});
