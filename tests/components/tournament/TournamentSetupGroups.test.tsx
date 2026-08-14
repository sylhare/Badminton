import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TournamentSetup } from '../../../src/components/tournament/TournamentSetup';
import { createMockPlayer } from '../../data/testFactories';

vi.mock('../../../src/components/modals/ImageUploadModal', () => ({ default: () => null }));

const presentPlayers = [
  createMockPlayer({ id: 'p1', name: 'Alice', isPresent: true }),
  createMockPlayer({ id: 'p2', name: 'Bob', isPresent: true }),
  createMockPlayer({ id: 'p3', name: 'Carol', isPresent: true }),
  createMockPlayer({ id: 'p4', name: 'Dave', isPresent: true }),
  createMockPlayer({ id: 'p5', name: 'Eve', isPresent: true }),
  createMockPlayer({ id: 'p6', name: 'Frank', isPresent: true }),
  createMockPlayer({ id: 'p7', name: 'Grace', isPresent: true }),
  createMockPlayer({ id: 'p8', name: 'Heidi', isPresent: true }),
];

describe('TournamentSetup — group-knockout config', () => {
  let onStart: ReturnType<typeof vi.fn>;

  beforeEach(() => { onStart = vi.fn(); });
  afterEach(() => { vi.clearAllMocks(); });

  it('shows the group config only for the group-knockout type', () => {
    const { rerender } = render(
      <TournamentSetup initialPlayers={presentPlayers} initialNumberOfCourts={2} type="round-robin" onStart={onStart} />,
    );
    expect(screen.queryByTestId('group-knockout-config')).not.toBeInTheDocument();

    rerender(
      <TournamentSetup initialPlayers={presentPlayers} initialNumberOfCourts={2} type="group-knockout" onStart={onStart} />,
    );
    expect(screen.getByTestId('group-knockout-config')).toBeInTheDocument();
  });

  it('passes the chosen group size and qualifiers to onStart', async () => {
    const user = userEvent.setup();
    render(
      <TournamentSetup initialPlayers={presentPlayers} initialNumberOfCourts={2} type="group-knockout" onStart={onStart} />,
    );

    fireEvent.change(screen.getByTestId('group-size-input'), { target: { value: '3' } });
    fireEvent.change(screen.getByTestId('qualifiers-input'), { target: { value: '1' } });
    await user.click(screen.getByTestId('start-tournament-button'));

    const [, options] = onStart.mock.calls[0];
    expect(options.bestOf).toBe(1);
    expect(options.groupSize).toBe(3);
    expect(options.qualifiersPerGroup).toBe(1);
  });

  it('warns but still allows Start when every team would qualify', () => {
    render(
      <TournamentSetup initialPlayers={presentPlayers} initialNumberOfCourts={2} type="group-knockout" onStart={onStart} />,
    );

    fireEvent.change(screen.getByTestId('group-size-input'), { target: { value: '3' } });
    fireEvent.change(screen.getByTestId('qualifiers-input'), { target: { value: '2' } });

    expect(screen.getByTestId('qualifiers-warning')).toHaveTextContent(/every team advances/i);
    expect(screen.getByTestId('start-tournament-button')).toBeEnabled();
  });

  it('previews the real group split, flagging a size the roster cannot reach', () => {
    render(
      <TournamentSetup initialPlayers={presentPlayers} initialNumberOfCourts={2} type="group-knockout" onStart={onStart} />,
    );

    fireEvent.change(screen.getByTestId('group-size-input'), { target: { value: '3' } });
    expect(screen.getByTestId('group-preview')).toHaveTextContent('4 teams → 2 groups of 2 (3 per group needs more teams)');
  });

  it('lets qualifiers reach the full group size (world-cup style)', () => {
    render(
      <TournamentSetup initialPlayers={presentPlayers} initialNumberOfCourts={2} type="group-knockout" onStart={onStart} />,
    );

    fireEvent.change(screen.getByTestId('group-size-input'), { target: { value: '4' } });
    fireEvent.change(screen.getByTestId('qualifiers-input'), { target: { value: '4' } });
    expect(screen.getByTestId('qualifiers-input')).toHaveValue(4);
  });
});
