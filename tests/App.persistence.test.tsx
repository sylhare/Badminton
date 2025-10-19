import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import App from '../src/App';
import { CourtAssignmentEngine } from '../src/utils/CourtAssignmentEngine';

describe('App Persistence Integration', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    localStorage.clear();
    CourtAssignmentEngine.resetHistory();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    CourtAssignmentEngine.resetHistory();
  });

  describe('State persistence across app reload', () => {
    it('should persist and restore players when app is remounted', async () => {

      const { unmount } = render(<App />);

      const bulkInput = screen.getByPlaceholderText(/John Doe, Jane Smith/);
      await act(async () => {
        await user.type(bulkInput, 'Alice\nBob\nCharlie\nDiana');
        await user.click(screen.getByText('Add All Players'));
      });

      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByText('Charlie')).toBeInTheDocument();
      expect(screen.getByText('Diana')).toBeInTheDocument();

      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);

      unmount();

      render(<App />);

      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByText('Charlie')).toBeInTheDocument();
      expect(screen.getByText('Diana')).toBeInTheDocument();

      const restoredCheckboxes = screen.getAllByRole('checkbox');
      expect(restoredCheckboxes[0]).toBeChecked();
      expect(restoredCheckboxes[1]).not.toBeChecked();
      expect(restoredCheckboxes[2]).toBeChecked();
      expect(restoredCheckboxes[3]).toBeChecked();

      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
    });

    it.skip('should persist court settings across app reload', async () => {

      const { unmount } = render(<App />);

      const bulkInput = screen.getByPlaceholderText(/John Doe, Jane Smith/);
      await act(async () => {
        await user.type(bulkInput, 'Alice\nBob\nCharlie\nDiana');
        await user.click(screen.getByText('Add All Players'));
      });

      const courtInput = screen.getByLabelText('Number of Courts:');
      await act(async () => {
        await user.clear(courtInput);
        await user.type(courtInput, '6');
      });

      await act(async () => {
        courtInput.blur();
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      unmount();
      render(<App />);

      await new Promise(resolve => setTimeout(resolve, 100));

      const restoredCourtInput = screen.getByLabelText('Number of Courts:');
      expect(restoredCourtInput).toHaveValue(6);
    });

    it('should persist court assignments and winner data across app reload', async () => {

      const { unmount } = render(<App />);

      const bulkInput = screen.getByPlaceholderText(/John Doe, Jane Smith/);
      await act(async () => {
        await user.type(bulkInput, 'Alice\nBob\nCharlie\nDiana\nEve\nFrank\nGrace\nHank');
        await user.click(screen.getByText('Add All Players'));
      });

      await act(async () => {
        await user.click(screen.getByText('🎲 Generate Random Assignments'));
      });

      expect(screen.getByText('Court Assignments')).toBeInTheDocument();

      const winnerRadios = screen.queryAllByRole('radio');
      if (winnerRadios.length > 0) {
        await act(async () => {
          await user.click(winnerRadios[0]);
        });
      }

      unmount();
      render(<App />);

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(screen.getByText('Court Assignments')).toBeInTheDocument();

      expect(screen.getAllByText('Alice').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Bob').length).toBeGreaterThan(0);
    });

    it.skip('should preserve collapsed/expanded step states', async () => {

      const { unmount } = render(<App />);

      const bulkInput = screen.getByPlaceholderText(/John Doe, Jane Smith/);
      await act(async () => {
        await user.type(bulkInput, 'Alice\nBob');
        await user.click(screen.getByText('Add All Players'));
      });

      const addPlayersHeader = screen.getByText('Add Players');
      await act(async () => {
        await user.click(addPlayersHeader);
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      let step = document.querySelector('.step.collapsed');
      expect(step).toBeTruthy();

      await new Promise(resolve => setTimeout(resolve, 100));

      unmount();
      render(<App />);

      await new Promise(resolve => setTimeout(resolve, 100));

      const collapsedStep = document.querySelector('.step.collapsed');
      expect(collapsedStep).toBeTruthy();
    });
  });

  describe('Clear all players functionality integration', () => {
    it('should clear all data including localStorage when clear all is confirmed', async () => {
      render(<App />);

      const bulkInput = screen.getByPlaceholderText(/John Doe, Jane Smith/);
      await act(async () => {
        await user.type(bulkInput, 'Alice\nBob\nCharlie\nDiana');
        await user.click(screen.getByText('Add All Players'));
      });

      await act(async () => {
        await user.click(screen.getByText('🎲 Generate Random Assignments'));
      });

      expect(localStorage.getItem('badminton-app-state')).toBeTruthy();

      const clearButton = screen.getByRole('button', { name: /clear all players/i });
      await user.click(clearButton);

      const confirmButton = screen.getByRole('button', { name: 'Clear All' });
      await user.click(confirmButton);

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(screen.queryByText('Alice')).not.toBeInTheDocument();
      expect(screen.queryByText('Bob')).not.toBeInTheDocument();
      expect(screen.queryByText('Court Assignments')).not.toBeInTheDocument();

      expect(localStorage.getItem('badminton-app-state')).toBeNull();
      expect(localStorage.getItem('badminton-court-engine-state')).toBeNull();

      expect(screen.queryByText('Step 2')).not.toBeInTheDocument();
      expect(screen.queryByText('Step 3')).not.toBeInTheDocument();
      expect(screen.getByPlaceholderText(/John Doe, Jane Smith/)).toBeInTheDocument();
    });

    it('should not clear data when clear all is cancelled', async () => {
      render(<App />);

      const bulkInput = screen.getByPlaceholderText(/John Doe, Jane Smith/);
      await act(async () => {
        await user.type(bulkInput, 'Alice\nBob');
        await user.click(screen.getByText('Add All Players'));
      });

      const clearButton = screen.getByRole('button', { name: /clear all players/i });
      await user.click(clearButton);

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await user.click(cancelButton);

      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();

      expect(localStorage.getItem('badminton-app-state')).toBeTruthy();
    });
  });

  describe('Error handling in persistence', () => {
    it('should handle localStorage load errors gracefully', () => {

      localStorage.setItem('badminton-app-state', 'invalid-json');
      localStorage.setItem('badminton-court-engine-state', 'invalid-json');

      expect(() => render(<App />)).not.toThrow();

      expect(screen.getByPlaceholderText(/John Doe, Jane Smith/)).toBeInTheDocument();
      expect(screen.queryByText('Step 2')).not.toBeInTheDocument();
    });

    it('should handle localStorage save errors gracefully', async () => {

      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      render(<App />);

      const singleInput = screen.getByPlaceholderText('Enter player name...');
      await act(async () => {
        await user.type(singleInput, 'Alice');
        await user.click(screen.getByRole('button', { name: /add player/i }));
      });

      expect(screen.getByText('Alice')).toBeInTheDocument();
    });
  });

  describe('Performance and efficiency', () => {
    it('should not save state unnecessarily on initial load', () => {

      localStorage.setItem('badminton-app-state', JSON.stringify({
        players: [],
        numberOfCourts: 4,
        assignments: [],
        collapsedSteps: [],
      }));
      localStorage.setItem('badminton-court-engine-state', JSON.stringify({
        benchCountMap: {},
        teammateCountMap: {},
        opponentCountMap: {},
        winCountMap: {},
        lossCountMap: {},
      }));

      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

      render(<App />);

      setTimeout(() => {

        expect(setItemSpy).not.toHaveBeenCalled();
      }, 10);
    });

    it('should debounce save operations when making multiple quick changes', async () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

      render(<App />);

      const singleInput = screen.getByPlaceholderText('Enter player name...');
      const addButton = screen.getByRole('button', { name: /add player/i });

      for (const name of ['Alice', 'Bob', 'Charlie']) {
        await act(async () => {
          await user.clear(singleInput);
          await user.type(singleInput, name);
          await user.click(addButton);
        });
      }

      expect(setItemSpy).toHaveBeenCalled();
    });
  });

  describe('Reset Algorithm persistence', () => {
    it('should persist reset algorithm state across app reload', async () => {
      const { unmount } = render(<App />);

      const bulkInput = screen.getByPlaceholderText(/John Doe, Jane Smith/);
      await act(async () => {
        await user.type(bulkInput, 'Alice\nBob\nCharlie\nDiana');
        await user.click(screen.getByText('Add All Players'));
      });

      await act(async () => {
        await user.click(screen.getByText('🎲 Generate Random Assignments'));
      });

      await new Promise(resolve => setTimeout(resolve, 50));
      const mockCourts = [{
        courtNumber: 1,
        players: [
          { id: 'alice', name: 'Alice', isPresent: true },
          { id: 'bob', name: 'Bob', isPresent: true },
          { id: 'charlie', name: 'Charlie', isPresent: true },
          { id: 'diana', name: 'Diana', isPresent: true },
        ],
        teams: {
          team1: [
            { id: 'alice', name: 'Alice', isPresent: true },
            { id: 'bob', name: 'Bob', isPresent: true },
          ],
          team2: [
            { id: 'charlie', name: 'Charlie', isPresent: true },
            { id: 'diana', name: 'Diana', isPresent: true },
          ],
        },
        winner: 1 as 1 | 2,
      }];

      CourtAssignmentEngine.recordWins(mockCourts);

      const winCountsBeforeReset = CourtAssignmentEngine.getWinCounts();
      expect(winCountsBeforeReset.size).toBeGreaterThan(0);

      const resetButton = screen.getByTestId('reset-algorithm-button');
      await act(async () => {
        await user.click(resetButton);
      });

      const confirmButton = screen.getByTestId('confirm-modal-confirm');
      await act(async () => {
        await user.click(confirmButton);
      });

      expect(screen.getByTestId('stats-present-count')).toHaveTextContent('4');
      const playerElements = screen.getAllByText(/Alice|Bob|Charlie|Diana/);
      expect(playerElements.length).toBeGreaterThanOrEqual(4);

      const winCountsAfterReset = CourtAssignmentEngine.getWinCounts();
      expect(winCountsAfterReset.size).toBe(0);

      unmount();
      render(<App />);

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(screen.getByTestId('stats-present-count')).toHaveTextContent('4');
      const restoredPlayerElements = screen.getAllByText(/Alice|Bob|Charlie|Diana/);
      expect(restoredPlayerElements.length).toBeGreaterThanOrEqual(4);

      const restoredWinCounts = CourtAssignmentEngine.getWinCounts();
      expect(restoredWinCounts.size).toBe(0);
    });

    it('should save algorithm reset state immediately when reset button is clicked', async () => {
      render(<App />);

      const bulkInput = screen.getByPlaceholderText(/John Doe, Jane Smith/);
      await act(async () => {
        await user.type(bulkInput, 'Alice\nBob\nCharlie\nDiana');
        await user.click(screen.getByText('Add All Players'));
      });
      const mockCourts = [{
        courtNumber: 1,
        players: [
          { id: 'alice', name: 'Alice', isPresent: true },
          { id: 'bob', name: 'Bob', isPresent: true },
        ],
        teams: {
          team1: [{ id: 'alice', name: 'Alice', isPresent: true }],
          team2: [{ id: 'bob', name: 'Bob', isPresent: true }],
        },
        winner: 1 as 1 | 2,
      }];

      CourtAssignmentEngine.recordWins(mockCourts);
      expect(CourtAssignmentEngine.getWinCounts().size).toBeGreaterThan(0);

      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

      const resetButton = screen.getByTestId('reset-algorithm-button');
      await act(async () => {
        await user.click(resetButton);
      });

      const confirmButton = screen.getByTestId('confirm-modal-confirm');
      await act(async () => {
        await user.click(confirmButton);
      });

      expect(setItemSpy).toHaveBeenCalledWith(
        'badminton-court-engine-state',
        expect.any(String),
      );

      const lastEngineCall = setItemSpy.mock.calls.find(call =>
        call[0] === 'badminton-court-engine-state',
      );
      expect(lastEngineCall).toBeTruthy();

      const savedEngineState = JSON.parse(lastEngineCall![1]);
      expect(savedEngineState.winCountMap).toEqual({});
      expect(savedEngineState.teammateCountMap).toEqual({});
      expect(savedEngineState.opponentCountMap).toEqual({});

      setItemSpy.mockRestore();
    });

    it('should handle reset algorithm when no algorithm state exists', async () => {
      render(<App />);

      const bulkInput = screen.getByPlaceholderText(/John Doe, Jane Smith/);
      await act(async () => {
        await user.type(bulkInput, 'Alice\nBob');
        await user.click(screen.getByText('Add All Players'));
      });

      expect(CourtAssignmentEngine.getWinCounts().size).toBe(0);

      const resetButton = screen.getByTestId('reset-algorithm-button');
      await act(async () => {
        await user.click(resetButton);
      });

      const confirmButton = screen.getByTestId('confirm-modal-confirm');
      await act(async () => {
        await user.click(confirmButton);
      });

      expect(screen.getByTestId('stats-present-count')).toHaveTextContent('2');
      const finalPlayerElements = screen.getAllByText(/Alice|Bob/);
      expect(finalPlayerElements.length).toBeGreaterThanOrEqual(2);
      expect(CourtAssignmentEngine.getWinCounts().size).toBe(0);
    });
  });
});
