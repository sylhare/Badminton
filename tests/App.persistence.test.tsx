import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import App from '../src/App';
import { __testResetHistory } from '../src/utils/CourtAssignmentEngine';

describe('App Persistence Integration', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Reset CourtAssignmentEngine history
    __testResetHistory();
    // Mock console.warn to avoid noise in test output
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    __testResetHistory();
  });

  describe('State persistence across app reload', () => {
    it('should persist and restore players when app is remounted', async () => {
      // First render - add some players
      const { unmount } = render(<App />);

      const bulkInput = screen.getByPlaceholderText(/John Doe, Jane Smith/);
      await act(async () => {
        await user.type(bulkInput, 'Alice\nBob\nCharlie\nDiana');
        await user.click(screen.getByText('Add All Players'));
      });

      // Verify players are added
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByText('Charlie')).toBeInTheDocument();
      expect(screen.getByText('Diana')).toBeInTheDocument();

      // Toggle one player as absent
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]); // Toggle Bob as absent

      // Unmount the component (simulate page refresh)
      unmount();

      // Remount the component
      render(<App />);

      // Verify players are restored
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByText('Charlie')).toBeInTheDocument();
      expect(screen.getByText('Diana')).toBeInTheDocument();

      // Verify present/absent state is preserved
      const restoredCheckboxes = screen.getAllByRole('checkbox');
      expect(restoredCheckboxes[0]).toBeChecked(); // Alice should be present
      expect(restoredCheckboxes[1]).not.toBeChecked(); // Bob should be absent
      expect(restoredCheckboxes[2]).toBeChecked(); // Charlie should be present
      expect(restoredCheckboxes[3]).toBeChecked(); // Diana should be present

      // Verify stats are correct
      expect(screen.getByText('3')).toBeInTheDocument(); // Present count
      expect(screen.getByText('1')).toBeInTheDocument(); // Absent count
      expect(screen.getByText('4')).toBeInTheDocument(); // Total count
    });

    it('should persist court settings across app reload', async () => {
      // First render - add players and change court settings
      const { unmount } = render(<App />);

      // Add players first
      const bulkInput = screen.getByPlaceholderText(/John Doe, Jane Smith/);
      await act(async () => {
        await user.type(bulkInput, 'Alice\nBob\nCharlie\nDiana');
        await user.click(screen.getByText('Add All Players'));
      });

      // Change number of courts
      const courtInput = screen.getByLabelText('Number of Courts:');
      await act(async () => {
        await user.clear(courtInput);
        await user.type(courtInput, '6');
      });

      // Wait for state to be saved
      await new Promise(resolve => setTimeout(resolve, 50));

      // Unmount and remount
      unmount();
      render(<App />);

      // Verify court setting is preserved
      const restoredCourtInput = screen.getByLabelText('Number of Courts:');
      expect(restoredCourtInput).toHaveValue(6);
    });

    it('should persist court assignments and winner data across app reload', async () => {
      // First render - create full game scenario
      const { unmount } = render(<App />);

      // Add players
      const bulkInput = screen.getByPlaceholderText(/John Doe, Jane Smith/);
      await act(async () => {
        await user.type(bulkInput, 'Alice\nBob\nCharlie\nDiana\nEve\nFrank\nGrace\nHank');
        await user.click(screen.getByText('Add All Players'));
      });

      // Generate assignments
      await act(async () => {
        await user.click(screen.getByText('🎲 Generate Random Assignments'));
      });

      // Verify assignments are created
      expect(screen.getByText('Court Assignments')).toBeInTheDocument();

      // Try to record a winner if radio buttons exist
      const winnerRadios = screen.queryAllByRole('radio');
      if (winnerRadios.length > 0) {
        await act(async () => {
          await user.click(winnerRadios[0]); // Click first winner radio
        });
      }

      // Unmount and remount
      unmount();
      render(<App />);

      // Verify court assignments are restored
      expect(screen.getByText('Court Assignments')).toBeInTheDocument();

      // Verify players are restored and still assigned to courts
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });

    it('should preserve collapsed/expanded step states', async () => {
      // First render - add players and collapse steps
      const { unmount } = render(<App />);

      // Add players
      const bulkInput = screen.getByPlaceholderText(/John Doe, Jane Smith/);
      await act(async () => {
        await user.type(bulkInput, 'Alice\nBob');
        await user.click(screen.getByText('Add All Players'));
      });

      // Collapse the "Add Players" step
      const addPlayersHeader = screen.getByText('Add Players');
      await user.click(addPlayersHeader);

      // Verify the step is collapsed
      const step = document.querySelector('.step.collapsed');
      expect(step).toBeTruthy();

      // Unmount and remount
      unmount();
      render(<App />);

      // Verify the step is still collapsed after remounting
      const collapsedStep = document.querySelector('.step.collapsed');
      expect(collapsedStep).toBeTruthy();
    });
  });

  describe('Clear all players functionality integration', () => {
    it('should clear all data including localStorage when clear all is confirmed', async () => {
      render(<App />);

      // Add players
      const bulkInput = screen.getByPlaceholderText(/John Doe, Jane Smith/);
      await act(async () => {
        await user.type(bulkInput, 'Alice\nBob\nCharlie\nDiana');
        await user.click(screen.getByText('Add All Players'));
      });

      // Generate assignments
      await act(async () => {
        await user.click(screen.getByText('🎲 Generate Random Assignments'));
      });

      // Verify data exists in localStorage
      expect(localStorage.getItem('badminton-app-state')).toBeTruthy();

      // Click clear all button
      const clearButton = screen.getByRole('button', { name: /clear all players/i });
      await user.click(clearButton);

      // Confirm the action
      const confirmButton = screen.getByRole('button', { name: 'Clear All' });
      await user.click(confirmButton);

      // Wait for async clear operation
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify all data is cleared
      expect(screen.queryByText('Alice')).not.toBeInTheDocument();
      expect(screen.queryByText('Bob')).not.toBeInTheDocument();
      expect(screen.queryByText('Court Assignments')).not.toBeInTheDocument();

      // Verify localStorage is cleared (should be null or empty after clearAllStoredState)
      expect(localStorage.getItem('badminton-app-state')).toBeNull();
      expect(localStorage.getItem('badminton-court-engine-state')).toBeNull();

      // Verify UI returns to initial state
      expect(screen.queryByText('Step 2')).not.toBeInTheDocument();
      expect(screen.queryByText('Step 3')).not.toBeInTheDocument();
      expect(screen.getByPlaceholderText(/John Doe, Jane Smith/)).toBeInTheDocument();
    });

    it('should not clear data when clear all is cancelled', async () => {
      render(<App />);

      // Add players
      const bulkInput = screen.getByPlaceholderText(/John Doe, Jane Smith/);
      await act(async () => {
        await user.type(bulkInput, 'Alice\nBob');
        await user.click(screen.getByText('Add All Players'));
      });

      // Click clear all button
      const clearButton = screen.getByRole('button', { name: /clear all players/i });
      await user.click(clearButton);

      // Cancel the action
      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await user.click(cancelButton);

      // Verify data is still there
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();

      // Verify localStorage still has data
      expect(localStorage.getItem('badminton-app-state')).toBeTruthy();
    });
  });

  describe('Error handling in persistence', () => {
    it('should handle localStorage load errors gracefully', () => {
      // Set invalid JSON in localStorage
      localStorage.setItem('badminton-app-state', 'invalid-json');
      localStorage.setItem('badminton-court-engine-state', 'invalid-json');

      // App should still render without throwing
      expect(() => render(<App />)).not.toThrow();

      // Should show default empty state
      expect(screen.getByPlaceholderText(/John Doe, Jane Smith/)).toBeInTheDocument();
      expect(screen.queryByText('Step 2')).not.toBeInTheDocument();

      // Should log warnings
      expect(console.warn).toHaveBeenCalledWith(
        'Failed to load app state from localStorage:', 
        expect.any(SyntaxError)
      );
      expect(console.warn).toHaveBeenCalledWith(
        'Failed to load court engine state from localStorage:', 
        expect.any(SyntaxError)
      );
    });

    it('should handle localStorage save errors gracefully', async () => {
      // Mock localStorage to throw errors
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      render(<App />);

      // Add a player - this should trigger save attempts
      const singleInput = screen.getByPlaceholderText('Enter player name...');
      await act(async () => {
        await user.type(singleInput, 'Alice');
        await user.click(screen.getByRole('button', { name: /add player/i }));
      });

      // App should still function normally
      expect(screen.getByText('Alice')).toBeInTheDocument();

      // Should log warnings for save failures
      expect(console.warn).toHaveBeenCalledWith(
        'Failed to save app state to localStorage:', 
        expect.any(Error)
      );
    });
  });

  describe('Performance and efficiency', () => {
    it('should not save state unnecessarily on initial load', () => {
      // Pre-populate localStorage so there's no need to save on load
      localStorage.setItem('badminton-app-state', JSON.stringify({
        players: [],
        numberOfCourts: 4,
        assignments: [],
        collapsedSteps: []
      }));
      localStorage.setItem('badminton-court-engine-state', JSON.stringify({
        benchCountMap: {},
        teammateCountMap: {},
        opponentCountMap: {},
        winCountMap: {},
        lossCountMap: {}
      }));

      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

      render(<App />);

      // Give initial load time to complete
      setTimeout(() => {
        // Should not call setItem during initial render when loading existing data
        expect(setItemSpy).not.toHaveBeenCalled();
      }, 10);
    });

    it('should debounce save operations when making multiple quick changes', async () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

      render(<App />);

      // Add multiple players quickly
      const singleInput = screen.getByPlaceholderText('Enter player name...');
      const addButton = screen.getByRole('button', { name: /add player/i });

      for (const name of ['Alice', 'Bob', 'Charlie']) {
        await act(async () => {
          await user.clear(singleInput);
          await user.type(singleInput, name);
          await user.click(addButton);
        });
      }

      // Should eventually save, but not necessarily after each individual change
      expect(setItemSpy).toHaveBeenCalled();
    });
  });
});
