import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect } from 'vitest';

import { engineSA } from '../src/engines/SimulatedAnnealingEngine';
import { AppStateProvider } from '../src/hooks/usePlayers';
import { storageManager } from '../src/utils/StorageManager';

/** Common test data used across multiple test files */
export const COMMON_PLAYERS = {
  FOUR: 'Alice\nBob\nCharlie\nDiana',
  SIX: 'Alice\nBob\nCharlie\nDiana\nEve\nFrank',
  EIGHT: 'Alice\nBob\nCharlie\nDiana\nEve\nFrank\nGrace\nHank',
};

/** Common setup/teardown used across multiple test files */
export const clearTestState = async (): Promise<void> => {
  await storageManager.waitForQueue();
  await act(async () => {
    engineSA.resetHistory();
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  await storageManager.waitForQueue();
  localStorage.clear();
};

/** Wait for all pending StorageManager writes to complete. */
export const flushPendingSaves = async (): Promise<void> => {
  await storageManager.waitForQueue();
  await new Promise(resolve => setTimeout(resolve, 0));
  await storageManager.waitForQueue();
};

/** Helper to add players via the input field */
export const addPlayers = async (
  user: ReturnType<typeof userEvent.setup>,
  playerNames: string,
): Promise<void> => {
  const input = screen.getByTestId('player-entry-input');
  await act(async () => {
    await user.type(input, playerNames);
    await user.click(screen.getByTestId('add-player-button'));
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  await flushPendingSaves();

  await waitFor(async () => {
    const state = await storageManager.loadApp();
    if (!state?.players?.length) throw new Error('Players not yet saved');
  });
};

/** Click a team element (no score modal expected, e.g. SA engine) */
export const clickTeam = async (
  user: ReturnType<typeof userEvent.setup>,
  teamElement: HTMLElement,
): Promise<void> => {
  await act(async () => {
    await user.click(teamElement);
    await new Promise(resolve => setTimeout(resolve, 50));
  });
};

/** Click a team element and confirm the score input modal */
export const clickTeamAndConfirm = async (
  user: ReturnType<typeof userEvent.setup>,
  teamElement: HTMLElement,
): Promise<void> => {
  await act(async () => {
    await user.click(teamElement);
    await new Promise(resolve => setTimeout(resolve, 50));
  });
  await act(async () => {
    await user.click(screen.getByTestId('score-modal-confirm'));
    await new Promise(resolve => setTimeout(resolve, 50));
  });
};

/** Helper to generate assignments and wait for them to appear */
export const generateAndWaitForAssignments = async (
  user: ReturnType<typeof userEvent.setup>,
): Promise<void> => {
  await act(async () => {
    await user.click(screen.getByTestId('generate-assignments-button'));
  });
  await waitFor(
    () => {
      expect(screen.getByTestId('court-1')).toBeInTheDocument();
    },
    { timeout: 3000 },
  );

  await waitFor(() => expect(localStorage.getItem('badminton-state')).toBeTruthy());
};

/** Render a component wrapped in AppStateProvider */
export function renderWithAppState(ui: React.ReactElement): ReturnType<typeof render> {
  return render(<AppStateProvider>{ui}</AppStateProvider>);
}
