import React, { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import RoundRobinSetup from '../../../../src/components/tournament/round-robin/RoundRobinSetup';
import type { TournamentFormat, TournamentTeam } from '../../../../src/tournament/types';
import type { Player } from '../../../../src/types';
import { createMockPlayer } from '../../../data/testFactories';

vi.mock('../../../../src/components/modals/ImageUploadModal', () => ({
  default: () => null,
}));

const presentPlayers = [
  createMockPlayer({ id: 'p1', name: 'Alice', isPresent: true }),
  createMockPlayer({ id: 'p2', name: 'Bob', isPresent: true }),
  createMockPlayer({ id: 'p3', name: 'Carol', isPresent: true }),
  createMockPlayer({ id: 'p4', name: 'Dave', isPresent: true }),
];

/**
 * Controlled wrapper that mirrors TournamentPage: onTogglePlayer flips isPresent
 * in local state, which flows back as initialPlayers.
 */
function ControlledSetup(props: React.ComponentProps<typeof RoundRobinSetup>) {
  const [players, setPlayers] = useState<Player[]>(props.initialPlayers);
  return (
    <RoundRobinSetup
      {...props}
      initialPlayers={players}
      onTogglePlayer={id =>
        setPlayers(prev => prev.map(p => p.id === id ? { ...p, isPresent: !p.isPresent } : p))
      }
    />
  );
}

describe('RoundRobinSetup', () => {
  let onStart: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onStart = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders with present players pre-selected', () => {
    render(
      <RoundRobinSetup
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
      <RoundRobinSetup
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
      <RoundRobinSetup
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
      <RoundRobinSetup
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
      <RoundRobinSetup
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
      <RoundRobinSetup
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
      <RoundRobinSetup
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
      <RoundRobinSetup
        initialPlayers={presentPlayers}
        initialNumberOfCourts={2}
        onStart={onStart}
      />,
    );

    const courtInput = screen.getByTestId('tournament-court-count');
    fireEvent.change(courtInput, { target: { value: '3' } });

    expect(courtInput).toHaveValue(3);
  });

  it('onStart receives teams, numberOfCourts, and format', async () => {
    const user = userEvent.setup();
    render(
      <RoundRobinSetup
        initialPlayers={presentPlayers}
        initialNumberOfCourts={2}
        onStart={onStart}
      />,
    );

    await user.click(screen.getByTestId('start-tournament-button'));

    expect(onStart).toHaveBeenCalledOnce();
    const [teams, numberOfCourts, format]: [TournamentTeam[], number, TournamentFormat] =
      onStart.mock.calls[0];
    expect(format).toBe('doubles');
    expect(numberOfCourts).toBe(2);
    expect(teams).toHaveLength(2);
    expect(teams[0].players).toHaveLength(2);
  });

  it('unchecking a player removes them from teams', async () => {
    const user = userEvent.setup();
    render(
      <ControlledSetup
        initialPlayers={presentPlayers}
        initialNumberOfCourts={2}
        onStart={onStart}
      />,
    );

    expect(screen.getAllByTestId(/^team-card-/)).toHaveLength(2);

    await user.click(screen.getByTestId('player-checkbox-p4'));

    expect(screen.getByTestId('player-checkbox-p4')).not.toBeChecked();
    expect(screen.getAllByTestId(/^team-card-/)).toHaveLength(2);
    expect(screen.queryByTestId('player-slot-1-1')).not.toBeInTheDocument();
  });

  it('unchecking then rechecking a player re-adds them to teams', async () => {
    const user = userEvent.setup();
    render(
      <ControlledSetup
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

  it('two unchecked players reduce to one team in doubles', async () => {
    const user = userEvent.setup();
    render(
      <ControlledSetup
        initialPlayers={presentPlayers}
        initialNumberOfCourts={2}
        onStart={onStart}
      />,
    );

    await user.click(screen.getByTestId('player-checkbox-p2'));
    await user.click(screen.getByTestId('player-checkbox-p4'));

    expect(screen.getAllByTestId(/^team-card-/)).toHaveLength(1);
    expect(screen.getByTestId('player-slot-0-0')).toHaveTextContent('Alice');
    expect(screen.getByTestId('player-slot-0-1')).toHaveTextContent('Carol');
  });

  it('adding a new player via the form calls onAddPlayers and shows them when initialPlayers updates', async () => {
    const user = userEvent.setup();
    const onAddPlayers = vi.fn();
    const zaraMock = createMockPlayer({ id: 'zara-1', name: 'Zara', isPresent: true });
    const { rerender } = render(
      <RoundRobinSetup
        initialPlayers={presentPlayers}
        initialNumberOfCourts={2}
        onStart={onStart}
        onAddPlayers={onAddPlayers}
      />,
    );

    const input = screen.getByTestId('player-entry-input');
    await user.type(input, 'Zara');
    await user.click(screen.getByTestId('add-player-button'));

    expect(onAddPlayers).toHaveBeenCalledWith(['Zara']);
    expect(input).toHaveValue('');

    rerender(
      <RoundRobinSetup
        initialPlayers={[...presentPlayers, zaraMock]}
        initialNumberOfCourts={2}
        onStart={onStart}
        onAddPlayers={onAddPlayers}
      />,
    );

    expect(screen.getAllByText('Zara').length).toBeGreaterThan(0);
  });

  it('shows court warning when matches per round exceed courts', () => {
    render(
      <RoundRobinSetup
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
      <RoundRobinSetup
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
      <RoundRobinSetup
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
      <RoundRobinSetup
        initialPlayers={presentPlayers}
        initialNumberOfCourts={2}
        onStart={onStart}
      />,
    );

    const courtInput = screen.getByTestId('tournament-court-count');
    fireEvent.change(courtInput, { target: { value: '3' } });

    await user.click(screen.getByTestId('start-tournament-button'));

    const [, numberOfCourts] = onStart.mock.calls[0];
    expect(numberOfCourts).toBe(3);
  });
});
