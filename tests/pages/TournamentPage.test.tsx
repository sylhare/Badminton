import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TournamentPage } from '../../src/pages/TournamentPage';
import { storageManager } from '../../src/utils/StorageManager';
import { clearTestState, flushPendingSaves, renderWithProvider } from '../shared';
import { MOCK_PLAYERS } from '../data/testFactories';

const mockPlayers = MOCK_PLAYERS.tournament;

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

  describe('tournament type selector', () => {
    it('shows Round Robin and Elimination pills in setup', async () => {
      renderWithProvider(<TournamentPage />);
      await waitFor(() => {
        expect(screen.getByTestId('type-pill-round-robin')).toBeInTheDocument();
        expect(screen.getByTestId('type-pill-elimination')).toBeInTheDocument();
      });
    });

    it('defaults to Round Robin selected', async () => {
      renderWithProvider(<TournamentPage />);
      await waitFor(() => {
        expect(screen.getByTestId('type-pill-round-robin')).toHaveClass('format-pill-active');
        expect(screen.getByTestId('type-pill-elimination')).not.toHaveClass('format-pill-active');
      });
    });

    it('starting with Elimination renders bracket view, not match list', async () => {
      const user = userEvent.setup();
      renderWithProvider(<TournamentPage />);

      await waitFor(() => {
        expect(screen.getByTestId('start-tournament-button')).not.toBeDisabled();
      }, { timeout: 3000 });

      await user.click(screen.getByTestId('type-pill-elimination'));
      await user.click(screen.getByTestId('start-tournament-button'));

      await waitFor(() => {
        expect(screen.getByTestId('elimination-bracket')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('tournament-matches')).not.toBeInTheDocument();
    });

    it('starting with Round Robin (default) renders match list', async () => {
      const user = userEvent.setup();
      renderWithProvider(<TournamentPage />);

      await waitFor(() => {
        expect(screen.getByTestId('start-tournament-button')).not.toBeDisabled();
      }, { timeout: 3000 });

      await user.click(screen.getByTestId('start-tournament-button'));

      expect(screen.getByTestId('tournament-matches')).toBeInTheDocument();
      expect(screen.queryByTestId('elimination-bracket')).not.toBeInTheDocument();
    });

    it('restores elimination tournament from saved state', async () => {
      const [A, B, C, D] = [mockPlayers[0], mockPlayers[1], mockPlayers[2], mockPlayers[3]];
      const savedState = {
        phase: 'active' as const,
        format: 'singles' as const,
        type: 'elimination' as const,
        numberOfCourts: 2,
        bracketSize: 4,
        teams: [
          { id: 't1', players: [A] },
          { id: 't2', players: [B] },
          { id: 't3', players: [C] },
          { id: 't4', players: [D] },
        ],
        matches: [
          {
            id: 'm1', round: 1, courtNumber: 1, bracket: 'wb' as const,
            team1: { id: 't1', players: [A] },
            team2: { id: 't2', players: [B] },
          },
          {
            id: 'm2', round: 1, courtNumber: 2, bracket: 'wb' as const,
            team1: { id: 't3', players: [C] },
            team2: { id: 't4', players: [D] },
          },
        ],
      };
      await storageManager.saveTournament(savedState);
      await flushPendingSaves();

      renderWithProvider(<TournamentPage />);

      await waitFor(() => {
        expect(screen.getByTestId('elimination-bracket')).toBeInTheDocument();
      });
    });
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
