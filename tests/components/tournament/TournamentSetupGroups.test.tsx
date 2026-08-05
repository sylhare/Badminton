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

    const [, , , bestOf, groupSize, qualifiersPerGroup] = onStart.mock.calls[0];
    expect(bestOf).toBe(1);
    expect(groupSize).toBe(3);
    expect(qualifiersPerGroup).toBe(1);
  });

  it('warns when every team in a group would qualify', () => {
    render(
      <TournamentSetup initialPlayers={presentPlayers} initialNumberOfCourts={2} type="group-knockout" onStart={onStart} />,
    );

    fireEvent.change(screen.getByTestId('group-size-input'), { target: { value: '2' } });
    fireEvent.change(screen.getByTestId('qualifiers-input'), { target: { value: '2' } });
    expect(screen.getByTestId('qualifiers-warning')).toBeInTheDocument();
  });
});
