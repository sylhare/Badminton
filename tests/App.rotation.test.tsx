import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import App from '../src/App';
import { engine } from '../src/engines/engineSelector';

import { addPlayers, clearTestState, generateAndWaitForAssignments } from './shared';

describe('Team rotation', () => {
  const user = userEvent.setup();

  beforeEach(async () => await clearTestState());
  afterEach(async () => await clearTestState());

  describe('Rotate button visibility', () => {
    it('shows rotate button after generating assignments', async () => {
      render(<App />);
      await addPlayers(user, 'Alice,Bob,Charlie,Diana');
      await generateAndWaitForAssignments(user);

      expect(screen.getByTestId('rotate-teams-button')).toBeInTheDocument();
    });
  });

  describe('Winner cleared on rotation', () => {
    it('clears the winner crown when rotating teams', async () => {
      render(<App />);
      await addPlayers(user, 'Alice,Bob,Charlie,Diana');
      await generateAndWaitForAssignments(user);

      // Select a winner
      const team1 = screen.getAllByText('Team 1')[0];
      await act(async () => {
        await user.click(team1);
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      expect(screen.getByText('🏆 Leaderboard')).toBeInTheDocument();
      const winsBefore = Array.from(engine().getWinCounts().values()).reduce((sum, w) => sum + w, 0);
      expect(winsBefore).toBe(2);

      // Rotate teams
      const rotateButton = screen.getByTestId('rotate-teams-button');
      await act(async () => {
        await user.click(rotateButton);
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      // Winner should be cleared — leaderboard disappears
      expect(screen.queryByText('🏆 Leaderboard')).not.toBeInTheDocument();
      const winsAfter = Array.from(engine().getWinCounts().values()).reduce((sum, w) => sum + w, 0);
      expect(winsAfter).toBe(0);
    });
  });

  describe('Winner recorded for correct pair after rotation', () => {
    it('records wins for the rotated team after rotation', async () => {
      render(<App />);
      await addPlayers(user, 'Alice,Bob,Charlie,Diana');
      await generateAndWaitForAssignments(user);

      // Rotate once so the pairs change
      const rotateButton = screen.getByTestId('rotate-teams-button');
      await act(async () => {
        await user.click(rotateButton);
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      // No winner yet
      expect(engine().getWinCounts().size).toBe(0);

      // Mark Team 1 as winner
      const team1 = screen.getAllByText('Team 1')[0];
      await act(async () => {
        await user.click(team1);
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      // Exactly 2 players should have 1 win each (the 2-player team)
      const winCounts = engine().getWinCounts();
      const winners = Array.from(winCounts.entries()).filter(([, count]) => count > 0);
      expect(winners).toHaveLength(2);
      winners.forEach(([, count]) => expect(count).toBe(1));

      const totalWins = winners.reduce((sum, [, w]) => sum + w, 0);
      expect(totalWins).toBe(2);
    });

    it('does not double-count wins when rotating after a winner was set', async () => {
      render(<App />);
      await addPlayers(user, 'Alice,Bob,Charlie,Diana');
      await generateAndWaitForAssignments(user);

      // Select team 1 as winner
      const team1 = screen.getAllByText('Team 1')[0];
      await act(async () => {
        await user.click(team1);
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      const winsAfterFirstClick = Array.from(engine().getWinCounts().values())
        .reduce((sum, w) => sum + w, 0);
      expect(winsAfterFirstClick).toBe(2);

      // Rotate — previous win should be reversed
      const rotateButton = screen.getByTestId('rotate-teams-button');
      await act(async () => {
        await user.click(rotateButton);
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      // Select team 1 on the new rotation
      const team1After = screen.getAllByText('Team 1')[0];
      await act(async () => {
        await user.click(team1After);
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      // Still exactly 2 wins total (not 4)
      const winCounts = engine().getWinCounts();
      const totalWins = Array.from(winCounts.values()).reduce((sum, w) => sum + w, 0);
      expect(totalWins).toBe(2);
    });
  });
});
