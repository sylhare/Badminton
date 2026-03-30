import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import App from '../src/App';

import { addPlayers, clearTestState, generateAndWaitForAssignments, renderWithProvider } from './shared';

describe('App Persistence Integration', () => {
  const user = userEvent.setup();

  beforeEach(async () => await clearTestState());

  afterEach(async () => {
    vi.restoreAllMocks();
    await clearTestState();
  });

  describe('Clear all players functionality integration', () => {
    it('should not clear data when clear all is cancelled', async () => {
      renderWithProvider(<App />);

      await addPlayers(user, 'Alice,Bob,Charlie,Diana');

      await user.click(screen.getByTestId('clear-all-button'));

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByText('Charlie')).toBeInTheDocument();
      expect(screen.getByText('Diana')).toBeInTheDocument();
    });
  });

  describe('Error handling in persistence', () => {
    it('should handle localStorage load errors gracefully', async () => {
      localStorage.setItem('badminton-state', 'not-valid-compressed-data');

      renderWithProvider(<App />);

      expect(screen.getByText('Manage Players')).toBeInTheDocument();
      expect(screen.getByText('Court Assignments')).toBeInTheDocument();
    });

    it('should handle localStorage save errors gracefully', async () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      renderWithProvider(<App />);

      const input = screen.getByTestId('player-entry-input');
      await act(async () => {
        await user.type(input, 'Alice');
        await user.click(screen.getByTestId('add-player-button'));
      });

      expect(screen.getByText('Alice')).toBeInTheDocument();
    });
  });

  describe('Performance and efficiency', () => {
    it('should debounce save operations when making multiple quick changes', async () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

      renderWithProvider(<App />);

      const input = screen.getByTestId('player-entry-input');
      await act(async () => {
        await user.type(input, 'Alice');
        await user.click(screen.getByTestId('add-player-button'));
      });

      await act(async () => {
        await user.type(input, 'Bob');
        await user.click(screen.getByTestId('add-player-button'));
      });

      expect(setItemSpy).toHaveBeenCalled();
    });
  });

  describe('Reset Algorithm persistence', () => {
    it('should save algorithm reset state immediately when reset button is clicked', async () => {
      renderWithProvider(<App />);

      await addPlayers(user, 'Alice,Bob,Charlie,Diana');

      await generateAndWaitForAssignments(user);

      await user.click(screen.getByText('Manage Players'));

      await waitFor(() => {
        expect(screen.getByTestId('reset-algorithm-button')).toBeInTheDocument();
      }, { timeout: 1000 });

      await user.click(screen.getByTestId('reset-algorithm-button'));
      await user.click(screen.getByTestId('confirm-modal-confirm'));

      expect(screen.getAllByText('Alice').length).toBeGreaterThan(0);
    });

    it('should handle reset algorithm when no algorithm state exists', async () => {
      renderWithProvider(<App />);

      await addPlayers(user, 'Alice,Bob,Charlie,Diana');

      await user.click(screen.getByTestId('reset-algorithm-button'));
      await user.click(screen.getByTestId('confirm-modal-confirm'));

      expect(screen.getAllByText('Alice').length).toBeGreaterThan(0);
    });

    it('should clear match assignments when reset algorithm is confirmed', async () => {
      renderWithProvider(<App />);

      await addPlayers(user, 'Alice,Bob,Charlie,Diana');
      await generateAndWaitForAssignments(user);

      expect(screen.getByTestId('court-1')).toBeInTheDocument();

      await user.click(screen.getByText('Manage Players'));

      await waitFor(() => {
        expect(screen.getByTestId('reset-algorithm-button')).toBeInTheDocument();
      }, { timeout: 1000 });

      await user.click(screen.getByTestId('reset-algorithm-button'));
      await user.click(screen.getByTestId('confirm-modal-confirm'));

      expect(screen.queryByTestId('court-1')).not.toBeInTheDocument();
    });
  });
});
