import React from 'react';
import { afterEach, beforeEach, describe, expect, it, type MockedFunction, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import TournamentMatches from '../../../src/components/tournament/TournamentMatches';
import { PlayersProvider } from '../../../src/hooks/usePlayers';
import type { TournamentMatch } from '../../../src/tournament/types.ts';
import type { Player } from '../../../src/types';
import { makeMatch, makeTeam, makeTeamPlayers } from '../../data/tournamentFactories';

const teamA = makeTeam('a', ['Alice']);
const teamB = makeTeam('b', ['Bob']);
const teamC = makeTeam('c', ['Carol']);
const players: Player[] = [
  ...makeTeamPlayers('a', ['Alice']),
  ...makeTeamPlayers('b', ['Bob']),
  ...makeTeamPlayers('c', ['Carol']),
];

describe('TournamentMatches', () => {
  let onMatchResult: MockedFunction<React.ComponentProps<typeof TournamentMatches>['onMatchResult']>;

  beforeEach(() => {
    onMatchResult = vi.fn() as typeof onMatchResult;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const threeMatchSingles: TournamentMatch[] = [
    makeMatch('m1', 1, teamA, teamB),
    makeMatch('m2', 2, teamA, teamC),
    makeMatch('m3', 3, teamB, teamC),
  ];

  it('renders all rounds', () => {
    render(
      <PlayersProvider value={players}>
        <TournamentMatches
          matches={threeMatchSingles}
          currentRound={1}
          roundNums={[1, 2, 3]}
          onMatchResult={onMatchResult}
        />
      </PlayersProvider>,
    );

    expect(screen.getByTestId('round-1')).toBeInTheDocument();
    expect(screen.getByTestId('round-2')).toBeInTheDocument();
    expect(screen.getByTestId('round-3')).toBeInTheDocument();
  });

  it('current round (round 1) is expanded by default', () => {
    render(
      <PlayersProvider value={players}>
        <TournamentMatches
          matches={threeMatchSingles}
          currentRound={1}
          roundNums={[1, 2, 3]}
          onMatchResult={onMatchResult}
        />
      </PlayersProvider>,
    );

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('completed round shows score inline', () => {
    const completedMatch = makeMatch('m1', 1, teamA, teamB, 1, { team1: 21, team2: 14 });
    render(
      <PlayersProvider value={players}>
        <TournamentMatches
          matches={[completedMatch]}
          currentRound={1}
          roundNums={[1]}
          onMatchResult={onMatchResult}
        />
      </PlayersProvider>,
    );

    expect(screen.getByTestId(`match-result-m1`)).toBeInTheDocument();
    expect(screen.getByText('21 – 14')).toBeInTheDocument();
  });
});
