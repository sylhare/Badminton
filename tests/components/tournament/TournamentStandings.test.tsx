import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import TournamentStandings from '../../../src/components/tournament/TournamentStandings';
import type { TournamentStandingRow, TournamentTeam } from '../../../src/types/tournament';
import { createMockPlayer } from '../../data/testFactories';

function makeTeam(id: string, name: string): TournamentTeam {
  return { id, players: [createMockPlayer({ id: `${id}-p`, name })] };
}

function makeRow(team: TournamentTeam, won: number, lost: number, scoreDiff: number): TournamentStandingRow {
  const points = won * 2;
  return { team, played: won + lost, won, lost, points, scoreDiff };
}

describe('TournamentStandings', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  const teamA = makeTeam('a', 'Alice');
  const teamB = makeTeam('b', 'Bob');
  const teamC = makeTeam('c', 'Carol');

  const standings: TournamentStandingRow[] = [
    makeRow(teamA, 2, 0, 10),
    makeRow(teamB, 1, 1, -3),
    makeRow(teamC, 0, 2, -7),
  ];

  it('renders teams in correct rank order', () => {
    render(
      <TournamentStandings
        standings={standings}
        currentRound={2}
        totalRounds={3}
        isComplete={false}
      />,
    );

    const rows = screen.getAllByTestId(/^standing-row-/);
    expect(rows[0]).toHaveTextContent('Alice');
    expect(rows[1]).toHaveTextContent('Bob');
    expect(rows[2]).toHaveTextContent('Carol');
  });

  it('shows score diff column with correct values', () => {
    render(
      <TournamentStandings
        standings={standings}
        currentRound={2}
        totalRounds={3}
        isComplete={false}
      />,
    );

    expect(screen.getByTestId('score-diff-0')).toHaveTextContent('+10');
    expect(screen.getByTestId('score-diff-1')).toHaveTextContent('-3');
    expect(screen.getByTestId('score-diff-2')).toHaveTextContent('-7');
  });

  it('shows After Round N / M label when not complete', () => {
    render(
      <TournamentStandings
        standings={standings}
        currentRound={2}
        totalRounds={3}
        isComplete={false}
      />,
    );

    expect(screen.getByTestId('standings-subtitle')).toHaveTextContent('After Round 2 / 3');
  });

  it('does NOT show reset button when isComplete=false', () => {
    render(
      <TournamentStandings
        standings={standings}
        currentRound={2}
        totalRounds={3}
        isComplete={false}
      />,
    );

    expect(screen.queryByTestId('reset-tournament-button')).not.toBeInTheDocument();
  });

  it('shows Final Results heading when isComplete=true', () => {
    render(
      <TournamentStandings
        standings={standings}
        currentRound={3}
        totalRounds={3}
        isComplete={true}
        onReset={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Final Results');
  });

  it('shows reset button when isComplete=true with onReset', () => {
    render(
      <TournamentStandings
        standings={standings}
        currentRound={3}
        totalRounds={3}
        isComplete={true}
        onReset={vi.fn()}
      />,
    );

    expect(screen.getByTestId('reset-tournament-button')).toBeInTheDocument();
  });

  it('calls onReset when reset button clicked', async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    render(
      <TournamentStandings
        standings={standings}
        currentRound={3}
        totalRounds={3}
        isComplete={true}
        onReset={onReset}
      />,
    );

    await user.click(screen.getByTestId('reset-tournament-button'));
    expect(onReset).toHaveBeenCalledOnce();
  });

  it('applies top class to first row', () => {
    render(
      <TournamentStandings
        standings={standings}
        currentRound={3}
        totalRounds={3}
        isComplete={false}
      />,
    );

    expect(screen.getByTestId('standing-row-0')).toHaveClass('top');
    expect(screen.getByTestId('standing-row-1')).not.toHaveClass('top');
  });

  it('shows rank numbers', () => {
    render(
      <TournamentStandings
        standings={standings}
        currentRound={2}
        totalRounds={3}
        isComplete={false}
      />,
    );

    const rows = screen.getAllByTestId(/^standing-row-/);
    expect(rows[0]).toHaveTextContent('1');
    expect(rows[1]).toHaveTextContent('2');
    expect(rows[2]).toHaveTextContent('3');
  });
});
