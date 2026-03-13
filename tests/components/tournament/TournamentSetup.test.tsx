import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import TournamentSetup from '../../../src/components/tournament/TournamentSetup';
import type { TournamentState } from '../../../src/types/tournament';
import { createMockPlayer } from '../../data/testFactories';

const presentPlayers = [
  createMockPlayer({ id: 'p1', name: 'Alice', isPresent: true }),
  createMockPlayer({ id: 'p2', name: 'Bob', isPresent: true }),
  createMockPlayer({ id: 'p3', name: 'Carol', isPresent: true }),
  createMockPlayer({ id: 'p4', name: 'Dave', isPresent: true }),
];

describe('TournamentSetup', () => {
  let onStart: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onStart = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders with present players pre-selected', () => {
    render(
      <TournamentSetup
        initialPlayers={presentPlayers}
        initialNumberOfCourts={2}
        onStart={onStart}
      />,
    );

    for (const player of presentPlayers) {
      const checkbox = screen.getByTestId(`player-checkbox-${player.id}`);
      expect(checkbox).toBeChecked();
    }
  });

  it('shows all player names', () => {
    render(
      <TournamentSetup
        initialPlayers={presentPlayers}
        initialNumberOfCourts={2}
        onStart={onStart}
      />,
    );

    expect(screen.getAllByText('Alice').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bob').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Carol').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Dave').length).toBeGreaterThan(0);
  });

  it('format switch from doubles to singles re-derives teams', async () => {
    const user = userEvent.setup();
    render(
      <TournamentSetup
        initialPlayers={presentPlayers}
        initialNumberOfCourts={2}
        onStart={onStart}
      />,
    );

    // Default: doubles mode → 2 teams of 2
    expect(screen.getAllByTestId(/^team-card-/)).toHaveLength(2);

    await user.click(screen.getByTestId('format-pill-singles'));

    // Singles mode → 4 teams of 1
    expect(screen.getAllByTestId(/^team-card-/)).toHaveLength(4);
  });

  it('switching back to doubles re-derives teams with pairs', async () => {
    const user = userEvent.setup();
    render(
      <TournamentSetup
        initialPlayers={presentPlayers}
        initialNumberOfCourts={2}
        onStart={onStart}
      />,
    );

    await user.click(screen.getByTestId('format-pill-singles'));
    await user.click(screen.getByTestId('format-pill-doubles'));

    expect(screen.getAllByTestId(/^team-card-/)).toHaveLength(2);
  });

  it('click-to-swap: clicking two different slots swaps players', async () => {
    const user = userEvent.setup();
    render(
      <TournamentSetup
        initialPlayers={presentPlayers}
        initialNumberOfCourts={2}
        onStart={onStart}
      />,
    );

    // Initial: team 0 = [Alice, Bob], team 1 = [Carol, Dave]
    const slot00 = screen.getByTestId('player-slot-0-0'); // Alice
    const slot10 = screen.getByTestId('player-slot-1-0'); // Carol

    expect(slot00).toHaveTextContent('Alice');
    expect(slot10).toHaveTextContent('Carol');

    await user.click(slot00);
    expect(slot00).toHaveClass('swap-selected');

    await user.click(slot10);

    // After swap: slot00 = Carol, slot10 = Alice
    expect(screen.getByTestId('player-slot-0-0')).toHaveTextContent('Carol');
    expect(screen.getByTestId('player-slot-1-0')).toHaveTextContent('Alice');
    expect(screen.getByTestId('player-slot-0-0')).not.toHaveClass('swap-selected');
  });

  it('click same slot twice deselects without swapping', async () => {
    const user = userEvent.setup();
    render(
      <TournamentSetup
        initialPlayers={presentPlayers}
        initialNumberOfCourts={2}
        onStart={onStart}
      />,
    );

    const slot00 = screen.getByTestId('player-slot-0-0');
    await user.click(slot00);
    expect(slot00).toHaveClass('swap-selected');

    await user.click(slot00);
    expect(slot00).not.toHaveClass('swap-selected');
    expect(slot00).toHaveTextContent('Alice');
  });

  it('shows error and disables Start when odd player count in doubles', async () => {
    const user = userEvent.setup();
    const threePlayers = presentPlayers.slice(0, 3);
    render(
      <TournamentSetup
        initialPlayers={threePlayers}
        initialNumberOfCourts={2}
        onStart={onStart}
      />,
    );

    const startBtn = screen.getByTestId('start-tournament-button');
    expect(startBtn).toBeDisabled();
    expect(screen.getByTestId('setup-error')).toBeInTheDocument();
  });

  it('court count input updates correctly', () => {
    render(
      <TournamentSetup
        initialPlayers={presentPlayers}
        initialNumberOfCourts={2}
        onStart={onStart}
      />,
    );

    const courtInput = screen.getByTestId('tournament-court-count');
    fireEvent.change(courtInput, { target: { value: '3' } });

    expect(courtInput).toHaveValue(3);
  });

  it('onStart receives correct TournamentState', async () => {
    const user = userEvent.setup();
    render(
      <TournamentSetup
        initialPlayers={presentPlayers}
        initialNumberOfCourts={2}
        onStart={onStart}
      />,
    );

    await user.click(screen.getByTestId('start-tournament-button'));

    expect(onStart).toHaveBeenCalledOnce();
    const state: TournamentState = onStart.mock.calls[0][0];
    expect(state.phase).toBe('active');
    expect(state.format).toBe('doubles');
    expect(state.type).toBe('round-robin');
    expect(state.numberOfCourts).toBe(2);
    expect(state.teams).toHaveLength(2);
    expect(state.matches).toHaveLength(1); // 2 teams → 1 match
    expect(state.teams[0].players).toHaveLength(2);
  });

  it('Start Tournament button enabled for valid doubles setup', () => {
    render(
      <TournamentSetup
        initialPlayers={presentPlayers}
        initialNumberOfCourts={2}
        onStart={onStart}
      />,
    );

    expect(screen.getByTestId('start-tournament-button')).not.toBeDisabled();
  });

  it('onStart payload respects numberOfCourts after change', async () => {
    const user = userEvent.setup();
    render(
      <TournamentSetup
        initialPlayers={presentPlayers}
        initialNumberOfCourts={2}
        onStart={onStart}
      />,
    );

    const courtInput = screen.getByTestId('tournament-court-count');
    fireEvent.change(courtInput, { target: { value: '3' } });

    await user.click(screen.getByTestId('start-tournament-button'));

    const state: TournamentState = onStart.mock.calls[0][0];
    expect(state.numberOfCourts).toBe(3);
  });
});
