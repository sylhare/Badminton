import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import TournamentStandings from '../../../src/components/tournament/TournamentStandings';
import { PlayersProvider } from '../../../src/hooks/usePlayers';
import type { TournamentStandingRow, TournamentTeam } from '../../../src/types/tournament';
import { makeTeam, makeTeamPlayers } from '../../data/tournamentFactories';

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
  const players = [
    ...makeTeamPlayers('a', 'Alice'),
    ...makeTeamPlayers('b', 'Bob'),
    ...makeTeamPlayers('c', 'Carol'),
  ];

  const standings: TournamentStandingRow[] = [
    makeRow(teamA, 2, 0, 10),
    makeRow(teamB, 1, 1, -3),
    makeRow(teamC, 0, 2, -7),
  ];

  it('renders teams in correct rank order', () => {
    render(
      <PlayersProvider value={players}>
        <TournamentStandings
          standings={standings}
          currentRound={2}
          totalRounds={3}
        />
      </PlayersProvider>,
    );

    const rows = screen.getAllByTestId(/^standing-row-/);
    expect(rows[0]).toHaveTextContent('Alice');
    expect(rows[1]).toHaveTextContent('Bob');
    expect(rows[2]).toHaveTextContent('Carol');
  });

  it('shows score diff column with correct values', () => {
    render(
      <PlayersProvider value={players}>
        <TournamentStandings
          standings={standings}
          currentRound={2}
          totalRounds={3}
        />
      </PlayersProvider>,
    );

    expect(screen.getByTestId('score-diff-0')).toHaveTextContent('+10');
    expect(screen.getByTestId('score-diff-1')).toHaveTextContent('-3');
    expect(screen.getByTestId('score-diff-2')).toHaveTextContent('-7');
  });

  it('shows After Round N / M label', () => {
    render(
      <PlayersProvider value={players}>
        <TournamentStandings
          standings={standings}
          currentRound={2}
          totalRounds={3}
        />
      </PlayersProvider>,
    );

    expect(screen.getByTestId('standings-subtitle')).toHaveTextContent('After Round 2 / 3');
  });

  it('applies top class to first row', () => {
    render(
      <PlayersProvider value={players}>
        <TournamentStandings
          standings={standings}
          currentRound={3}
          totalRounds={3}
        />
      </PlayersProvider>,
    );

    expect(screen.getByTestId('standing-row-0')).toHaveClass('top');
    expect(screen.getByTestId('standing-row-1')).not.toHaveClass('top');
  });

  it('shows rank numbers', () => {
    render(
      <PlayersProvider value={players}>
        <TournamentStandings
          standings={standings}
          currentRound={2}
          totalRounds={3}
        />
      </PlayersProvider>,
    );

    const rows = screen.getAllByTestId(/^standing-row-/);
    expect(rows[0]).toHaveTextContent('1');
    expect(rows[1]).toHaveTextContent('2');
    expect(rows[2]).toHaveTextContent('3');
  });
});
