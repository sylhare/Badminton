import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import App from '../src/App';
import { engine } from '../src/engines/engineSelector';

import { addPlayers, clearTestState, clickTeamAndSkip, generateAndWaitForAssignments } from './shared';

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

      await clickTeamAndSkip(user, screen.getAllByText('Team 1')[0]);

      expect(screen.getByText('🏆 Leaderboard')).toBeInTheDocument();
      const winsBefore = Array.from(engine().getWinCounts().values()).reduce((sum, w) => sum + w, 0);
      expect(winsBefore).toBe(2);

      await act(async () => {
        await user.click(screen.getByTestId('rotate-teams-button'));
        await new Promise(resolve => setTimeout(resolve, 50));
      });

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

      await act(async () => {
        await user.click(screen.getByTestId('rotate-teams-button'));
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      expect(engine().getWinCounts().size).toBe(0);

      await clickTeamAndSkip(user, screen.getAllByText('Team 1')[0]);

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

      await clickTeamAndSkip(user, screen.getAllByText('Team 1')[0]);

      const winsAfterFirstClick = Array.from(engine().getWinCounts().values())
        .reduce((sum, w) => sum + w, 0);
      expect(winsAfterFirstClick).toBe(2);

      await act(async () => {
        await user.click(screen.getByTestId('rotate-teams-button'));
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      await clickTeamAndSkip(user, screen.getAllByText('Team 1')[0]);

      const winCounts = engine().getWinCounts();
      const totalWins = Array.from(winCounts.values()).reduce((sum, w) => sum + w, 0);
      expect(totalWins).toBe(2);
    });
  });

  describe('Smart engine', () => {
    it('rotate button is available and clears winner when smart engine is enabled', async () => {
      render(<App />);
      await addPlayers(user, 'Alice,Bob,Charlie,Diana');

      await act(async () => {
        await user.click(screen.getByTestId('smart-engine-toggle'));
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      await generateAndWaitForAssignments(user);

      expect(screen.getByTestId('rotate-teams-button')).toBeInTheDocument();

      await clickTeamAndSkip(user, screen.getAllByText('Team 1')[0]);

      expect(screen.getByText('🏆 Leaderboard')).toBeInTheDocument();
      const winsBefore = Array.from(engine().getWinCounts().values()).reduce((sum, w) => sum + w, 0);
      expect(winsBefore).toBe(2);

      await act(async () => {
        await user.click(screen.getByTestId('rotate-teams-button'));
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      expect(screen.queryByText('🏆 Leaderboard')).not.toBeInTheDocument();
      const winsAfter = Array.from(engine().getWinCounts().values()).reduce((sum, w) => sum + w, 0);
      expect(winsAfter).toBe(0);
    });

    it('records wins for the correct rotated pair under the smart engine', async () => {
      render(<App />);
      await addPlayers(user, 'Alice,Bob,Charlie,Diana');

      await act(async () => {
        await user.click(screen.getByTestId('smart-engine-toggle'));
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      await generateAndWaitForAssignments(user);

      await act(async () => {
        await user.click(screen.getByTestId('rotate-teams-button'));
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      await clickTeamAndSkip(user, screen.getAllByText('Team 1')[0]);

      const winCounts = engine().getWinCounts();
      const winners = Array.from(winCounts.entries()).filter(([, count]) => count > 0);
      expect(winners).toHaveLength(2);
      winners.forEach(([, count]) => expect(count).toBe(1));
    });
  });
});
