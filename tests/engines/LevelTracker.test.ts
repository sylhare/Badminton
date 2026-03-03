import { beforeEach, describe, expect, it } from 'vitest';

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
  let tracker: LevelTracker;
  beforeEach(() => { tracker = new LevelTracker(); });

  describe('getKFactor', () => {
    it('returns 6 when no score is provided', () => {
      expect(tracker.getKFactor()).toBe(6);
    });

    it('returns 6 for a deuce win (winner score ≠ 21)', () => {
      expect(tracker.getKFactor({ team1: 23, team2: 21 }, 1)).toBe(6);
    });

    it('returns 8 for a close win (loser 18–20)', () => {
      expect(tracker.getKFactor({ team1: 21, team2: 19 }, 1)).toBe(8);
    });

    it('returns 12 for loser score 15–17', () => {
      expect(tracker.getKFactor({ team1: 21, team2: 16 }, 1)).toBe(12);
    });

    it('returns 24 for a dominant win (loser < 6)', () => {
      expect(tracker.getKFactor({ team1: 21, team2: 3 }, 1)).toBe(24);
    });

    it('scales K by balance factor for an unbalanced team', () => {
      const team = [makePlayer('a', 0), makePlayer('b', 100)];
      expect(tracker.getKFactor(undefined, undefined, team)).toBe(3);
    });

    it('does not reduce K for a singles (1-player) team', () => {
      const team = [makePlayer('a', 80)];
      expect(tracker.getKFactor(undefined, undefined, team)).toBe(6);
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
