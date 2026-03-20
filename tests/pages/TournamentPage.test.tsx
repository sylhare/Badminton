import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import TournamentPage from '../../src/pages/TournamentPage';
import { renderWithAppState } from '../shared';

const { mockLoadApp, mockLoadTournament, mockSaveTournament } = vi.hoisted(() => ({
  mockLoadApp: vi.fn(),
  mockLoadTournament: vi.fn(),
  mockSaveTournament: vi.fn(),
}));

vi.mock('../../src/utils/StorageManager', () => ({
  MAX_LEVEL_HISTORY_ENTRIES: 50,
  storageManager: {
    loadApp: mockLoadApp,
    saveApp: vi.fn(),
    loadEngine: vi.fn().mockResolvedValue({}),
    saveEngine: vi.fn(),
    clearAll: vi.fn(),
    loadTournament: mockLoadTournament,
    saveTournament: mockSaveTournament,
  },
}));

const mockPlayers = [
  { id: 'p1', name: 'Alice', isPresent: true },
  { id: 'p2', name: 'Bob', isPresent: true },
  { id: 'p3', name: 'Carol', isPresent: true },
  { id: 'p4', name: 'Dave', isPresent: true },
  { id: 'p5', name: 'Eve', isPresent: false },
];

async function startTournament(user: ReturnType<typeof userEvent.setup>) {
  renderWithAppState(<TournamentPage />);
  await waitFor(() => {
    expect(screen.getByTestId('start-tournament-button')).not.toBeDisabled();
  }, { timeout: 3000 });
  await user.click(screen.getByTestId('start-tournament-button'));
}

describe('TournamentPage', () => {
  beforeEach(() => {
    mockLoadApp.mockResolvedValue({ players: mockPlayers, numberOfCourts: 2 });
    mockLoadTournament.mockResolvedValue(null);
    mockSaveTournament.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the tournament page heading', () => {
    renderWithAppState(<TournamentPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Tournament');
  });

  it('calls storageManager.loadApp and loadTournament on mount', async () => {
    renderWithAppState(<TournamentPage />);
    await waitFor(() => {
      expect(mockLoadApp).toHaveBeenCalledOnce();
      expect(mockLoadTournament).toHaveBeenCalledOnce();
    });
  });

  it('shows TournamentSetup with present players pre-selected', async () => {
    renderWithAppState(<TournamentPage />);
    await waitFor(() => {
      expect(screen.getByTestId('player-checkbox-p1')).toBeChecked();
      expect(screen.getByTestId('player-checkbox-p2')).toBeChecked();
    }, { timeout: 3000 });
  });

  it('absent players are shown but not pre-selected', async () => {
    renderWithAppState(<TournamentPage />);
    await waitFor(() => {
      expect(screen.getByTestId('player-checkbox-p5')).not.toBeChecked();
    });
  });

  it('transitions from setup to active phase after onStart fires', async () => {
    const user = userEvent.setup();
    await startTournament(user);

    expect(screen.getByTestId('tournament-matches')).toBeInTheDocument();
    expect(screen.getByTestId('tournament-standings')).toBeInTheDocument();
  });

  it('clicking Start a New Tournament resets to setup', async () => {
    const user = userEvent.setup();
    await startTournament(user);

    await user.click(screen.getAllByText('Alice')[0]);
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
        { id: 't1', playerIds: ['p1'] },
        { id: 't2', playerIds: ['p2'] },
      ],
      matches: [
        {
          id: 'm1', round: 1, courtNumber: 1,
          team1: { id: 't1', playerIds: ['p1'] },
          team2: { id: 't2', playerIds: ['p2'] },
        },
      ],
    };
    mockLoadTournament.mockResolvedValue(savedState);

    renderWithAppState(<TournamentPage />);

    await waitFor(() => {
      expect(screen.getByTestId('tournament-matches')).toBeInTheDocument();
    });
  });

  it('calls saveTournament after starting a tournament', async () => {
    const user = userEvent.setup();
    await startTournament(user);

    await waitFor(() => {
      const activeCall = mockSaveTournament.mock.calls.find(([s]) => s?.phase === 'active');
      expect(activeCall).toBeDefined();
    });
  });

  it('calls saveTournament(null) after reset', async () => {
    const user = userEvent.setup();
    await startTournament(user);

    await user.click(screen.getAllByText('Alice')[0]);
    await user.click(screen.getByTestId('score-modal-confirm'));
    await user.click(screen.getByTestId('new-tournament-button'));

    await waitFor(() => {
      expect(mockSaveTournament.mock.calls.at(-1)?.[0]).toBeNull();
    });
  });

  it('does not call saveTournament before isLoaded', async () => {
    let resolveLoad!: (v: unknown) => void;
    mockLoadApp.mockReturnValue(new Promise(r => { resolveLoad = r; }));
    mockLoadTournament.mockReturnValue(new Promise(() => {}));

    renderWithAppState(<TournamentPage />);

    expect(mockSaveTournament).not.toHaveBeenCalled();

    resolveLoad({ players: mockPlayers, numberOfCourts: 2 });
  });

  describe('player isolation', () => {
    const activeTournamentState = {
      phase: 'active' as const,
      format: 'singles' as const,
      type: 'round-robin' as const,
      numberOfCourts: 2,
      teams: [
        { id: 't1', playerIds: ['p1'] },
        { id: 't2', playerIds: ['p2'] },
      ],
      matches: [
        {
          id: 'm1', round: 1, courtNumber: 1,
          team1: { id: 't1', playerIds: ['p1'] },
          team2: { id: 't2', playerIds: ['p2'] },
        },
      ],
    };

    it('player in app state but not in saved tournament does not appear in active matches', async () => {
      const playersWithEvePresent = [
        ...mockPlayers.slice(0, 4),
        { id: 'p5', name: 'Eve', isPresent: true },
      ];
      mockLoadApp.mockResolvedValue({ players: playersWithEvePresent, numberOfCourts: 2 });
      mockLoadTournament.mockResolvedValue(activeTournamentState);

      renderWithAppState(<TournamentPage />);

      await waitFor(() => {
        expect(screen.getByTestId('tournament-matches')).toBeInTheDocument();
      });

      const matchesEl = screen.getByTestId('tournament-matches');
      expect(within(matchesEl).queryByText('Eve')).toBeNull();
    });

    it('after reset, app-state-only player appears in setup player list', async () => {
      const playersWithEvePresent = [
        ...mockPlayers.slice(0, 4),
        { id: 'p5', name: 'Eve', isPresent: true },
      ];
      mockLoadApp.mockResolvedValue({ players: playersWithEvePresent, numberOfCourts: 2 });
      mockLoadTournament.mockResolvedValue(activeTournamentState);

      const user = userEvent.setup();
      renderWithAppState(<TournamentPage />);

      await waitFor(() => {
        expect(screen.getByTestId('tournament-matches')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('new-tournament-button'));

      expect(within(screen.getByTestId('player-selection')).getByText('Eve')).toBeInTheDocument();
    });

    it('absent player is not in tournament matches but survives reset and appears in setup', async () => {
      const user = userEvent.setup();
      await startTournament(user);

      const matchesEl = screen.getByTestId('tournament-matches');
      expect(within(matchesEl).queryByText('Eve')).toBeNull();

      await user.click(screen.getByTestId('new-tournament-button'));

      expect(within(screen.getByTestId('player-selection')).getByText('Eve')).toBeInTheDocument();
    });
  });

  it('match result update propagates to standings (score diff updates)', async () => {
    const user = userEvent.setup();
    await startTournament(user);

    await user.click(screen.getAllByText('Alice')[0]);
    await user.clear(screen.getByTestId('score-input-team1'));
    await user.type(screen.getByTestId('score-input-team1'), '21');
    await user.clear(screen.getByTestId('score-input-team2'));
    await user.type(screen.getByTestId('score-input-team2'), '10');
    await user.click(screen.getByTestId('score-modal-confirm'));

    expect(screen.getByTestId('score-diff-0')).toHaveTextContent('+11');
  });
});
