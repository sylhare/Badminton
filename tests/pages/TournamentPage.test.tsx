import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import TournamentPage from '../../src/pages/TournamentPage';

const { mockLoadApp } = vi.hoisted(() => ({
  mockLoadApp: vi.fn(),
}));

vi.mock('../../src/utils/StorageManager', () => ({
  storageManager: {
    loadApp: mockLoadApp,
    saveApp: vi.fn(),
    loadEngine: vi.fn(),
    saveEngine: vi.fn(),
    clearAll: vi.fn(),
  },
}));

const mockPlayers = [
  { id: 'p1', name: 'Alice', isPresent: true },
  { id: 'p2', name: 'Bob', isPresent: true },
  { id: 'p3', name: 'Carol', isPresent: true },
  { id: 'p4', name: 'Dave', isPresent: true },
  { id: 'p5', name: 'Eve', isPresent: false },
];

describe('TournamentPage', () => {
  beforeEach(() => {
    mockLoadApp.mockResolvedValue({ players: mockPlayers, numberOfCourts: 2 });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the tournament page heading', () => {
    render(<TournamentPage />);
    expect(screen.getByText('🏆 Tournament Mode')).toBeInTheDocument();
  });

  it('renders back-to-app link', () => {
    render(<TournamentPage />);
    expect(screen.getByTestId('back-to-app')).toBeInTheDocument();
  });

  it('calls storageManager.loadApp on mount', async () => {
    render(<TournamentPage />);
    await waitFor(() => {
      expect(mockLoadApp).toHaveBeenCalledOnce();
    });
  });

  it('shows TournamentSetup with present players pre-selected', async () => {
    render(<TournamentPage />);
    await waitFor(() => {
      expect(screen.getByTestId('player-checkbox-p1')).toBeChecked();
      expect(screen.getByTestId('player-checkbox-p2')).toBeChecked();
    }, { timeout: 3000 });
  });

  it('absent players are not pre-selected', async () => {
    render(<TournamentPage />);
    await waitFor(() => {
      // p5 (Eve) is absent → should not be shown (initialPlayers filtered to isPresent)
      expect(screen.queryByTestId('player-checkbox-p5')).not.toBeInTheDocument();
    });
  });

  it('transitions from setup to active phase after onStart fires', async () => {
    const user = userEvent.setup();
    render(<TournamentPage />);

    await waitFor(() => {
      expect(screen.getByTestId('start-tournament-button')).not.toBeDisabled();
    }, { timeout: 3000 });

    await user.click(screen.getByTestId('start-tournament-button'));

    expect(screen.getByTestId('tournament-matches')).toBeInTheDocument();
    expect(screen.getByTestId('tournament-standings')).toBeInTheDocument();
  });

  it('transitions from active to completed after Finish Tournament clicked', async () => {
    const user = userEvent.setup();
    render(<TournamentPage />);

    await waitFor(() => {
      expect(screen.getByTestId('start-tournament-button')).not.toBeDisabled();
    }, { timeout: 3000 });

    await user.click(screen.getByTestId('start-tournament-button'));

    // Record result for the single match (4 players → 2 teams → 1 match)
    const aliceEl = screen.getAllByText('Alice')[0];
    await user.click(aliceEl);
    await user.click(screen.getByTestId('score-modal-skip'));

    await user.click(screen.getByTestId('finish-tournament-button'));

    expect(screen.getByRole('heading', { level: 2, name: 'Final Results' })).toBeInTheDocument();
  });

  it('reset from completed phase goes back to setup', async () => {
    const user = userEvent.setup();
    render(<TournamentPage />);

    await waitFor(() => {
      expect(screen.getByTestId('start-tournament-button')).not.toBeDisabled();
    }, { timeout: 3000 });

    await user.click(screen.getByTestId('start-tournament-button'));

    const aliceEl = screen.getAllByText('Alice')[0];
    await user.click(aliceEl);
    await user.click(screen.getByTestId('score-modal-skip'));
    await user.click(screen.getByTestId('finish-tournament-button'));

    expect(screen.getByTestId('reset-tournament-button')).toBeInTheDocument();
    await user.click(screen.getByTestId('reset-tournament-button'));

    expect(screen.getByTestId('start-tournament-button')).toBeInTheDocument();
  });

  it('match result update propagates to standings (score diff updates)', async () => {
    const user = userEvent.setup();
    render(<TournamentPage />);

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

    // Team 1 (Alice & Bob) wins with scoreDiff = +11
    expect(screen.getByTestId('score-diff-0')).toHaveTextContent('+11');
  });
});
