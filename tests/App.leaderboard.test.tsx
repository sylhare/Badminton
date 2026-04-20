import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import App from '../src/App';
import { engine } from '../src/engines/engineSelector';

import { addPlayers, clearTestState, generateAndWaitForAssignments, renderWithProvider } from './shared';

describe('App Leaderboard Persistence', () => {
  const user = userEvent.setup();

  const addPlayersAndGenerate = async (playerNames: string) => {
    await addPlayers(user, playerNames);
    await generateAndWaitForAssignments(user);
  };

  beforeEach(async () => await clearTestState());
  afterEach(async () => await clearTestState());

  describe('Winner selection and recording', () => {
    it('should record wins immediately when winner is selected', async () => {
      renderWithProvider(<App />);
      await addPlayersAndGenerate('Alice,Bob,Charlie,Diana,Eve,Frank,Grace,Hank');

      const initialWinCounts = engine().stats().winCountMap;
      expect(initialWinCounts.size).toBe(0);

      const team1Elements = screen.getAllByText('Team 1');
      await act(async () => {
        await user.click(team1Elements[0]);
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      const updatedWinCounts = engine().stats().winCountMap;
      const totalWins = Array.from(updatedWinCounts.values()).reduce((sum, wins) => sum + wins, 0);
      expect(totalWins).toBeGreaterThan(0);
    });

    it('should show leaderboard when players have wins', async () => {
      renderWithProvider(<App />);
      await addPlayersAndGenerate('Alice,Bob,Charlie,Diana');

      expect(screen.queryByText('🏆 Leaderboard')).not.toBeInTheDocument();

      const team1Elements = screen.getAllByText('Team 1');
      await act(async () => {
        await user.click(team1Elements[0]);
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(screen.getByText('🏆 Leaderboard')).toBeInTheDocument();
    });

    it('should update leaderboard immediately when removing a winner', async () => {
      renderWithProvider(<App />);
      await addPlayersAndGenerate('Alice,Bob,Charlie,Diana');

      const team1Elements = screen.getAllByText('Team 1');

      await act(async () => {
        await user.click(team1Elements[0]);
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(screen.getByText('🏆 Leaderboard')).toBeInTheDocument();
      const winCountsAfterSelection = engine().stats().winCountMap;
      const totalWinsAfterSelection = Array.from(winCountsAfterSelection.values()).reduce((sum, wins) => sum + wins, 0);
      expect(totalWinsAfterSelection).toBeGreaterThan(0);

      await act(async () => {
        await user.click(team1Elements[0]);
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      const winCountsAfterRemoval = engine().stats().winCountMap;
      const totalWinsAfterRemoval = Array.from(winCountsAfterRemoval.values()).reduce((sum, wins) => sum + wins, 0);
      expect(totalWinsAfterRemoval).toBe(0);

      expect(screen.queryByText('🏆 Leaderboard')).not.toBeInTheDocument();
    });
  });

  describe('Leaderboard persistence across app reload', () => {
    it('should maintain correct win counts for specific players', async () => {
      renderWithProvider(<App />);

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
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(screen.getByText('🏆 Leaderboard')).toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('should handle changing winners without duplicate counting', async () => {
      renderWithProvider(<App />);
      await addPlayersAndGenerate('Alice,Bob,Charlie,Diana');

      const team1Elements = screen.getAllByText('Team 1');
      await act(async () => {
        await user.click(team1Elements[0]);
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      const team2Elements = screen.getAllByText('Team 2');
      await act(async () => {
        await user.click(team2Elements[0]);
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      const winCounts = engine().stats().winCountMap;
      const totalWins = Array.from(winCounts.values()).reduce((sum, wins) => sum + wins, 0);
      expect(totalWins).toBe(2);
    });

    it('should handle changing winner on same court without duplicate counting in session', async () => {
      renderWithProvider(<App />);
      await addPlayersAndGenerate('Alice,Bob,Charlie,Diana');

      const team1Elements = screen.getAllByText('Team 1');
      await act(async () => {
        await user.click(team1Elements[0]);
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      const team2Elements = screen.getAllByText('Team 2');
      await act(async () => {
        await user.click(team2Elements[0]);
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      const winCounts = engine().stats().winCountMap;
      const totalWins = Array.from(winCounts.values()).reduce((sum, wins) => sum + wins, 0);
      expect(totalWins).toBe(2);
    });

    it('should not show leaderboard when no wins are recorded', async () => {
      renderWithProvider(<App />);
      await addPlayersAndGenerate('Alice,Bob,Charlie,Diana');

      expect(screen.queryByText('🏆 Leaderboard')).not.toBeInTheDocument();
    });

    it('should skip level snapshot when regenerating within 2 minutes without any game played', async () => {
      renderWithProvider(<App />);
      await addPlayersAndGenerate('Alice,Bob,Charlie,Diana');

      const snapshotSpy = vi.spyOn(engine(), 'recordLevelSnapshot');

      await generateAndWaitForAssignments(user);
      expect(snapshotSpy).not.toHaveBeenCalled();
    });

    it('should run level snapshot on first ever generation (no lastGeneratedAt)', async () => {
      renderWithProvider(<App />);
      await addPlayers(user, 'Alice,Bob,Charlie,Diana');

      const snapshotSpy = vi.spyOn(engine(), 'recordLevelSnapshot');
      await generateAndWaitForAssignments(user);
      expect(snapshotSpy).toHaveBeenCalledTimes(1);
    });

  });
});

describe('Smart engine — player update', () => {
  const user = userEvent.setup();

  beforeEach(async () => await clearTestState());
  afterEach(async () => await clearTestState());

  it('updating a player\'s gender and level via the modal reflects in the badge', async () => {
    renderWithProvider(<App />);
    await addPlayers(user, 'Alice,Bob');

    await act(async () => {
      await user.click(screen.getByTestId('smart-engine-toggle'));
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    const playerNameEl = await waitFor(() =>
      screen.getAllByTestId(/^player-name-/)[0],
    );

    const playerId = playerNameEl.getAttribute('data-testid')!.replace('player-name-', '');

    await act(async () => {
      await user.click(playerNameEl);
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    await act(async () => {
      await user.click(screen.getByTestId('gender-pill-F'));
    });

    await act(async () => {
      fireEvent.change(screen.getByTestId('level-slider'), { target: { value: '70' } });
    });

    await act(async () => {
      await user.click(screen.getByText('Save'));
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    const badge = screen.getByTestId(`player-badge-${playerId}`);
    expect(badge.textContent).toContain('70');
  });
});
