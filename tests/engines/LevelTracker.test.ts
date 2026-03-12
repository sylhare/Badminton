import { beforeEach, describe, expect, it } from 'vitest';

import { LevelTracker } from '../../src/engines/LevelTracker';
import { LevelTrackerConfig } from '../../src/engines/levelTrackerConfig';
import type { Court, Player } from '../../src/types';

function makePlayer(id: string, level?: number): Player {
  return { id, name: `Player ${id}`, isPresent: true, level };
}

function makeCourt(
  team1: Player[],
  team2: Player[],
  winner: 1 | 2,
  score?: { team1: number; team2: number },
): Court {
  return { courtNumber: 1, teams: { team1, team2 }, winner, score };
}

describe('LevelTracker', () => {
  let tracker: LevelTracker;
  beforeEach(() => { tracker = new LevelTracker(); });

  describe('getKFactor', () => {
    it('returns K_DEFAULT when no score is provided', () => {
      expect(tracker.getKFactor()).toBe(LevelTrackerConfig.K_DEFAULT);
    });

    it('returns K_DEFAULT for a deuce win (winner score ≠ 21)', () => {
      expect(tracker.getKFactor({ team1: 23, team2: 21 }, 1)).toBe(LevelTrackerConfig.K_DEFAULT);
    });

    it('returns K_SCALE[0].k for a close win (loser 18–20)', () => {
      expect(tracker.getKFactor({ team1: 21, team2: 19 }, 1)).toBe(LevelTrackerConfig.K_SCALE[0].k);
    });

    it('returns K_SCALE[1].k for loser score 15–17', () => {
      expect(tracker.getKFactor({ team1: 21, team2: 16 }, 1)).toBe(LevelTrackerConfig.K_SCALE[1].k);
    });

    it('returns K_MAX for a dominant win (loser < 6)', () => {
      expect(tracker.getKFactor({ team1: 21, team2: 3 }, 1)).toBe(LevelTrackerConfig.K_MAX);
    });

    it('scales K by balance factor for an unbalanced team', () => {
      const team = [makePlayer('a', 0), makePlayer('b', 100)];
      expect(tracker.getKFactor(undefined, undefined, team)).toBe(LevelTrackerConfig.K_DEFAULT * LevelTrackerConfig.BALANCE_FACTOR_FLOOR);
    });

    it('does not reduce K for a singles (1-player) team', () => {
      const team = [makePlayer('a', 80)];
      expect(tracker.getKFactor(undefined, undefined, team)).toBe(LevelTrackerConfig.K_DEFAULT);
    });
  });

  describe('max level swing', () => {
    it('equal teams, dominant win (21-0): |delta| < 10', () => {
      const p1 = makePlayer('p1', 50);
      const p2 = makePlayer('p2', 50);
      const court = makeCourt([p1], [p2], 1, { team1: 21, team2: 0 });
      const [updated] = tracker.updatePlayersLevels([court], [p1, p2]);
      const delta = Math.abs((updated.level ?? 50) - 50);
      expect(delta).toBeLessThan(10);
    });

    it('extreme mismatch upset (team1=[100] vs team2=[0], team2 wins 21-0): |delta| < 10', () => {
      const p1 = makePlayer('p1', 100);
      const p2 = makePlayer('p2', 0);
      const court = makeCourt([p1], [p2], 2, { team1: 0, team2: 21 });
      const result = tracker.updatePlayersLevels([court], [p1, p2]);
      const p1Updated = result.find(p => p.id === 'p1')!;
      const delta = Math.abs((p1Updated.level ?? 100) - 100);
      expect(delta).toBeLessThan(10);
    });

    it('no score, equal teams: |delta| ≤ 2', () => {
      const p1 = makePlayer('p1', 50);
      const p2 = makePlayer('p2', 50);
      const court = makeCourt([p1], [p2], 1);
      const [updated] = tracker.updatePlayersLevels([court], [p1, p2]);
      const delta = Math.abs((updated.level ?? 50) - 50);
      expect(delta).toBeLessThanOrEqual(2);
    });
  });

  describe('getLevelTrend', () => {
    it.each([
      ['no history',                    new Map(),                              null],
      ['single entry',                  new Map([['p1', [50]]]),                null],
      ['unchanged level',               new Map([['p1', [50, 50]]]),            null],
      ['level went up',                 new Map([['p1', [50, 51]]]),            'up'],
      ['level went down',               new Map([['p1', [50, 49]]]),            'down'],
      ['only last two entries matter',  new Map([['p1', [40, 60, 55]]]),        'down'],
    ] as const)('%s', (_label, history, expected) => {
      expect(tracker.getLevelTrend('p1', history)).toEqual(expected);
    });
  });

  describe('updatePlayersLevels — averageScore', () => {
    let p1: Player;
    let p2: Player;
    beforeEach(() => {
      p1 = makePlayer('p1', 50);
      p2 = makePlayer('p2', 50);
    });

    it('caps the winner score at 21', () => {
      const court = makeCourt([p1], [p2], 1, { team1: 23, team2: 21 });
      const [updated] = tracker.updatePlayersLevels([court], [p1, p2]);
      expect(updated.averageScore).toBe(21);
      expect(updated.scoredGames).toBe(1);
    });

    it('caps the loser score at 20 to prevent deuce inflation', () => {
      const court = makeCourt([p1], [p2], 1, { team1: 23, team2: 21 });
      const result = tracker.updatePlayersLevels([court], [p1, p2]);
      const p2Updated = result.find(p => p.id === 'p2')!;
      expect(p2Updated.averageScore).toBe(20);
      expect(p2Updated.scoredGames).toBe(1);
    });

    it('does not cap a normal loser score below 20', () => {
      const court = makeCourt([p1], [p2], 1, { team1: 21, team2: 15 });
      const result = tracker.updatePlayersLevels([court], [p1, p2]);
      const p2Updated = result.find(p => p.id === 'p2')!;
      expect(p2Updated.averageScore).toBe(15);
    });

    it('uses fresh player level, not court-snapshot level, for Elo calculation', () => {
      const p1 = makePlayer('p1', 50);
      const p2 = makePlayer('p2', 50);
      const court = makeCourt([p1], [p2], 1, { team1: 21, team2: 10 });

      const p1Edited = { ...p1, level: 90 };
      const result = tracker.updatePlayersLevels([court], [p1Edited, p2]);

      const p1Result = result.find(p => p.id === 'p1')!;
      const p2Result = result.find(p => p.id === 'p2')!;

      const p1Delta = (p1Result.level ?? 90) - 90;
      const p2Delta = (p2Result.level ?? 50) - 50;
      expect(p1Delta).toBeGreaterThan(0);
      expect(p1Delta).toBeLessThan(6);
      expect(p2Delta).toBeLessThan(0);
    });

    it('accumulates average score correctly across multiple games', () => {
      const c1 = makeCourt([p1], [p2], 1, { team1: 21, team2: 15 });
      const c2 = makeCourt([p1], [p2], 1, { team1: 23, team2: 21 });

      const after1 = tracker.updatePlayersLevels([c1], [p1, p2]);
      const after2 = tracker.updatePlayersLevels([c2], after1);

      const p2Final = after2.find(p => p.id === 'p2')!;
      expect(p2Final.averageScore).toBe(17.5);
      expect(p2Final.scoredGames).toBe(2);
    });
  });
});
