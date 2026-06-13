import { beforeEach, describe, expect, it } from 'vitest';

import { CourtAssignmentTracker } from '../../src/engines/CourtAssignmentTracker';
import { createMockPlayers } from '../data/testFactories';
import type { Court } from '../../src/types';

describe('CourtAssignmentTracker', () => {
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
