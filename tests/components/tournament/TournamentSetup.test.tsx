import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../src/components/modals/ImageUploadModal', () => ({
  default: () => null,
}));

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

    expect(screen.getAllByTestId(/^team-card-/)).toHaveLength(2);

    await user.click(screen.getByTestId('format-pill-singles'));

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

    const slot00 = screen.getByTestId('player-slot-0-0');
    const slot10 = screen.getByTestId('player-slot-1-0');

    expect(slot00).toHaveTextContent('Alice');
    expect(slot10).toHaveTextContent('Carol');

    await user.click(slot00);
    expect(slot00).toHaveClass('swap-selected');

    await user.click(slot10);

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
    const state: TournamentState = onStart.mock.calls[0][0].toState();
    expect(state.phase).toBe('active');
    expect(state.format).toBe('doubles');
    expect(state.type).toBe('round-robin');
    expect(state.numberOfCourts).toBe(2);
    expect(state.teams).toHaveLength(2);
    expect(state.matches).toHaveLength(1);
    expect(state.teams[0].players).toHaveLength(2);
  });

  it('removing a player does not reset other team assignments', async () => {
    const user = userEvent.setup();
    render(
      <TournamentSetup
        initialPlayers={presentPlayers}
        initialNumberOfCourts={2}
        onStart={onStart}
      />,
    );

    await user.click(screen.getByTestId('player-slot-0-0'));
    await user.click(screen.getByTestId('player-slot-1-0'));

    expect(screen.getByTestId('player-slot-0-0')).toHaveTextContent('Carol');
    expect(screen.getByTestId('player-slot-1-0')).toHaveTextContent('Alice');

    await user.click(screen.getByTestId('player-checkbox-p4'));

    expect(screen.getByTestId('player-slot-0-0')).toHaveTextContent('Carol');
    expect(screen.getByTestId('player-slot-0-1')).toHaveTextContent('Bob');
    expect(screen.getByTestId('player-slot-1-0')).toHaveTextContent('Alice');
  });

  it('adding a player fills the first incomplete team slot in doubles', async () => {
    const user = userEvent.setup();
    render(
      <TournamentSetup
        initialPlayers={presentPlayers}
        initialNumberOfCourts={2}
        onStart={onStart}
      />,
    );

    await user.click(screen.getByTestId('player-checkbox-p4'));
    expect(screen.queryByTestId('player-slot-1-1')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('player-checkbox-p4'));
    expect(screen.getByTestId('player-slot-1-1')).toHaveTextContent('Dave');
  });

  it('two solo-player teams merge when removing a player in doubles', async () => {
    const user = userEvent.setup();
    render(
      <TournamentSetup
        initialPlayers={presentPlayers}
        initialNumberOfCourts={2}
        onStart={onStart}
      />,
    );

    await user.click(screen.getByTestId('player-checkbox-p2'));
    expect(screen.getAllByTestId(/^team-card-/)).toHaveLength(2);

    await user.click(screen.getByTestId('player-checkbox-p4'));

    expect(screen.getAllByTestId(/^team-card-/)).toHaveLength(1);
    expect(screen.getByTestId('player-slot-0-0')).toHaveTextContent('Alice');
    expect(screen.getByTestId('player-slot-0-1')).toHaveTextContent('Carol');
  });

  it('adding a new player via the form selects them and adds to teams', async () => {
    const user = userEvent.setup();
    render(
      <TournamentSetup
        initialPlayers={presentPlayers}
        initialNumberOfCourts={2}
        onStart={onStart}
      />,
    );

    const input = screen.getByTestId('player-entry-input');
    await user.type(input, 'Zara');
    await user.click(screen.getByTestId('add-player-button'));

    expect(screen.getAllByText('Zara').length).toBeGreaterThan(0);

    expect(input).toHaveValue('');
  });

  it('shows court warning when matches per round exceed courts', () => {
    render(
      <TournamentSetup
        initialPlayers={presentPlayers}
        initialNumberOfCourts={1}
        onStart={onStart}
      />,
    );

    expect(screen.queryByTestId('court-warning')).not.toBeInTheDocument();
  });

  it('shows court warning when matches per round exceed court count', () => {
    const eightPlayers = [
      ...presentPlayers,
      createMockPlayer({ id: 'p5', name: 'Eve', isPresent: true }),
      createMockPlayer({ id: 'p6', name: 'Frank', isPresent: true }),
      createMockPlayer({ id: 'p7', name: 'Grace', isPresent: true }),
      createMockPlayer({ id: 'p8', name: 'Hank', isPresent: true }),
    ];
    render(
      <TournamentSetup
        initialPlayers={eightPlayers}
        initialNumberOfCourts={1}
        onStart={onStart}
      />,
    );

    expect(screen.getByTestId('court-warning')).toBeInTheDocument();
    expect(screen.getByTestId('court-warning')).toHaveTextContent('2 matches per round');
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

    const state: TournamentState = onStart.mock.calls[0][0].toState();
    expect(state.numberOfCourts).toBe(3);
  });
});
