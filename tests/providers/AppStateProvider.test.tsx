import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, waitFor } from '@testing-library/react';

import { useAppState } from '../../src/providers/AppStateProvider';
import type { Court, GenerateResult, Player, UpdateWinnerParams } from '../../src/types';
import { clearTestState, flushPendingSaves, renderWithProvider } from '../shared';
import { storageManager } from '../../src/utils/StorageManager';

const appState: { current: ReturnType<typeof useAppState> | null } = { current: null };
function Capture() {
  appState.current = useAppState();
  return null;
}

describe('AppStateProvider', () => {
  beforeEach(async () => {
    appState.current = null;
    await clearTestState();
  });
  afterEach(async () => await clearTestState());

  describe('generate', () => {
    it('returns a GenerateResult with a committed flag', async () => {
      renderWithProvider(<Capture />);
      await waitFor(() => expect(appState.current?.isLoaded).toBe(true));

      let courts: GenerateResult;
      act(() => { courts = appState.current!.generate([], 2, [], null); });

      expect(Array.isArray(courts!)).toBe(true);
      expect(typeof courts!.committed).toBe('boolean');
    });

    it('updates player levels when previous courts had winners', async () => {
      const alice: Player = { id: '1', name: 'Alice', isPresent: true, level: 50 };
      const bob: Player = { id: '2', name: 'Bob', isPresent: true, level: 50 };
      const courtWithWinner: Court = {
        courtNumber: 1,
        players: [alice, bob],
        teams: { team1: [alice], team2: [bob] },
        winner: 1,
      };

      renderWithProvider(<Capture />);
      await waitFor(() => expect(appState.current?.isLoaded).toBe(true));
      await act(async () => { appState.current!.setPlayers([alice, bob]); });

      act(() => { appState.current!.generate([alice, bob], 1, [courtWithWinner], null); });

      await waitFor(() => {
        expect(appState.current!.players.find(p => p.id === '1')?.level).toBeGreaterThan(50);
        expect(appState.current!.players.find(p => p.id === '2')?.level).toBeLessThan(50);
      });
    });

    it('does not update player levels on rapid re-generation', async () => {
      const alice: Player = { id: '1', name: 'Alice', isPresent: true, level: 50 };
      const bob: Player = { id: '2', name: 'Bob', isPresent: true, level: 50 };
      const courtWithWinner: Court = {
        courtNumber: 1,
        players: [alice, bob],
        teams: { team1: [alice], team2: [bob] },
        winner: 1,
      };

      renderWithProvider(<Capture />);
      await waitFor(() => expect(appState.current?.isLoaded).toBe(true));
      await act(async () => { appState.current!.setPlayers([alice, bob]); });

      act(() => { appState.current!.generate([alice, bob], 1, [courtWithWinner], null); });
      await waitFor(() => {
        expect(appState.current!.players.find(p => p.id === '1')?.level).toBeGreaterThan(50);
      });
      const aliceLevel = appState.current!.players.find(p => p.id === '1')!.level;

      act(() => { appState.current!.generate([alice, bob], 1, [courtWithWinner], null); });
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });

      expect(appState.current!.players.find(p => p.id === '1')?.level).toBe(aliceLevel);
    });
  });

  describe('updateWinner', () => {
    it('returns the courts with the winner set on the matching court', async () => {
      const court: Court = { courtNumber: 1, players: [] };
      renderWithProvider(<Capture />);
      await waitFor(() => expect(appState.current?.isLoaded).toBe(true));

      const params: UpdateWinnerParams = { courtNumber: 1, winner: 1, currentAssignments: [court] };
      let returned: Court[];
      act(() => { returned = appState.current!.updateWinner(params); });

      expect(returned!.find(c => c.courtNumber === 1)?.winner).toBe(1);
    });
  });

  describe('saveState', () => {
    it('persists state so it can be read back from storage', async () => {
      renderWithProvider(<Capture />);
      await waitFor(() => expect(appState.current?.isLoaded).toBe(true));

      await act(async () => { await appState.current!.saveState(); });
      await flushPendingSaves();

      expect(await storageManager.loadApp()).toBeDefined();
    });
  });

  describe('resetAlgorithm', () => {
    it('clears accumulated stats', async () => {
      const players: Player[] = [{ id: '1', name: 'Alice', isPresent: true }];
      renderWithProvider(<Capture />);
      await waitFor(() => expect(appState.current?.isLoaded).toBe(true));

      act(() => { appState.current!.generate(players, 2, [], null); });
      await waitFor(() => expect(appState.current!.benchCounts.size).toBeGreaterThan(0));

      await act(async () => { await appState.current!.resetAlgorithm(); });

      await waitFor(() => {
        expect(appState.current!.winCounts.size).toBe(0);
        expect(appState.current!.benchCounts.size).toBe(0);
      });
    });
  });
});
