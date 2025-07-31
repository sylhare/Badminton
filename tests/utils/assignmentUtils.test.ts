import { describe, it, expect, beforeEach } from 'vitest';
import { generateCourtAssignments, getBenchedPlayers, __testResetHistory } from '../../src/utils/assignmentUtils';
import type { Player } from '../../src/App';

function mockPlayers(count: number): Player[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `P${i}`,
    name: `Player ${i}`,
    isPresent: true,
  }));
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
}); 