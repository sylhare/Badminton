import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect } from 'vitest';

import { resetHistory } from '../src/utils/engineSelector';

/** Common test data used across multiple test files */
export const COMMON_PLAYERS = {
  FOUR: 'Alice\nBob\nCharlie\nDiana',
  SIX: 'Alice\nBob\nCharlie\nDiana\nEve\nFrank',
  EIGHT: 'Alice\nBob\nCharlie\nDiana\nEve\nFrank\nGrace\nHank',
};

/** Common setup/teardown used across multiple test files */
export const clearTestState = (): void => {
  localStorage.clear();
  resetHistory();
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
  });
  await new Promise(resolve => setTimeout(resolve, 50));
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
};
