import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CourtAssignmentTracker } from '../../src/engines/CourtAssignmentTracker';
import { createMockPlayers } from '../data/testFactories';
import type { Court, Player } from '../../src/types';

describe('CourtAssignmentTracker', () => {
  describe('transitionRound', () => {
    class TestTracker extends CourtAssignmentTracker {
      transition(courts: Court[], players: Player[]) {
        return this.transitionRound(courts, players);
      }
    }

    const tracker = new TestTracker();
    const players = createMockPlayers(4);
    const round1Courts: Court[] = [
      {
        courtNumber: 1,
        players,
        teams: { team1: [players[0], players[1]], team2: [players[2], players[3]] },
      },
    ];
    const round2Courts: Court[] = [
      {
        courtNumber: 1,
        players,
        teams: { team1: [players[0], players[2]], team2: [players[1], players[3]] },
      },
    ];

    beforeEach(() => {
      vi.useFakeTimers();
      tracker.resetHistory();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it.each([
      {
        scenario: 'round played no winner before debounce -> no new round added',
        hasWinner: false,
        advanceMs: CourtAssignmentTracker.REGENERATION_DEBOUNCE_MS - 1000,
        expectedNewRound: false,
        expectedRoundsPlayed: 0,
      },
      {
        scenario: 'round played no winner after debounce -> new round added',
        hasWinner: false,
        advanceMs: CourtAssignmentTracker.REGENERATION_DEBOUNCE_MS + 1000,
        expectedNewRound: true,
        expectedRoundsPlayed: 1,
      },
      {
        scenario: 'round played with winner before debounce -> new round added',
        hasWinner: true,
        advanceMs: CourtAssignmentTracker.REGENERATION_DEBOUNCE_MS - 1000,
        expectedNewRound: true,
        expectedRoundsPlayed: 1,
      },
      {
        scenario: 'round played with winner after debounce -> new round added',
        hasWinner: true,
        advanceMs: CourtAssignmentTracker.REGENERATION_DEBOUNCE_MS + 1000,
        expectedNewRound: true,
        expectedRoundsPlayed: 1,
      },
    ])('$scenario', ({ hasWinner, advanceMs, expectedNewRound, expectedRoundsPlayed }) => {
      tracker.transition(round1Courts, players);
      expect(tracker.snapshot().roundsPlayed).toBe(0);

      if (hasWinner) {
        tracker.recordWins([{ ...round1Courts[0], winner: 1 }]);
      }

      vi.advanceTimersByTime(advanceMs);

      const result = tracker.transition(round2Courts, players);

      expect(result.committed).toBe(expectedNewRound);
      expect(tracker.snapshot().roundsPlayed).toBe(expectedRoundsPlayed);
    });
  });

  describe('removePlayerHistory', () => {
    const tracker = new CourtAssignmentTracker();
    const [alice, bob, carol, dave] = createMockPlayers(4);
    const court: Court = {
      courtNumber: 1,
      players: [alice, bob, carol, dave],
      teams: { team1: [alice, bob], team2: [carol, dave] },
      winner: 1,
    };

    beforeEach(() => {
      tracker.resetHistory();
      tracker.applyRoundStats([court], [alice, bob, carol, dave]);
      tracker.recordWins([court]);
      tracker.recordLevelSnapshot([alice, bob, carol, dave]);
    });

    const pairKeysContaining = (map: Record<string, number>, playerId: string) =>
      Object.keys(map).filter(key => key.split('|').includes(playerId));

    it('removes win/loss/bench/single counts for the player', () => {
      tracker.removePlayerHistory(alice.id);

      const state = tracker.prepareStateForSaving('sa');
      expect(state.winCountMap[alice.id]).toBeUndefined();
      expect(state.lossCountMap[alice.id]).toBeUndefined();
      expect(state.benchCountMap[alice.id]).toBeUndefined();
      expect(state.singleCountMap[alice.id]).toBeUndefined();
    });

    it('removes teammate and opponent pair counts involving the player', () => {
      tracker.removePlayerHistory(alice.id);

      const state = tracker.prepareStateForSaving('sa');
      expect(pairKeysContaining(state.teammateCountMap, alice.id)).toEqual([]);
      expect(pairKeysContaining(state.opponentCountMap, alice.id)).toEqual([]);
    });

    it('removes the player level history', () => {
      tracker.removePlayerHistory(alice.id);

      const state = tracker.prepareStateForSaving('sa');
      expect(state.levelHistory?.[alice.id]).toBeUndefined();
    });

    it('keeps data of the other players', () => {
      tracker.removePlayerHistory(alice.id);

      const state = tracker.prepareStateForSaving('sa');
      expect(state.winCountMap[bob.id]).toBe(1);
      expect(state.lossCountMap[carol.id]).toBe(1);
      expect(state.teammateCountMap[[carol.id, dave.id].sort().join('|')]).toBe(1);
      expect(state.levelHistory?.[bob.id]).toBeDefined();
    });
  });
});
