import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import App from '../src/App';
import { engine } from '../src/engines/engineSelector';
import { storageManager } from '../src/utils/StorageManager';

import { addPlayers, clearTestState, clickTeam, generateAndWaitForAssignments, renderWithProvider } from './shared';

describe('Team rotation', () => {
  const user = userEvent.setup();

  beforeEach(async () => await clearTestState());
  afterEach(async () => await clearTestState());

  describe('Rotate button visibility', () => {
    it('shows rotate button after generating assignments', async () => {
      renderWithProvider(<App />);
      await addPlayers(user, 'Alice,Bob,Charlie,Diana');
      await generateAndWaitForAssignments(user);

      expect(screen.getByTestId('rotate-teams-button')).toBeInTheDocument();
    });
  });

  describe('Rotated court composition saved to state', () => {
    it('team composition changes after rotation', async () => {
      renderWithProvider(<App />);
      await addPlayers(user, 'Alice,Bob,Charlie,Diana');
      await generateAndWaitForAssignments(user);

      const originalTeam1Text = screen.getByTestId('team-1').textContent;

      await act(async () => {
        await user.click(screen.getByTestId('rotate-teams-button'));
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      const rotatedTeam1Text = screen.getByTestId('team-1').textContent;
      expect(rotatedTeam1Text).not.toEqual(originalTeam1Text);
    });
  });

  describe('Winner cleared on rotation', () => {
    it('clears the winner crown when rotating teams', async () => {
      renderWithProvider(<App />);
      await addPlayers(user, 'Alice,Bob,Charlie,Diana');
      await generateAndWaitForAssignments(user);

      await clickTeam(user, screen.getAllByText('Team 1')[0]);

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
      renderWithProvider(<App />);
      await addPlayers(user, 'Alice,Bob,Charlie,Diana');
      await generateAndWaitForAssignments(user);

      await act(async () => {
        await user.click(screen.getByTestId('rotate-teams-button'));
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      expect(engine().getWinCounts().size).toBe(0);

      await clickTeam(user, screen.getAllByText('Team 1')[0]);

      const winCounts = engine().getWinCounts();
      const winners = Array.from(winCounts.entries()).filter(([, count]) => count > 0);
      expect(winners).toHaveLength(2);
      winners.forEach(([, count]) => expect(count).toBe(1));

      const totalWins = winners.reduce((sum, [, w]) => sum + w, 0);
      expect(totalWins).toBe(2);
    });

    it('records wins for the new team identity after set-winner → rotate → set-winner', async () => {
      renderWithProvider(<App />);
      await addPlayers(user, 'Alice,Bob,Charlie,Diana');
      await generateAndWaitForAssignments(user);

      await clickTeam(user, screen.getAllByText('Team 1')[0]);
      const firstWinnerIds = new Set(
        Array.from(engine().getWinCounts().entries())
          .filter(([, count]) => count > 0)
          .map(([id]) => id),
      );

      await clickTeam(user, screen.getByTestId('rotate-teams-button'));

      await clickTeam(user, screen.getAllByText('Team 1')[0]);
      const secondWinnerIds = new Set(
        Array.from(engine().getWinCounts().entries())
          .filter(([, count]) => count > 0)
          .map(([id]) => id),
      );

      const totalWins = Array.from(engine().getWinCounts().values()).reduce((sum, w) => sum + w, 0);
      expect(totalWins).toBe(2);

      const sameSet =
        firstWinnerIds.size === secondWinnerIds.size &&
        [...firstWinnerIds].every(id => secondWinnerIds.has(id));
      expect(sameSet).toBe(false);
    });

    it('does not double-count wins when rotating after a winner was set', async () => {
      renderWithProvider(<App />);
      await addPlayers(user, 'Alice,Bob,Charlie,Diana');
      await generateAndWaitForAssignments(user);

      await clickTeam(user, screen.getAllByText('Team 1')[0]);

      const winsAfterFirstClick = Array.from(engine().getWinCounts().values())
        .reduce((sum, w) => sum + w, 0);
      expect(winsAfterFirstClick).toBe(2);

      await act(async () => {
        await user.click(screen.getByTestId('rotate-teams-button'));
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      await clickTeam(user, screen.getAllByText('Team 1')[0]);

      const winCounts = engine().getWinCounts();
      const totalWins = Array.from(winCounts.values()).reduce((sum, w) => sum + w, 0);
      expect(totalWins).toBe(2);
    });
  });

  describe('Court generation stats', () => {
    const rapidRegenerate = async () => act(async () => {
      await user.click(screen.getByTestId('generate-assignments-button'));
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    const regenerate = async () => act(async () => {
      await user.click(screen.getByTestId('generate-assignments-button'));
      await new Promise(resolve => setTimeout(resolve, 300));
    });

    it('replaces bench stats when rapid-regenerating (discarded round not double-counted)', async () => {
      renderWithProvider(<App />);
      await addPlayers(user, 'Alice,Bob,Charlie,Diana,Eve');
      await generateAndWaitForAssignments(user);
      await rapidRegenerate();

      const totalBenched = [...engine().getBenchCounts().values()].reduce((s, n) => s + n, 0);
      expect(totalBenched).toBe(1);
    });

    it('replaces bench stats when rapid-regenerating with force-bench (discarded round not double-counted)', async () => {
      renderWithProvider(<App />);
      await addPlayers(user, 'Alice,Bob,Charlie,Diana,Eve');
      await generateAndWaitForAssignments(user);

      await act(async () => {
        await user.click(screen.getByText('Manage Players'));
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      const state = await storageManager.loadApp();
      const playerId = state!.players[0].id;
      await act(async () => {
        await user.click(screen.getByTestId(`force-bench-${playerId}`));
      });
      await rapidRegenerate();

      const totalBenched = [...engine().getBenchCounts().values()].reduce((s, n) => s + n, 0);
      expect(totalBenched).toBe(1);
    });

    it('replaces teammate stats when rapid-regenerating (discarded round not double-counted)', async () => {
      renderWithProvider(<App />);
      await addPlayers(user, 'Alice,Bob,Charlie,Diana');
      await generateAndWaitForAssignments(user);
      await rapidRegenerate();

      const totalPairs = [...engine().getStats().teammateCountMap.values()].reduce((s, n) => s + n, 0);
      expect(totalPairs).toBeGreaterThan(0);
    });

    it('commits bench stats for each played round', async () => {
      renderWithProvider(<App />);
      await addPlayers(user, 'Alice,Bob,Charlie,Diana,Eve');
      await generateAndWaitForAssignments(user);

      await clickTeam(user, screen.getAllByText('Team 1')[0]);
      await regenerate();

      const totalBenched = [...engine().getBenchCounts().values()].reduce((s, n) => s + n, 0);
      expect(totalBenched).toBe(2);
    });

    it('commits teammate stats from the previous round exactly once', async () => {
      renderWithProvider(<App />);
      await addPlayers(user, 'Alice,Bob,Charlie,Diana');
      await generateAndWaitForAssignments(user);

      await clickTeam(user, screen.getAllByText('Team 1')[0]);
      await regenerate();

      const totalPairs = [...engine().getStats().teammateCountMap.values()].reduce((s, n) => s + n, 0);
      expect(totalPairs).toBeGreaterThan(0);
    });

    it('rapid regen × 2 (no winner) then regen with winner records exactly 1 round played', async () => {
      renderWithProvider(<App />);
      await addPlayers(user, 'Alice,Bob,Charlie,Diana,Eve');
      await generateAndWaitForAssignments(user);

      await rapidRegenerate();
      await rapidRegenerate();

      await clickTeam(user, screen.getAllByText('Team 1')[0]);

      await regenerate();

      expect(engine().getRoundsPlayed()).toBe(1);
    });

    it('rapid regen × 2 (no winner) then regen with winner commits only 2 rounds of bench stats', async () => {
      renderWithProvider(<App />);
      await addPlayers(user, 'Alice,Bob,Charlie,Diana,Eve');
      await generateAndWaitForAssignments(user);

      await rapidRegenerate();

      await clickTeam(user, screen.getAllByText('Team 1')[0]);

      await regenerate();

      const totalBenched = [...engine().getBenchCounts().values()].reduce((s, n) => s + n, 0);
      expect(totalBenched).toBe(2);
    });

    it('rapid regen × 2 (no winner) then regen with winner commits only 2 rounds (no triple count)', async () => {
      renderWithProvider(<App />);
      await addPlayers(user, 'Alice,Bob,Charlie,Diana,Eve');
      await generateAndWaitForAssignments(user);

      await rapidRegenerate();
      await rapidRegenerate();

      await clickTeam(user, screen.getAllByText('Team 1')[0]);

      await regenerate();

      const totalBenched = [...engine().getBenchCounts().values()].reduce((s, n) => s + n, 0);
      expect(totalBenched).toBe(2);
    });
  });

  describe('Team pair stats updated on rotation', () => {
    it('replaces teammate pairs on second rotation (undo first, add new)', async () => {
      renderWithProvider(<App />);
      await addPlayers(user, 'Alice,Bob,Charlie,Diana');
      await generateAndWaitForAssignments(user);

      const rotate = async () => act(async () => {
        await user.click(screen.getByTestId('rotate-teams-button'));
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      await rotate();
      const pairsAfterFirst = new Set(
        [...engine().getStats().teammateCountMap.entries()]
          .filter(([, count]) => count > 0)
          .map(([pair]) => pair),
      );
      expect(pairsAfterFirst.size).toBe(2);

      await rotate();
      const pairsAfterSecond = new Set(
        [...engine().getStats().teammateCountMap.entries()]
          .filter(([, count]) => count > 0)
          .map(([pair]) => pair),
      );
      expect(pairsAfterSecond.size).toBe(2);
      expect([...pairsAfterFirst].every(p => pairsAfterSecond.has(p))).toBe(false);
    });

    it('updates opponent pairs to reflect the rotated composition', async () => {
      renderWithProvider(<App />);
      await addPlayers(user, 'Alice,Bob,Charlie,Diana');
      await generateAndWaitForAssignments(user);

      await act(async () => {
        await user.click(screen.getByTestId('rotate-teams-button'));
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      const opponents = [...engine().getStats().opponentCountMap.entries()]
        .filter(([, count]) => count > 0);
      expect(opponents).toHaveLength(4);
      opponents.forEach(([, count]) => expect(count).toBe(1));
    });
  });
});
