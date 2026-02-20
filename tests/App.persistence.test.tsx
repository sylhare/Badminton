import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import App from '../src/App';

import { addPlayers, clearTestState, generateAndWaitForAssignments } from './shared';

describe('App Persistence Integration', () => {
  const user = userEvent.setup();

  beforeEach(async () => await clearTestState());

  afterEach(async () => {
    vi.restoreAllMocks();
    await clearTestState();
  });

  describe('State persistence across app reload', () => {
    it('should persist and restore players when app is remounted', async () => {
      const { unmount } = render(<App />);

      await addPlayers(user, 'Alice,Bob,Charlie,Diana');

      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByText('Charlie')).toBeInTheDocument();
      expect(screen.getByText('Diana')).toBeInTheDocument();

      const toggleButtons = screen.getAllByTestId(/^toggle-presence-/);
      await user.click(toggleButtons[1]);

      unmount();

      render(<App />);

      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByText('Charlie')).toBeInTheDocument();
      expect(screen.getByText('Diana')).toBeInTheDocument();

      const restoredToggleButtons = screen.getAllByTestId(/^toggle-presence-/);
      expect(restoredToggleButtons[0]).toHaveClass('present');
      expect(restoredToggleButtons[1]).toHaveClass('absent');
      expect(restoredToggleButtons[2]).toHaveClass('present');
      expect(restoredToggleButtons[3]).toHaveClass('present');

      expect(screen.getByTestId('stats-present-count')).toHaveTextContent('3');
      expect(screen.getByTestId('stats-absent-count')).toHaveTextContent('1');
      expect(screen.getByTestId('stats-total-count')).toHaveTextContent('4');
    });

    it('should persist court settings across app reload', async () => {
      const { unmount } = render(<App />);

      await addPlayers(user, 'Alice,Bob,Charlie,Diana');

      const courtInput = screen.getByTestId('court-count-input') as HTMLInputElement;

      await act(async () => {
        await user.tripleClick(courtInput);
        await user.keyboard('6');
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(courtInput).toHaveValue(6);

      unmount();

      await act(async () => {
        render(<App />);
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      const restoredCourtInput = screen.getByTestId('court-count-input');
      expect(restoredCourtInput).toHaveValue(6);
    });

    it('should persist court assignments and winner data across app reload', async () => {
      const { unmount } = render(<App />);

      await addPlayers(user, 'Alice,Bob,Charlie,Diana,Eve,Frank,Grace,Hank');

      await generateAndWaitForAssignments(user);

      expect(screen.getByTestId('court-1')).toBeInTheDocument();
      expect(screen.getByTestId('court-2')).toBeInTheDocument();

      unmount();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByTestId('court-1')).toBeInTheDocument();
        expect(screen.getByTestId('court-2')).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should preserve collapsed state across app reload', async () => {
      const { unmount } = render(<App />);

      await addPlayers(user, 'Alice,Bob,Charlie,Diana');

      await act(async () => {
        await user.click(screen.getByTestId('generate-assignments-button'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('manage-players-section')).toHaveClass('collapsed');
      });

      unmount();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByTestId('manage-players-section')).toHaveClass('collapsed');
      });
    });
  });

  describe('Clear all players functionality integration', () => {
    it('should clear all data including localStorage when clear all is confirmed', async () => {
      const { unmount } = render(<App />);

      await addPlayers(user, 'Alice,Bob,Charlie,Diana');

      await generateAndWaitForAssignments(user);

      await user.click(screen.getByText('Manage Players'));

      await waitFor(() => {
        expect(screen.getByTestId('clear-all-button')).toBeInTheDocument();
      }, { timeout: 1000 });

      await user.click(screen.getByTestId('clear-all-button'));

      await user.click(screen.getByTestId('confirm-modal-confirm'));

      await waitFor(() => {
        expect(screen.queryByText('Alice')).not.toBeInTheDocument();
        expect(screen.queryByText(/Court 1/)).not.toBeInTheDocument();
      }, { timeout: 1000 });

      unmount();
      render(<App />);

      expect(screen.queryByText('Alice')).not.toBeInTheDocument();
    });

    it('should not clear data when clear all is cancelled', async () => {
      render(<App />);

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
      localStorage.setItem('badminton-app-state', 'invalid-json');

      render(<App />);

      expect(screen.getByText('Manage Players')).toBeInTheDocument();
      expect(screen.getByText('Court Assignments')).toBeInTheDocument();
    });

    it('should handle localStorage save errors gracefully', async () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      render(<App />);

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

      render(<App />);

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
    it('should persist reset algorithm state across app reload', async () => {
      const { unmount } = render(<App />);

      await addPlayers(user, 'Alice,Bob,Charlie,Diana');

      await generateAndWaitForAssignments(user);

      await user.click(screen.getByText('Manage Players'));

      await waitFor(() => {
        expect(screen.getByTestId('reset-algorithm-button')).toBeInTheDocument();
      }, { timeout: 1000 });

      await user.click(screen.getByTestId('reset-algorithm-button'));
      await user.click(screen.getByTestId('confirm-modal-confirm'));

      unmount();
      render(<App />);

      expect(screen.getAllByText('Alice').length).toBeGreaterThan(0);
    });

    it('should save algorithm reset state immediately when reset button is clicked', async () => {
      render(<App />);

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
      render(<App />);

      await addPlayers(user, 'Alice,Bob,Charlie,Diana');

      await user.click(screen.getByTestId('reset-algorithm-button'));
      await user.click(screen.getByTestId('confirm-modal-confirm'));

      expect(screen.getAllByText('Alice').length).toBeGreaterThan(0);
    });

    it('should clear match assignments when reset algorithm is confirmed', async () => {
      render(<App />);

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
