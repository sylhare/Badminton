import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen } from '@testing-library/react';

import { useAppState } from '../../src/hooks/usePlayers';
import { engine } from '../../src/engines/engineSelector';
import { renderWithAppState } from '../shared';

const { mockLoadApp, mockSaveApp } = vi.hoisted(() => ({
  mockLoadApp: vi.fn(),
  mockSaveApp: vi.fn(),
}));

vi.mock('../../src/utils/StorageManager', () => ({
  MAX_LEVEL_HISTORY_ENTRIES: 50,
  storageManager: {
    loadApp: mockLoadApp,
    saveApp: mockSaveApp,
    loadEngine: vi.fn().mockResolvedValue({}),
    saveEngine: vi.fn(),
    clearAll: vi.fn(),
    loadTournament: vi.fn().mockResolvedValue(null),
    saveTournament: vi.fn(),
    waitForQueue: vi.fn().mockResolvedValue(undefined),
  },
}));

const mockPlayers = [
  { id: 'p1', name: 'Alice', isPresent: true },
  { id: 'p2', name: 'Bob', isPresent: true },
];

function TestConsumer({ onMount }: { onMount?: (ctx: ReturnType<typeof useAppState>) => void }) {
  const ctx = useAppState();
  React.useEffect(() => {
    if (ctx.isLoaded && onMount) onMount(ctx);
  }, [ctx.isLoaded]);
  return (
    <div>
      <span data-testid="player-count">{ctx.players.length}</span>
      <span data-testid="is-loaded">{ctx.isLoaded ? 'loaded' : 'loading'}</span>
    </div>
  );
}

describe('AppStateProvider / useAppState', () => {
  beforeEach(() => {
    mockLoadApp.mockResolvedValue({ players: mockPlayers, isSmartEngineEnabled: false });
    mockSaveApp.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
    engine().resetHistory();
  });

  it('loads players from storage on mount', async () => {
    renderWithAppState(<TestConsumer />);

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    expect(screen.getByTestId('player-count')).toHaveTextContent('2');
    expect(screen.getByTestId('is-loaded')).toHaveTextContent('loaded');
  });

  describe('applyCourtResults', () => {
    it('calls engine().recordWins for courts with winners', async () => {
      const recordWinsSpy = vi.spyOn(engine(), 'recordWins');

      let capturedCtx: ReturnType<typeof useAppState> | null = null;
      renderWithAppState(
        <TestConsumer onMount={ctx => { capturedCtx = ctx; }} />,
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      const court = {
        courtNumber: 1,
        players: mockPlayers,
        teams: { team1: [mockPlayers[0]], team2: [mockPlayers[1]] },
        winner: 1 as const,
      };

      act(() => {
        capturedCtx!.applyCourtResults([court]);
      });

      expect(recordWinsSpy).toHaveBeenCalledWith([court]);
      recordWinsSpy.mockRestore();
    });

    it('calls engine().recordLevelSnapshot after updating levels', async () => {
      const snapshotSpy = vi.spyOn(engine(), 'recordLevelSnapshot');

      let capturedCtx: ReturnType<typeof useAppState> | null = null;
      renderWithAppState(
        <TestConsumer onMount={ctx => { capturedCtx = ctx; }} />,
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      const court = {
        courtNumber: 1,
        players: mockPlayers,
        teams: { team1: [mockPlayers[0]], team2: [mockPlayers[1]] },
        winner: 1 as const,
      };

      act(() => {
        capturedCtx!.applyCourtResults([court]);
      });

      expect(snapshotSpy).toHaveBeenCalled();
      snapshotSpy.mockRestore();
    });

    it('does not call recordWins when no courts have winners', async () => {
      const recordWinsSpy = vi.spyOn(engine(), 'recordWins');

      let capturedCtx: ReturnType<typeof useAppState> | null = null;
      renderWithAppState(
        <TestConsumer onMount={ctx => { capturedCtx = ctx; }} />,
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      const court = {
        courtNumber: 1,
        players: mockPlayers,
        teams: { team1: [mockPlayers[0]], team2: [mockPlayers[1]] },
        winner: undefined,
      };

      act(() => {
        capturedCtx!.applyCourtResults([court]);
      });

      expect(recordWinsSpy).not.toHaveBeenCalled();
      recordWinsSpy.mockRestore();
    });
  });
});
