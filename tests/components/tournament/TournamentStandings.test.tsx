import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import TournamentStandings from '../../../src/components/tournament/TournamentStandings';
import type { TournamentStandingRow, TournamentTeam } from '../../../src/tournament/types';
import { createMockPlayer } from '../../data/testFactories';

function makeTeam(id: string, name: string): TournamentTeam {
  return { id, players: [createMockPlayer({ id: `${id}-p`, name })] };
}

function makeRow(team: TournamentTeam, won: number, lost: number, scoreDiff: number): TournamentStandingRow {
  const points = won * 2;
  return { team, played: won + lost, won, lost, points, scoreDiff };
}

const teamA = makeTeam('a', 'Alice');
const teamB = makeTeam('b', 'Bob');
const teamC = makeTeam('c', 'Carol');

const standings: TournamentStandingRow[] = [
  makeRow(teamA, 2, 0, 10),
  makeRow(teamB, 1, 1, -3),
  makeRow(teamC, 0, 2, -7),
];

describe('TournamentStandings (round-robin / showPoints)', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders teams in correct rank order', () => {
    render(
      <TournamentStandings
        standings={standings}
        isComplete={false}
        subtitle="After Round 2 / 3"
        showPoints
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
        isComplete={false}
        subtitle="After Round 2 / 3"
        showPoints
      />,
    );

    expect(screen.getByTestId('score-diff-0')).toHaveTextContent('+10');
    expect(screen.getByTestId('score-diff-1')).toHaveTextContent('-3');
    expect(screen.getByTestId('score-diff-2')).toHaveTextContent('-7');
  });

  it('shows subtitle text', () => {
    render(
      <TournamentStandings
        standings={standings}
        isComplete={false}
        subtitle="After Round 2 / 3"
        showPoints
      />,
    );

    expect(screen.getByTestId('standings-subtitle')).toHaveTextContent('After Round 2 / 3');
  });

  it('applies top class to first row', () => {
    render(
      <TournamentStandings
        standings={standings}
        isComplete={true}
        subtitle="Final Results"
        showPoints
      />,
    );

    expect(screen.getByTestId('standing-row-0')).toHaveClass('top');
    expect(screen.getByTestId('standing-row-1')).not.toHaveClass('top');
  });

  it('shows rank numbers when not complete', () => {
    render(
      <TournamentStandings
        standings={standings}
        isComplete={false}
        subtitle="After Round 2 / 3"
        showPoints
      />,
    );

    const rows = screen.getAllByTestId(/^standing-row-/);
    expect(rows[0]).toHaveTextContent('1');
    expect(rows[1]).toHaveTextContent('2');
    expect(rows[2]).toHaveTextContent('3');
  });
});

describe('TournamentStandings (elimination / no showPoints)', () => {
  it('does not render points or score diff columns', () => {
    render(
      <TournamentStandings
        standings={standings}
        isComplete={false}
        subtitle="In Progress"
      />,
    );

    expect(screen.queryByTestId('score-diff-0')).toBeNull();
    expect(screen.queryByText('Pts')).toBeNull();
  });

  it('shows medal emojis when complete', () => {
    render(
      <TournamentStandings
        standings={standings}
        isComplete={true}
        subtitle="Final Results"
      />,
    );

    const rows = screen.getAllByTestId(/^standing-row-/);
    expect(rows[0]).toHaveTextContent('🥇');
    expect(rows[1]).toHaveTextContent('🥈');
    expect(rows[2]).toHaveTextContent('🥉');
  });
});
