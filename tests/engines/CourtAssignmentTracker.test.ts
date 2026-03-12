import { beforeEach, describe, expect, it } from 'vitest';

import { engineSA } from '../../src/engines/SimulatedAnnealingEngine';
import type { Court, Player } from '../../src/types';

function makePlayer(id: string, name = `Player ${id}`, level?: number): Player {
  return { id, name, isPresent: true, level };
}

function makeCourt(team1: Player[], team2: Player[], winner: 1 | 2): Court {
  return {
    courtNumber: 1,
    players: [...team1, ...team2],
    teams: { team1, team2 },
    winner,
  };
}

describe('CourtAssignmentTracker.getRankDeltas', () => {
  beforeEach(() => {
    engineSA.resetHistory();
    localStorage.clear();
  });

  describe('normal mode (sortByLevel=false)', () => {
    it('returns empty map when no wins snapshot exists', () => {
      const players = [makePlayer('A'), makePlayer('B'), makePlayer('C'), makePlayer('D')];
      engineSA.recordWins([makeCourt([players[0], players[1]], [players[2], players[3]], 1)]);

      const deltas = engineSA.getRankDeltas(players, false);
      expect(deltas.size).toBe(0);
    });

    it('returns empty map when wins are unchanged since snapshot', () => {
      const players = [makePlayer('A'), makePlayer('B'), makePlayer('C'), makePlayer('D')];
      engineSA.recordWins([makeCourt([players[0], players[1]], [players[2], players[3]], 1)]);
      engineSA.recordLevelSnapshot(players);

      // No additional wins — snapshot equals current wins
      const deltas = engineSA.getRankDeltas(players, false);
      expect(deltas.size).toBe(0);
    });

    it('returns positive delta for a player who moved up', () => {
      // 4 players: A, B, C, D
      const [A, B, C, D] = [makePlayer('A', 'Alice'), makePlayer('B', 'Bob'), makePlayer('C', 'Charlie'), makePlayer('D', 'Diana')];
      const players = [A, B, C, D];

      // Round 1: A+B beat C+D → A=1win, B=1win, C=0, D=0 (C=1loss, D=1loss)
      // Leaderboard rank: A=1, B=2 (alpha), C and D no wins (not shown)
      engineSA.recordWins([makeCourt([A, B], [C, D], 1)]);
      // Snapshot: A=1win, B=1win
      engineSA.recordLevelSnapshot(players);

      // Round 2: C+D beat A+B → A=1win, B=1win, C=1win, D=1win
      engineSA.recordWins([{ ...makeCourt([C, D], [A, B], 1), courtNumber: 2 }]);

      // Now rank by wins: all 4 at 1 win → alpha order: A(1), B(2), C(3), D(4)
      // Previous rank (from snapshot): A=1, B=2 (C and D had 0 wins, not in prev)
      // C and D are new entrants — no prev rank → no delta
      // A and B: same rank → no delta
      const deltas = engineSA.getRankDeltas(players, false);
      // A and B should have no delta since rank didn't change (or prev rank unavailable for C/D)
      expect(deltas.get('A')).toBeUndefined();
      expect(deltas.get('B')).toBeUndefined();
    });

    it('returns correct rank deltas when a player overtakes another', () => {
      const [A, B, C, D] = [makePlayer('A', 'Alice'), makePlayer('B', 'Bob'), makePlayer('C', 'Charlie'), makePlayer('D', 'Diana')];
      const players = [A, B, C, D];

      // Round 1: C+D beat A+B → C=1win, D=1win; A=0win, B=0win
      engineSA.recordWins([makeCourt([C, D], [A, B], 1)]);
      // Snapshot: C=1, D=1 (rank: C=1 (Charlie<Diana alpha), D=2)
      engineSA.recordLevelSnapshot(players);

      // Round 2: A+B beat C+D → A=1win, B=1win, C=1win, D=1win; all tied
      engineSA.recordWins([{ ...makeCourt([A, B], [C, D], 1), courtNumber: 2 }]);

      // Current rank: A=1, B=2, C=3, D=4 (all 1 win, sorted by name)
      // Previous rank (from snapshot wins C=1, D=1 with A=0, B=0):
      //   Only C and D had wins in prev state. A and B had 0 (no delta possible for them)
      // C prev rank=1, curr rank=3 → delta=1-3=-2 (moved down)
      // D prev rank=2, curr rank=4 → delta=2-4=-2 (moved down)
      const deltas = engineSA.getRankDeltas(players, false);
      expect(deltas.get('C')).toBe(-2);
      expect(deltas.get('D')).toBe(-2);
      // A and B have no prev rank in snapshot (prevWins was 0 = current wins when they had no wins)
      // Actually they have prevWins=0 which equals current wins (1) — wait no.
      // After recordLevelSnapshot: winsSnapshotMap has A=0, B=0, C=1, D=1
      // After round 2: winCountMap has A=1, B=1, C=1, D=1
      // For A: prevWins=0, p.wins=1 → prevWins !== p.wins → included in prevStats with wins=0
      // But filter p.wins > 0 || p.losses > 0 applies to withStats (current stats)
      // A has wins=1 currently, so A is in withStats. prevStats for A: prevWins=0 !== 1 → [{ ...A, wins: 0 }]
      // B same.
      // prevStats = [A(wins=0), B(wins=0), C(wins=1), D(wins=1)]
      // prevRank sorted by wins DESC + alpha: C(1), D(1), A(0), B(0) → C=1, D=2, A=3, B=4
      // currentRank: A(1), B(1), C(1), D(1) → A=1, B=2, C=3, D=4
      // delta for A: prevRank=3, currRank=1 → 3-1=2
      // delta for B: prevRank=4, currRank=2 → 4-2=2
      expect(deltas.get('A')).toBe(2);
      expect(deltas.get('B')).toBe(2);
    });
  });

  describe('smart mode (sortByLevel=true)', () => {
    it('returns empty map when level history has fewer than 2 entries for all players', () => {
      const players = [makePlayer('A', 'Alice', 60), makePlayer('B', 'Bob', 40), makePlayer('C', 'C', 50), makePlayer('D', 'D', 50)];
      engineSA.recordWins([makeCourt([players[0], players[1]], [players[2], players[3]], 1)]);
      // Only 1 snapshot entry → no deltas
      engineSA.recordLevelSnapshot(players);

      const deltas = engineSA.getRankDeltas(players, true);
      expect(deltas.size).toBe(0);
    });

    it('returns deltas after two level snapshots when level changes', () => {
      const [A, B, C, D] = [
        makePlayer('A', 'Alice', 60),
        makePlayer('B', 'Bob', 40),
        makePlayer('C', 'Charlie', 55),
        makePlayer('D', 'Diana', 35),
      ];
      const players = [A, B, C, D];

      // Round 1: A+B beat C+D
      engineSA.recordWins([makeCourt([A, B], [C, D], 1)]);
      // 1st snapshot: levels are [60,40,55,35]
      engineSA.recordLevelSnapshot(players);

      // Level changes: C jumps to 70 (above A), A stays 60
      const updatedPlayers = [
        { ...A, level: 60 },
        { ...B, level: 40 },
        { ...C, level: 70 },
        { ...D, level: 35 },
      ];

      // Round 2 win: C+D beat A+B
      engineSA.recordWins([{ ...makeCourt([C, D], [A, B], 1), courtNumber: 2 }]);
      // 2nd snapshot: levels are [60,40,70,35]
      engineSA.recordLevelSnapshot(updatedPlayers);

      // Current rank by level DESC: C(70)=1, A(60)=2, B(40)=3, D(35)=4
      // Prev rank by level from history[-2]: A(60)=1, C(55)=2, B(40)=3, D(35)=4
      // delta for A: prev=1, curr=2 → -1 (moved down)
      // delta for C: prev=2, curr=1 → +1 (moved up)
      const deltas = engineSA.getRankDeltas(updatedPlayers, true);
      expect(deltas.get('A')).toBe(-1);
      expect(deltas.get('C')).toBe(1);
      // B and D unchanged
      expect(deltas.get('B')).toBe(0);
      expect(deltas.get('D')).toBe(0);
    });
  });
});
