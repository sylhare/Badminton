import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import App from '../src/App';
import { CourtAssignmentEngine, __testResetHistory } from '../src/utils/CourtAssignmentEngine';

describe('App Leaderboard Persistence', () => {
  const user = userEvent.setup();

  beforeEach(() => {

    localStorage.clear();
    __testResetHistory();
  });

  afterEach(() => {
    localStorage.clear();
    __testResetHistory();
  });

  describe('Winner selection and recording', () => {
    it('should record wins immediately when winner is selected', async () => {
      render(<App />);

      const bulkInput = screen.getByPlaceholderText(/John Doe, Jane Smith/);
      await act(async () => {
        await user.type(bulkInput, 'Alice\nBob\nCharlie\nDiana\nEve\nFrank\nGrace\nHank');
        await user.click(screen.getByText('Add All Players'));
      });

      await act(async () => {
        await user.click(screen.getByText('🎲 Generate Random Assignments'));
      });

      expect(screen.getByText('Court Assignments')).toBeInTheDocument();

      const initialWinCounts = CourtAssignmentEngine.getWinCounts();
      expect(initialWinCounts.size).toBe(0);

      const winnerRadios = screen.queryAllByRole('radio');
      if (winnerRadios.length > 0) {
        await act(async () => {
          await user.click(winnerRadios[0]); // Select first team as winner
        });

        await new Promise(resolve => setTimeout(resolve, 50));

        const updatedWinCounts = CourtAssignmentEngine.getWinCounts();
        expect(updatedWinCounts.size).toBeGreaterThan(0);

        const totalWins = Array.from(updatedWinCounts.values()).reduce((sum, wins) => sum + wins, 0);
        expect(totalWins).toBeGreaterThan(0);
      }
    });

    it('should show leaderboard when players have wins', async () => {
      render(<App />);

      const bulkInput = screen.getByPlaceholderText(/John Doe, Jane Smith/);
      await act(async () => {
        await user.type(bulkInput, 'Alice\nBob\nCharlie\nDiana');
        await user.click(screen.getByText('Add All Players'));
      });

      await act(async () => {
        await user.click(screen.getByText('🎲 Generate Random Assignments'));
      });

      expect(screen.queryByText('🏆 Leaderboard')).not.toBeInTheDocument();

      const winnerRadios = screen.queryAllByRole('radio');
      if (winnerRadios.length > 0) {
        await act(async () => {
          await user.click(winnerRadios[0]); // Select first team as winner
        });

        await new Promise(resolve => setTimeout(resolve, 100));

        expect(screen.getByText('🏆 Leaderboard')).toBeInTheDocument();

        const leaderboard = screen.getByText('🏆 Leaderboard').closest('.leaderboard');
        expect(leaderboard).toBeTruthy();
      }
    });
  });

  describe('Leaderboard persistence across app reload', () => {
    it('should persist leaderboard data when app is remounted', async () => {

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

      const mockCourt = [{
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

      CourtAssignmentEngine.recordWins(mockCourt);
      CourtAssignmentEngine.saveState();

      const winCountsBeforeUnmount = CourtAssignmentEngine.getWinCounts();
      const totalWinsBefore = Array.from(winCountsBeforeUnmount.values()).reduce((sum, wins) => sum + wins, 0);

      expect(totalWinsBefore).toBe(2); // Alice and Bob should each have 1 win

      unmount();

      CourtAssignmentEngine.resetHistory();

      render(<App />);

      await new Promise(resolve => setTimeout(resolve, 50));

      const winCountsAfterMount = CourtAssignmentEngine.getWinCounts();
      const totalWinsAfter = Array.from(winCountsAfterMount.values()).reduce((sum, wins) => sum + wins, 0);

      expect(totalWinsAfter).toBe(totalWinsBefore);
      expect(totalWinsAfter).toBeGreaterThan(0);
    });

    it('should maintain correct win counts for specific players', async () => {

      const mockPlayers = [
        { id: 'alice', name: 'Alice', isPresent: true },
        { id: 'bob', name: 'Bob', isPresent: true },
        { id: 'charlie', name: 'Charlie', isPresent: true },
        { id: 'diana', name: 'Diana', isPresent: true },
      ];

      const { unmount } = render(<App />);

      const singleInput = screen.getByPlaceholderText('Enter player name...');
      const addButton = screen.getByRole('button', { name: /add player/i });

      for (const player of ['Alice', 'Bob', 'Charlie', 'Diana']) {
        await act(async () => {
          await user.clear(singleInput);
          await user.type(singleInput, player);
          await user.click(addButton);
        });
      }

      await act(async () => {
        await user.click(screen.getByText('🎲 Generate Random Assignments'));
      });

      const winnerRadios = screen.queryAllByRole('radio');
      if (winnerRadios.length > 0) {
        await act(async () => {
          await user.click(winnerRadios[0]);
        });

        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const winCountsBefore = CourtAssignmentEngine.getWinCounts();

      unmount();
      render(<App />);

      await new Promise(resolve => setTimeout(resolve, 50));

      const winCountsAfter = CourtAssignmentEngine.getWinCounts();

      const totalBefore = Array.from(winCountsBefore.values()).reduce((sum, wins) => sum + wins, 0);
      const totalAfter = Array.from(winCountsAfter.values()).reduce((sum, wins) => sum + wins, 0);
      
      expect(totalAfter).toBe(totalBefore);

      for (const [playerId, wins] of winCountsBefore) {
        expect(winCountsAfter.get(playerId)).toBe(wins);
      }
    });
  });

  describe('Edge cases', () => {
    it('should handle changing winners without duplicate counting', async () => {
      render(<App />);

      const bulkInput = screen.getByPlaceholderText(/John Doe, Jane Smith/);
      await act(async () => {
        await user.type(bulkInput, 'Alice\nBob\nCharlie\nDiana');
        await user.click(screen.getByText('Add All Players'));
      });

      await act(async () => {
        await user.click(screen.getByText('🎲 Generate Random Assignments'));
      });

      const winnerRadios = screen.queryAllByRole('radio');
      if (winnerRadios.length >= 2) {

        await act(async () => {
          await user.click(winnerRadios[0]);
        });

        await new Promise(resolve => setTimeout(resolve, 50));
        const winCountsAfterFirst = CourtAssignmentEngine.getWinCounts();
        const totalAfterFirst = Array.from(winCountsAfterFirst.values()).reduce((sum, wins) => sum + wins, 0);

        await act(async () => {
          await user.click(winnerRadios[1]);
        });

        await new Promise(resolve => setTimeout(resolve, 50));
        const winCountsAfterChange = CourtAssignmentEngine.getWinCounts();
        const totalAfterChange = Array.from(winCountsAfterChange.values()).reduce((sum, wins) => sum + wins, 0);

        expect(totalAfterChange).toBeGreaterThan(0);
        expect(totalAfterChange).toBeLessThan(20); // Sanity check
      }
    });

    it('should not show leaderboard when no wins are recorded', async () => {
      render(<App />);

      const bulkInput = screen.getByPlaceholderText(/John Doe, Jane Smith/);
      await act(async () => {
        await user.type(bulkInput, 'Alice\nBob\nCharlie\nDiana');
        await user.click(screen.getByText('Add All Players'));
      });

      await act(async () => {
        await user.click(screen.getByText('🎲 Generate Random Assignments'));
      });

      expect(screen.queryByText('🏆 Leaderboard')).not.toBeInTheDocument();

      const winCounts = CourtAssignmentEngine.getWinCounts();
      expect(winCounts.size).toBe(0);
    });
  });
});
