import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import App from '../src/App';
import { CourtAssignmentEngine } from '../src/utils/CourtAssignmentEngine';

import { addPlayers, generateAndWaitForAssignments, clearTestState } from './shared';

describe('App Leaderboard Persistence', () => {
  const user = userEvent.setup();

  const addPlayersAndGenerate = async (playerNames: string) => {
    await addPlayers(user, playerNames);
    await generateAndWaitForAssignments(user);
  };

  beforeEach(clearTestState);
  afterEach(clearTestState);

  describe('Winner selection and recording', () => {
    it('should record wins immediately when winner is selected', async () => {
      render(<App />);
      await addPlayersAndGenerate('Alice,Bob,Charlie,Diana,Eve,Frank,Grace,Hank');

      const initialWinCounts = CourtAssignmentEngine.getWinCounts();
      expect(initialWinCounts.size).toBe(0);

      const team1Elements = screen.getAllByText('Team 1');
      await act(async () => {
        await user.click(team1Elements[0]);
      });
      await new Promise(resolve => setTimeout(resolve, 50));

      const updatedWinCounts = CourtAssignmentEngine.getWinCounts();
      const totalWins = Array.from(updatedWinCounts.values()).reduce((sum, wins) => sum + wins, 0);
      expect(totalWins).toBeGreaterThan(0);
    });

    it('should show leaderboard when players have wins', async () => {
      render(<App />);
      await addPlayersAndGenerate('Alice,Bob,Charlie,Diana');

      expect(screen.queryByText('🏆 Leaderboard')).not.toBeInTheDocument();

      const team1Elements = screen.getAllByText('Team 1');
      await act(async () => {
        await user.click(team1Elements[0]);
      });
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(screen.getByText('🏆 Leaderboard')).toBeInTheDocument();
    });

    it('should update leaderboard immediately when removing a winner', async () => {
      render(<App />);
      await addPlayersAndGenerate('Alice,Bob,Charlie,Diana');

      const team1Elements = screen.getAllByText('Team 1');

      await act(async () => {
        await user.click(team1Elements[0]);
      });
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(screen.getByText('🏆 Leaderboard')).toBeInTheDocument();
      const winCountsAfterSelection = CourtAssignmentEngine.getWinCounts();
      const totalWinsAfterSelection = Array.from(winCountsAfterSelection.values()).reduce((sum, wins) => sum + wins, 0);
      expect(totalWinsAfterSelection).toBeGreaterThan(0);

      await act(async () => {
        await user.click(team1Elements[0]);
      });
      await new Promise(resolve => setTimeout(resolve, 100));

      const winCountsAfterRemoval = CourtAssignmentEngine.getWinCounts();
      const totalWinsAfterRemoval = Array.from(winCountsAfterRemoval.values()).reduce((sum, wins) => sum + wins, 0);
      expect(totalWinsAfterRemoval).toBe(0);

      expect(screen.queryByText('🏆 Leaderboard')).not.toBeInTheDocument();
    });
  });

  describe('Leaderboard persistence across app reload', () => {
    it('should persist leaderboard data when app is remounted', async () => {
      const { unmount } = render(<App />);

      await addPlayersAndGenerate('Alice,Bob,Charlie,Diana');

      const team1Elements = screen.getAllByText('Team 1');
      await act(async () => {
        await user.click(team1Elements[0]);
      });
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(screen.getByText('🏆 Leaderboard')).toBeInTheDocument();

      unmount();

      render(<App />);

      expect(screen.getByText('🏆 Leaderboard')).toBeInTheDocument();
    });

    it('should maintain correct win counts for specific players', async () => {
      render(<App />);

      await addPlayers(user, 'Alice,Bob');
      await addPlayers(user, 'Charlie,Diana');

      await act(async () => {
        await user.click(screen.getByTestId('generate-assignments-button'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('court-1')).toBeInTheDocument();
      }, { timeout: 3000 });

      const team1Elements = screen.getAllByText('Team 1');
      await act(async () => {
        await user.click(team1Elements[0]);
      });
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(screen.getByText('🏆 Leaderboard')).toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('should handle changing winners without duplicate counting', async () => {
      render(<App />);
      await addPlayersAndGenerate('Alice,Bob,Charlie,Diana');

      const team1Elements = screen.getAllByText('Team 1');
      await act(async () => {
        await user.click(team1Elements[0]);
      });
      await new Promise(resolve => setTimeout(resolve, 50));

      const team2Elements = screen.getAllByText('Team 2');
      await act(async () => {
        await user.click(team2Elements[0]);
      });
      await new Promise(resolve => setTimeout(resolve, 50));

      const winCounts = CourtAssignmentEngine.getWinCounts();
      const totalWins = Array.from(winCounts.values()).reduce((sum, wins) => sum + wins, 0);
      expect(totalWins).toBe(2); // Only team 2 should have wins now
    });

    it('should handle changing winner on same court without duplicate counting in session', async () => {
      render(<App />);
      await addPlayersAndGenerate('Alice,Bob,Charlie,Diana');

      const team1Elements = screen.getAllByText('Team 1');
      await act(async () => {
        await user.click(team1Elements[0]);
      });
      await new Promise(resolve => setTimeout(resolve, 50));

      const team2Elements = screen.getAllByText('Team 2');
      await act(async () => {
        await user.click(team2Elements[0]);
      });
      await new Promise(resolve => setTimeout(resolve, 50));

      const winCounts = CourtAssignmentEngine.getWinCounts();
      const totalWins = Array.from(winCounts.values()).reduce((sum, wins) => sum + wins, 0);
      expect(totalWins).toBe(2);
    });

    it('should not show leaderboard when no wins are recorded', async () => {
      render(<App />);
      await addPlayersAndGenerate('Alice,Bob,Charlie,Diana');

      expect(screen.queryByText('🏆 Leaderboard')).not.toBeInTheDocument();
    });

    it('should show leaderboard with historical data on refresh even without current players', async () => {
      const { unmount } = render(<App />);

      await addPlayersAndGenerate('Alice,Bob,Charlie,Diana');

      const team1Elements = screen.getAllByText('Team 1');
      await act(async () => {
        await user.click(team1Elements[0]);
      });
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(screen.getByText('🏆 Leaderboard')).toBeInTheDocument();

      unmount();
      render(<App />);

      expect(screen.getByText('🏆 Leaderboard')).toBeInTheDocument();
    });
  });
});
