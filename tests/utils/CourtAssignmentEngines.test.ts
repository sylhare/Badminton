import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { engineMC } from '../../src/utils/CourtAssignmentEngine';
import { engineSA } from '../../src/utils/CourtAssignmentEngineSA';
import { engineCG } from '../../src/utils/ConflictGraphEngine';
import type { ManualCourtSelection, Court, Player, ICourtAssignmentEngine } from '../../src/types';

const engines: Array<{ name: string; engine: ICourtAssignmentEngine }> = [
  { name: 'Monte Carlo (MC)', engine: engineMC },
  { name: 'Simulated Annealing (SA)', engine: engineSA },
  { name: 'Conflict Graph (CG)', engine: engineCG },
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

describe.each(engines)('$name – Core Behaviour', ({ name, engine }) => {
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

    const engineBenchCounts = engine.getBenchCounts();
    players.forEach(p => {
      expect(engineBenchCounts.get(p.id) || 0).toBe(benchHistory[p.id]);
    });
  });

  it('getBenchCounts should return an empty map after resetHistory', () => {
    const players = mockPlayers(12);
    engine.generate(players, 2);

    expect(engine.getBenchCounts().size).toBeGreaterThan(0);

    engine.resetHistory();
    expect(engine.getBenchCounts().size).toBe(0);
  });

  it('statistical check: teammate pairs are reasonably balanced over many rounds', () => {
    const players = mockPlayers(8);
    const numberOfCourts = 2;
    const rounds = name.includes('SA') ? 30 : 100;

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

  it('getWinCounts should maintain correct totals across multiple recordWins calls', () => {
    const players = mockPlayers(4);
    const court1: Court[] = [createMockCourt(1, players, 1)];
    const court2: Court[] = [createMockCourt(1, players, 1)];

    engine.recordWins(court1);
    engine.clearCurrentSession();
    engine.recordWins(court2);

    const winCounts = engine.getWinCounts();
    expect(winCounts.get('P0')).toBe(2);
    expect(winCounts.get('P1')).toBe(2);
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

  it('ignores manual selection with only 1 player', () => {
    const players = mockPlayers(8);
    const manualSelection: ManualCourtSelection = {
      players: [players[0]],
    };

    const assignments = engine.generate(players, 2, manualSelection);

    expect(assignments).toHaveLength(2);
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

  it('should handle large player counts efficiently', () => {
    const players = mockPlayers(60);
    const startTime = performance.now();

    const assignments = engine.generate(players, 15);

    const endTime = performance.now();
    const duration = endTime - startTime;

    expect(assignments.length).toBe(15);
    expect(assignments.every(c => c.players.length === 4)).toBe(true);
    expect(duration).toBeLessThan(200);
  });
});

describe.each(engines)('$name – Skill Balancing', ({ engine }) => {
  beforeEach(() => {
    engine.resetHistory();
  });

  it('balances teams by total wins', () => {
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

describe.each(engines)('$name – Singles Rotation Fairness', ({ engine }) => {
  beforeEach(() => {
    engine.resetHistory();
  });

  it('should track singles matches in state', () => {
    const players = mockPlayers(2);

    engine.generate(players, 1);

    const state = engine.prepareStateForSaving();
    expect(state).toHaveProperty('singleCountMap');
    expect(typeof state.singleCountMap).toBe('object');
  });

  it('should increment singles count when 2 players are assigned', () => {
    const players = mockPlayers(2);

    engine.generate(players, 1);

    const state = engine.prepareStateForSaving() as { singleCountMap: Record<string, number> };
    const singlesPlayed = Object.values(state.singleCountMap).filter(v => v > 0).length;
    expect(singlesPlayed).toBe(2);
  });

  it('should not increment singles count for doubles matches', () => {
    const players = mockPlayers(4);

    engine.generate(players, 1);

    const state = engine.prepareStateForSaving() as { singleCountMap: Record<string, number> };
    const singlesPlayed = Object.values(state.singleCountMap).filter(v => v > 0).length;
    expect(singlesPlayed).toBe(0);
  });

  it('should prefer players with fewer singles matches for fair rotation', () => {
    const players = mockPlayers(4);

    const twoPlayers = players.slice(0, 2);
    engine.generate(twoPlayers, 1);

    const stateAfterFirst = engine.prepareStateForSaving() as { singleCountMap: Record<string, number> };
    expect(stateAfterFirst.singleCountMap['P0']).toBe(1);
    expect(stateAfterFirst.singleCountMap['P1']).toBe(1);
    expect(stateAfterFirst.singleCountMap['P2'] ?? 0).toBe(0);
    expect(stateAfterFirst.singleCountMap['P3'] ?? 0).toBe(0);

    const anotherTwoPlayers = players.slice(2, 4);
    engine.generate(anotherTwoPlayers, 1);

    const stateAfterSecond = engine.prepareStateForSaving() as { singleCountMap: Record<string, number> };
    expect(stateAfterSecond.singleCountMap['P2']).toBe(1);
    expect(stateAfterSecond.singleCountMap['P3']).toBe(1);
  });

  it('should clear singles count on resetHistory', () => {
    const players = mockPlayers(2);

    engine.generate(players, 1);

    const stateBefore = engine.prepareStateForSaving() as { singleCountMap: Record<string, number> };
    expect(Object.values(stateBefore.singleCountMap).some(v => v > 0)).toBe(true);

    engine.resetHistory();

    const stateAfter = engine.prepareStateForSaving() as { singleCountMap: Record<string, number> };
    expect(Object.values(stateAfter.singleCountMap).every(v => v === 0)).toBe(true);
  });
});
