import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect } from 'vitest';

import { engineSA } from '../src/engines/SimulatedAnnealingEngine';

/** Common test data used across multiple test files */
export const COMMON_PLAYERS = {
  FOUR: 'Alice\nBob\nCharlie\nDiana',
  SIX: 'Alice\nBob\nCharlie\nDiana\nEve\nFrank',
  EIGHT: 'Alice\nBob\nCharlie\nDiana\nEve\nFrank\nGrace\nHank',
};

/** Common setup/teardown used across multiple test files */
export const clearTestState = async (): Promise<void> => {
  localStorage.clear();
  await act(async () => {
    engineSA.resetHistory();
    await new Promise(resolve => setTimeout(resolve, 0));
  });
};

/** Waits for the App to finish its async initial load */
export const waitForAppLoad = async (): Promise<void> => {
  await waitFor(
    () => expect(document.querySelector('[data-loaded="true"]')).toBeTruthy(),
    { timeout: 5000 },
  );
};

/**
 * Flush one full macrotask boundary so that all pending microtask chains
 * (e.g. async StorageManager saves) complete before the caller continues.
 * One setTimeout(0) is enough: the JS event loop drains the entire microtask
 * queue – including deeply-nested chains – before running a macrotask.
 */
export const flushPendingSaves = (): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, 0));

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
  // Flush any remaining async save microtasks (serialised queue may still be
  // draining after the act() callback's 50 ms timer)
  await flushPendingSaves();
  // Verify that player data is actually persisted (key may already exist from
  // the initial-load save of empty state, so we must check the content)
  await waitFor(() => {
    const raw = localStorage.getItem('badminton-state');
    if (!raw) throw new Error('No storage data');
    // Mock CompressionStream stores btoa(utf8_binary_of_json); decode it
    const binary = atob(raw);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    const state = JSON.parse(json) as { app?: { players?: unknown[] } };
    if (!state?.app?.players?.length) throw new Error('Players not yet saved');
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
  // Wait for the async save to complete
  await waitFor(() => expect(localStorage.getItem('badminton-state')).toBeTruthy());
};
