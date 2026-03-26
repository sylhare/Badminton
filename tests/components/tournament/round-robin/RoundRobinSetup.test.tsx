import React, { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TournamentSetup } from '../../../../src/components/tournament/TournamentSetup';
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
function ControlledSetup(props: React.ComponentProps<typeof TournamentSetup>) {
  const [players, setPlayers] = useState<Player[]>(props.initialPlayers);
  return (
    <TournamentSetup
      {...props}
      initialPlayers={players}
      onTogglePlayer={id =>
        setPlayers(prev => prev.map(p => p.id === id ? { ...p, isPresent: !p.isPresent } : p))
      }
    />
  );
}

describe('TournamentSetup', () => {
  let onStart: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onStart = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders present players pre-selected', () => {
      render(<TournamentSetup initialPlayers={presentPlayers} initialNumberOfCourts={2} onStart={onStart} />);

      for (const player of presentPlayers) {
        expect(screen.getByTestId(`player-checkbox-${player.id}`)).toBeChecked();
      }
    });

    it('shows all player names', () => {
      render(<TournamentSetup initialPlayers={presentPlayers} initialNumberOfCourts={2} onStart={onStart} />);

      expect(screen.getAllByText('Alice').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Bob').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Carol').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Dave').length).toBeGreaterThan(0);
    });
  });

  describe('format selection', () => {
    it('switching to singles re-derives teams as one-per-player', async () => {
      const user = userEvent.setup();
      render(<TournamentSetup initialPlayers={presentPlayers} initialNumberOfCourts={2} onStart={onStart} />);

      expect(screen.getAllByTestId(/^team-card-/)).toHaveLength(2);
      await user.click(screen.getByTestId('format-pill-singles'));
      expect(screen.getAllByTestId(/^team-card-/)).toHaveLength(4);
    });

    it('switching back to doubles re-derives teams as pairs', async () => {
      const user = userEvent.setup();
      render(<TournamentSetup initialPlayers={presentPlayers} initialNumberOfCourts={2} onStart={onStart} />);

      await user.click(screen.getByTestId('format-pill-singles'));
      await user.click(screen.getByTestId('format-pill-doubles'));
      expect(screen.getAllByTestId(/^team-card-/)).toHaveLength(2);
    });
  });

  describe('player swap', () => {
    it('clicking two different slots swaps players', async () => {
      const user = userEvent.setup();
      render(<TournamentSetup initialPlayers={presentPlayers} initialNumberOfCourts={2} onStart={onStart} />);

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

    it('clicking the same slot twice deselects without swapping', async () => {
      const user = userEvent.setup();
      render(<TournamentSetup initialPlayers={presentPlayers} initialNumberOfCourts={2} onStart={onStart} />);

      const slot00 = screen.getByTestId('player-slot-0-0');
      await user.click(slot00);
      expect(slot00).toHaveClass('swap-selected');

      await user.click(slot00);
      expect(slot00).not.toHaveClass('swap-selected');
      expect(slot00).toHaveTextContent('Alice');
    });
  });

  describe('player toggle', () => {
    it('unchecking a player removes them from teams', async () => {
      const user = userEvent.setup();
      render(<ControlledSetup initialPlayers={presentPlayers} initialNumberOfCourts={2} onStart={onStart} />);

      await user.click(screen.getByTestId('player-checkbox-p4'));

      expect(screen.getByTestId('player-checkbox-p4')).not.toBeChecked();
      expect(screen.queryByTestId('player-slot-1-1')).not.toBeInTheDocument();
    });

    it('unchecking then rechecking re-adds the player to teams', async () => {
      const user = userEvent.setup();
      render(<ControlledSetup initialPlayers={presentPlayers} initialNumberOfCourts={2} onStart={onStart} />);

      await user.click(screen.getByTestId('player-checkbox-p4'));
      expect(screen.queryByTestId('player-slot-1-1')).not.toBeInTheDocument();

      await user.click(screen.getByTestId('player-checkbox-p4'));
      expect(screen.getByTestId('player-slot-1-1')).toHaveTextContent('Dave');
    });

    it('two unchecked players reduce to one team in doubles', async () => {
      const user = userEvent.setup();
      render(<ControlledSetup initialPlayers={presentPlayers} initialNumberOfCourts={2} onStart={onStart} />);

      await user.click(screen.getByTestId('player-checkbox-p2'));
      await user.click(screen.getByTestId('player-checkbox-p4'));

      expect(screen.getAllByTestId(/^team-card-/)).toHaveLength(1);
      expect(screen.getByTestId('player-slot-0-0')).toHaveTextContent('Alice');
      expect(screen.getByTestId('player-slot-0-1')).toHaveTextContent('Carol');
    });
  });

  describe('court warning', () => {
    it('shows no warning when matches fit within court count', () => {
      render(<TournamentSetup initialPlayers={presentPlayers} initialNumberOfCourts={1} onStart={onStart} />);

      expect(screen.queryByTestId('court-warning')).not.toBeInTheDocument();
    });

    it('shows warning when matches per round exceed court count', () => {
      const eightPlayers = [
        ...presentPlayers,
        createMockPlayer({ id: 'p5', name: 'Eve', isPresent: true }),
        createMockPlayer({ id: 'p6', name: 'Frank', isPresent: true }),
        createMockPlayer({ id: 'p7', name: 'Grace', isPresent: true }),
        createMockPlayer({ id: 'p8', name: 'Hank', isPresent: true }),
      ];
      render(<TournamentSetup initialPlayers={eightPlayers} initialNumberOfCourts={1} onStart={onStart} />);

      expect(screen.getByTestId('court-warning')).toBeInTheDocument();
      expect(screen.getByTestId('court-warning')).toHaveTextContent('2 matches per round');
    });
  });

  describe('onStart', () => {
    it('passes teams, numberOfCourts, and format to the callback', async () => {
      const user = userEvent.setup();
      render(<TournamentSetup initialPlayers={presentPlayers} initialNumberOfCourts={2} onStart={onStart} />);

      await user.click(screen.getByTestId('start-tournament-button'));

      expect(onStart).toHaveBeenCalledOnce();
      const [teams, numberOfCourts, format]: [TournamentTeam[], number, TournamentFormat] =
        onStart.mock.calls[0];
      expect(format).toBe('doubles');
      expect(numberOfCourts).toBe(2);
      expect(teams).toHaveLength(2);
      expect(teams[0].players).toHaveLength(2);
    });

    it('reflects updated court count in the callback', async () => {
      const user = userEvent.setup();
      render(<TournamentSetup initialPlayers={presentPlayers} initialNumberOfCourts={2} onStart={onStart} />);

      fireEvent.change(screen.getByTestId('tournament-court-count'), { target: { value: '3' } });
      await user.click(screen.getByTestId('start-tournament-button'));

      const [, numberOfCourts] = onStart.mock.calls[0];
      expect(numberOfCourts).toBe(3);
    });
  });

  it('court count input updates the displayed value', () => {
    render(<TournamentSetup initialPlayers={presentPlayers} initialNumberOfCourts={2} onStart={onStart} />);

    const courtInput = screen.getByTestId('tournament-court-count');
    fireEvent.change(courtInput, { target: { value: '3' } });
    expect(courtInput).toHaveValue(3);
  });

  it('shows error and disables Start when doubles teams are incomplete', () => {
    render(<TournamentSetup initialPlayers={presentPlayers.slice(0, 3)} initialNumberOfCourts={2} onStart={onStart} />);

    expect(screen.getByTestId('start-tournament-button')).toBeDisabled();
    expect(screen.getByTestId('setup-error')).toBeInTheDocument();
  });

  it('Start button is enabled for a valid doubles setup', () => {
    render(<TournamentSetup initialPlayers={presentPlayers} initialNumberOfCourts={2} onStart={onStart} />);

    expect(screen.getByTestId('start-tournament-button')).not.toBeDisabled();
  });

  it('adding a player calls onAddPlayers and shows them after initialPlayers updates', async () => {
    const user = userEvent.setup();
    const onAddPlayers = vi.fn();
    const zaraMock = createMockPlayer({ id: 'zara-1', name: 'Zara', isPresent: true });
    const { rerender } = render(
      <TournamentSetup
        initialPlayers={presentPlayers}
        initialNumberOfCourts={2}
        onStart={onStart}
        onAddPlayers={onAddPlayers}
      />,
    );

    await user.type(screen.getByTestId('player-entry-input'), 'Zara');
    await user.click(screen.getByTestId('add-player-button'));

    expect(onAddPlayers).toHaveBeenCalledWith(['Zara']);
    expect(screen.getByTestId('player-entry-input')).toHaveValue('');

    rerender(
      <TournamentSetup
        initialPlayers={[...presentPlayers, zaraMock]}
        initialNumberOfCourts={2}
        onStart={onStart}
        onAddPlayers={onAddPlayers}
      />,
    );
    expect(screen.getAllByText('Zara').length).toBeGreaterThan(0);
  });
});
