import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import TournamentPage from '../../src/pages/TournamentPage';
import { storageManager } from '../../src/utils/StorageManager';
import { clearTestState, flushPendingSaves, renderWithProvider } from '../shared';

const mockPlayers = [
  { id: 'p1', name: 'Alice', isPresent: true },
  { id: 'p2', name: 'Bob', isPresent: true },
  { id: 'p3', name: 'Carol', isPresent: true },
  { id: 'p4', name: 'Dave', isPresent: true },
  { id: 'p5', name: 'Eve', isPresent: false },
];

describe('TournamentPage', () => {
  beforeEach(async () => {
    await clearTestState();
    await storageManager.saveApp({ players: mockPlayers, numberOfCourts: 2 });
    await storageManager.saveTournament(null);
    await flushPendingSaves();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await clearTestState();
  });

  it('renders the tournament page heading', () => {
    renderWithProvider(<TournamentPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Tournament');
  });

  it('shows TournamentSetup with present players pre-selected', async () => {
    renderWithProvider(<TournamentPage />);
    await waitFor(() => {
      expect(screen.getByTestId('player-checkbox-p1')).toBeChecked();
      expect(screen.getByTestId('player-checkbox-p2')).toBeChecked();
    }, { timeout: 3000 });
  });

  it('absent players are shown but not pre-selected', async () => {
    renderWithProvider(<TournamentPage />);
    await waitFor(() => {
      expect(screen.getByTestId('player-checkbox-p5')).not.toBeChecked();
    });
  });

  it('transitions from setup to active phase after onStart fires', async () => {
    const user = userEvent.setup();
    renderWithProvider(<TournamentPage />);

    await waitFor(() => {
      expect(screen.getByTestId('start-tournament-button')).not.toBeDisabled();
    }, { timeout: 3000 });

    await user.click(screen.getByTestId('start-tournament-button'));

    expect(screen.getByTestId('tournament-matches')).toBeInTheDocument();
    expect(screen.getByTestId('tournament-standings')).toBeInTheDocument();
  });

  it('clicking Start a New Tournament resets to setup', async () => {
    const user = userEvent.setup();
    renderWithProvider(<TournamentPage />);

    await waitFor(() => {
      expect(screen.getByTestId('start-tournament-button')).not.toBeDisabled();
    }, { timeout: 3000 });

    await user.click(screen.getByTestId('start-tournament-button'));

    const aliceEl = screen.getAllByText('Alice')[0];
    await user.click(aliceEl);
    await user.click(screen.getByTestId('score-modal-confirm'));

    await user.click(screen.getByTestId('new-tournament-button'));

    expect(screen.getByTestId('start-tournament-button')).toBeInTheDocument();
  });

  it('restores an in-progress tournament from saved state on mount', async () => {
    const savedState = {
      phase: 'active' as const,
      format: 'singles' as const,
      type: 'round-robin' as const,
      numberOfCourts: 2,
      teams: [
        { id: 't1', players: [mockPlayers[0]] },
        { id: 't2', players: [mockPlayers[1]] },
      ],
      matches: [
        {
          id: 'm1', round: 1, courtNumber: 1,
          team1: { id: 't1', players: [mockPlayers[0]] },
          team2: { id: 't2', players: [mockPlayers[1]] },
        },
      ],
    };
    await storageManager.saveTournament(savedState);
    await flushPendingSaves();

    renderWithProvider(<TournamentPage />);

    await waitFor(() => {
      expect(screen.getByTestId('tournament-matches')).toBeInTheDocument();
    });
  });

  it('saves tournament state after starting', async () => {
    const user = userEvent.setup();
    const saveSpy = vi.spyOn(storageManager, 'saveTournament');
    renderWithProvider(<TournamentPage />);

    await waitFor(() => {
      expect(screen.getByTestId('start-tournament-button')).not.toBeDisabled();
    }, { timeout: 3000 });

    await user.click(screen.getByTestId('start-tournament-button'));

    await waitFor(() => {
      const activeCall = saveSpy.mock.calls.find(([s]) => s?.phase === 'active');
      expect(activeCall).toBeDefined();
    });
  });

  it('saves null tournament state after reset', async () => {
    const user = userEvent.setup();
    const saveSpy = vi.spyOn(storageManager, 'saveTournament');
    renderWithProvider(<TournamentPage />);

    await waitFor(() => {
      expect(screen.getByTestId('start-tournament-button')).not.toBeDisabled();
    }, { timeout: 3000 });

    await user.click(screen.getByTestId('start-tournament-button'));
    const aliceEl = screen.getAllByText('Alice')[0];
    await user.click(aliceEl);
    await user.click(screen.getByTestId('score-modal-confirm'));
    await user.click(screen.getByTestId('new-tournament-button'));

    await waitFor(() => {
      expect(saveSpy.mock.calls.at(-1)?.[0]).toBeNull();
    });
  });

  it('does not save tournament before tournament data is loaded', async () => {
    vi.spyOn(storageManager, 'loadTournament').mockReturnValue(new Promise(() => {}));
    const saveSpy = vi.spyOn(storageManager, 'saveTournament');

    renderWithProvider(<TournamentPage />);

    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('match result update propagates to standings (score diff updates)', async () => {
    const user = userEvent.setup();
    renderWithProvider(<TournamentPage />);

    await waitFor(() => {
      expect(screen.getByTestId('start-tournament-button')).not.toBeDisabled();
    }, { timeout: 3000 });

    await user.click(screen.getByTestId('start-tournament-button'));

    const aliceEl = screen.getAllByText('Alice')[0];
    await user.click(aliceEl);

    await user.clear(screen.getByTestId('score-input-team1'));
    await user.type(screen.getByTestId('score-input-team1'), '21');
    await user.clear(screen.getByTestId('score-input-team2'));
    await user.type(screen.getByTestId('score-input-team2'), '10');
    await user.click(screen.getByTestId('score-modal-confirm'));

    expect(screen.getByTestId('score-diff-0')).toHaveTextContent('+11');
  });
});
