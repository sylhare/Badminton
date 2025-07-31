import { describe, it, expect, beforeEach } from 'vitest';
import { generateCourtAssignments, getBenchedPlayers, __testResetHistory, CourtAssignmentEngine } from '../../src/utils/assignmentUtils';
import type { Player, Court } from '../../src/App';

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

describe('assignmentUtils – core behaviour', () => {
  beforeEach(() => {
    __testResetHistory();
  });

  it('returns empty assignments when no present players', () => {
    expect(generateCourtAssignments([], 4)).toEqual([]);
  });

  it('assigns everyone when capacity not exceeded', () => {
    const players = mockPlayers(8); // two courts worth
    const assignments = generateCourtAssignments(players, 4); // capacity 16
    const benched = getBenchedPlayers(assignments, players);

    expect(benched.length).toBe(0);
    const idsOnCourts = assignments.flatMap(c => c.players.map(p => p.id));
    expect(new Set(idsOnCourts).size).toBe(8);
  });

  it('never places 3 players on a court', () => {
    const players = mockPlayers(14); // capacity 16
    const assignments = generateCourtAssignments(players, 4);
    assignments.forEach(court => {
      expect([2, 4]).toContain(court.players.length);
    });
  });

  it('benched players rotate fairly (no repeats until everyone benched)', () => {
    const players = mockPlayers(12); // capacity 8, so 4 bench each round
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
    const players = mockPlayers(8);       // 2 courts of doubles each round
    const numberOfCourts = 2;
    const rounds = 100;

    // Track how many times every unordered pair of players were on the SAME team
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

    // 1) Every pair should have played together at least once
    expect(min).toBeGreaterThan(0);

    // 2) The worst-case spread should be modest (no pair is teamed up more than twice as often as any other pair)
    expect(max / min).toBeLessThanOrEqual(2);

    // 3) No pair should exceed 150% of the average frequency
    expect(max).toBeLessThanOrEqual(avg * 1.5);
  });

  // Winner tracking functionality tests
  describe('Winner tracking functionality', () => {
    beforeEach(() => {
      __testResetHistory();
    });

    it('should record wins for winning team players', () => {
      const players = mockPlayers(4);
      const courts: Court[] = [
        createMockCourt(1, players, 1), // team1 wins
      ];

      CourtAssignmentEngine.recordWins(courts);
      const winCounts = CourtAssignmentEngine.getWinCounts();

      // Team1 players should have 1 win each
      expect(winCounts.get('P0')).toBe(1);
      expect(winCounts.get('P1')).toBe(1);

      // Team2 players should have 0 wins
      expect(winCounts.get('P2')).toBe(undefined);
      expect(winCounts.get('P3')).toBe(undefined);
    });

    it('should record wins for team2 when they win', () => {
      const players = mockPlayers(4);
      const courts: Court[] = [
        createMockCourt(1, players, 2), // team2 wins
      ];

      CourtAssignmentEngine.recordWins(courts);
      const winCounts = CourtAssignmentEngine.getWinCounts();

      // Team1 players should have 0 wins
      expect(winCounts.get('P0')).toBe(undefined);
      expect(winCounts.get('P1')).toBe(undefined);

      // Team2 players should have 1 win each
      expect(winCounts.get('P2')).toBe(1);
      expect(winCounts.get('P3')).toBe(1);
    });

    it('should not record wins when no winner is set', () => {
      const players = mockPlayers(4);
      const courts: Court[] = [
        createMockCourt(1, players), // no winner
      ];

      CourtAssignmentEngine.recordWins(courts);
      const winCounts = CourtAssignmentEngine.getWinCounts();

      // No players should have wins recorded
      expect(winCounts.size).toBe(0);
    });

    it('should accumulate wins across multiple courts', () => {
      const players = mockPlayers(8);
      const courts: Court[] = [
        createMockCourt(1, players.slice(0, 4), 1), // P0, P1 win
        createMockCourt(2, players.slice(4, 8), 2), // P6, P7 win
      ];

      CourtAssignmentEngine.recordWins(courts);
      const winCounts = CourtAssignmentEngine.getWinCounts();

      expect(winCounts.get('P0')).toBe(1);
      expect(winCounts.get('P1')).toBe(1);
      expect(winCounts.get('P6')).toBe(1);
      expect(winCounts.get('P7')).toBe(1);

      // Other players should have no wins
      expect(winCounts.get('P2')).toBe(undefined);
      expect(winCounts.get('P3')).toBe(undefined);
      expect(winCounts.get('P4')).toBe(undefined);
      expect(winCounts.get('P5')).toBe(undefined);
    });

    it('should accumulate wins across multiple rounds', () => {
      const players = mockPlayers(4);
      
      // First round - team1 wins
      const courts1: Court[] = [createMockCourt(1, players, 1)];
      CourtAssignmentEngine.recordWins(courts1);

      // Second round - team2 wins
      const courts2: Court[] = [createMockCourt(1, players, 2)];
      CourtAssignmentEngine.recordWins(courts2);

      const winCounts = CourtAssignmentEngine.getWinCounts();

      // All players should have 1 win each
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
          winner: 1, // winner set but no teams structure
        },
      ];

      CourtAssignmentEngine.recordWins(courts);
      const winCounts = CourtAssignmentEngine.getWinCounts();

      // No wins should be recorded without teams structure
      expect(winCounts.size).toBe(0);
    });

    it('should reset win counts when history is reset', () => {
      const players = mockPlayers(4);
      const courts: Court[] = [createMockCourt(1, players, 1)];

      CourtAssignmentEngine.recordWins(courts);
      let winCounts = CourtAssignmentEngine.getWinCounts();
      expect(winCounts.size).toBeGreaterThan(0);

      __testResetHistory();
      winCounts = CourtAssignmentEngine.getWinCounts();
      expect(winCounts.size).toBe(0);
    });

    it('should return copy of win counts map to prevent external modification', () => {
      const players = mockPlayers(4);
      const courts: Court[] = [createMockCourt(1, players, 1)];

      CourtAssignmentEngine.recordWins(courts);
      const winCounts1 = CourtAssignmentEngine.getWinCounts();
      const winCounts2 = CourtAssignmentEngine.getWinCounts();

      // Should be different instances
      expect(winCounts1).not.toBe(winCounts2);

      // But with same content
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

      // Both players named "John" should be tracked separately by ID
      expect(winCounts.get('A1')).toBe(1);
      expect(winCounts.get('A2')).toBe(1);
      expect(winCounts.get('B1')).toBe(undefined);
      expect(winCounts.get('B2')).toBe(undefined);
    });
  });
}); 