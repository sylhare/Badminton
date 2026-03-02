import { describe, expect, it } from 'vitest';

import { LevelTracker } from '../../src/engines/LevelTracker';
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
  describe('getKFactor', () => {
    it('returns 8 when no score is provided', () => {
      const tracker = new LevelTracker();
      expect(tracker.getKFactor()).toBe(8);
    });

    it('returns 6 for a deuce win (winner score ≠ 21)', () => {
      const tracker = new LevelTracker();
      expect(tracker.getKFactor({ team1: 23, team2: 21 }, 1)).toBe(6);
    });

    it('returns 8 for a close win (loser 18–20)', () => {
      const tracker = new LevelTracker();
      expect(tracker.getKFactor({ team1: 21, team2: 19 }, 1)).toBe(8);
    });

    it('returns 12 for loser score 15–17', () => {
      const tracker = new LevelTracker();
      expect(tracker.getKFactor({ team1: 21, team2: 16 }, 1)).toBe(12);
    });

    it('returns 24 for a dominant win (loser < 6)', () => {
      const tracker = new LevelTracker();
      expect(tracker.getKFactor({ team1: 21, team2: 3 }, 1)).toBe(24);
    });

    it('scales K by balance factor for an unbalanced team', () => {
      const tracker = new LevelTracker();
      const team = [makePlayer('a', 0), makePlayer('b', 100)];
      // stdDev = 50, imbalanceFactor = 1, balanceFactor = 0.5, effectiveK = 8 * 0.5 = 4
      expect(tracker.getKFactor(undefined, undefined, team)).toBe(4);
    });

    it('does not reduce K for a singles (1-player) team', () => {
      const tracker = new LevelTracker();
      const team = [makePlayer('a', 80)];
      expect(tracker.getKFactor(undefined, undefined, team)).toBe(8);
    });
  });

  describe('updatePlayersLevels — averageScore', () => {
    it('caps the winner score at 21', () => {
      const tracker = new LevelTracker();
      const p1 = makePlayer('p1', 50);
      const p2 = makePlayer('p2', 50);
      // Deuce win: winner scored 23
      const court = makeCourt([p1], [p2], 1, { team1: 23, team2: 21 });
      const [updated] = tracker.updatePlayersLevels([court], [p1, p2]);
      expect(updated.averageScore).toBe(21);
      expect(updated.scoredGames).toBe(1);
    });

    it('caps the loser score at 20 to prevent deuce inflation', () => {
      const tracker = new LevelTracker();
      const p1 = makePlayer('p1', 50);
      const p2 = makePlayer('p2', 50);
      // Deuce loss for p2: scored 21 but lost 21-23
      const court = makeCourt([p1], [p2], 1, { team1: 23, team2: 21 });
      const result = tracker.updatePlayersLevels([court], [p1, p2]);
      const p2Updated = result.find(p => p.id === 'p2')!;
      // loser scored 21 → capped to 20
      expect(p2Updated.averageScore).toBe(20);
      expect(p2Updated.scoredGames).toBe(1);
    });

    it('does not cap a normal loser score below 20', () => {
      const tracker = new LevelTracker();
      const p1 = makePlayer('p1', 50);
      const p2 = makePlayer('p2', 50);
      const court = makeCourt([p1], [p2], 1, { team1: 21, team2: 15 });
      const result = tracker.updatePlayersLevels([court], [p1, p2]);
      const p2Updated = result.find(p => p.id === 'p2')!;
      expect(p2Updated.averageScore).toBe(15);
    });

    it('accumulates average score correctly across multiple games', () => {
      const tracker = new LevelTracker();
      const p1 = makePlayer('p1', 50);
      const p2 = makePlayer('p2', 50);
      // Game 1: p1 wins 21-15
      const c1 = makeCourt([p1], [p2], 1, { team1: 21, team2: 15 });
      // Game 2: p1 wins deuce 23-21 (loser score 21 capped to 20)
      const c2 = makeCourt([p1], [p2], 1, { team1: 23, team2: 21 });

      // Update after game 1, then again after game 2 using updated players
      const after1 = tracker.updatePlayersLevels([c1], [p1, p2]);
      const after2 = tracker.updatePlayersLevels([c2], after1);

      const p2Final = after2.find(p => p.id === 'p2')!;
      // Game 1: 15, Game 2: 20 → avg = (15 + 20) / 2 = 17.5
      expect(p2Final.averageScore).toBe(17.5);
      expect(p2Final.scoredGames).toBe(2);
    });
  });
});
