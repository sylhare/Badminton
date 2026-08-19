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

  it('continues the split preview into the every-team-advances note, still allowing Start', () => {
    render(
      <TournamentSetup initialPlayers={presentPlayers} initialNumberOfCourts={2} type="group-knockout" onStart={onStart} />,
    );

    fireEvent.change(screen.getByTestId('group-size-input'), { target: { value: '3' } });
    fireEvent.change(screen.getByTestId('qualifiers-input'), { target: { value: '2' } });

    const note = screen.getByTestId('group-preview');
    expect(note).toHaveTextContent(/2 groups of 2/);
    expect(note).toHaveTextContent(/every team advances/i);
    expect(screen.queryByTestId('qualifiers-warning')).not.toBeInTheDocument();
    expect(screen.getByTestId('start-tournament-button')).toBeEnabled();
  });

  it('previews the real group split as one message, saying the requested size cannot be reached', () => {
    render(
      <TournamentSetup initialPlayers={presentPlayers} initialNumberOfCourts={2} type="group-knockout" onStart={onStart} />,
    );

    fireEvent.change(screen.getByTestId('group-size-input'), { target: { value: '3' } });
    fireEvent.change(screen.getByTestId('qualifiers-input'), { target: { value: '1' } });
    expect(screen.getByTestId('group-preview'))
      .toHaveTextContent('4 teams can\'t fill groups of 3, so they\'ll play as 2 groups of 2.');
  });

  it('colours an undersized split as a warning but keeps a reachable split a neutral hint', () => {
    render(
      <TournamentSetup initialPlayers={presentPlayers} initialNumberOfCourts={2} type="group-knockout" onStart={onStart} />,
    );

    fireEvent.change(screen.getByTestId('qualifiers-input'), { target: { value: '1' } });

    fireEvent.change(screen.getByTestId('group-size-input'), { target: { value: '3' } });
    expect(screen.getByTestId('group-preview')).toHaveClass('setup-warning');

    fireEvent.change(screen.getByTestId('group-size-input'), { target: { value: '2' } });
    expect(screen.getByTestId('group-preview')).toHaveClass('setup-hint');
  });

  it('pre-fills the form from the current tournament settings', async () => {
    const user = userEvent.setup();
    render(
      <TournamentSetup
        initialPlayers={presentPlayers}
        initialNumberOfCourts={2}
        type="group-knockout"
        initialConfig={{ type: 'group-knockout', format: 'doubles', numberOfCourts: 5, bestOf: 3, setSize: 15, groupSize: 3, qualifiersPerGroup: 1 }}
        onStart={onStart}
      />,
    );

    expect(screen.getByTestId('group-size-input')).toHaveValue(3);
    expect(screen.getByTestId('qualifiers-input')).toHaveValue(1);
    expect(screen.getByTestId('set-size-input')).toHaveValue(15);
    expect(screen.getByTestId('tournament-court-count')).toHaveValue(5);

    await user.click(screen.getByTestId('start-tournament-button'));
    const [, options] = onStart.mock.calls[0];
    expect(options).toMatchObject({ bestOf: 3, setSize: 15, groupSize: 3, qualifiersPerGroup: 1, numberOfCourts: 5 });
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
