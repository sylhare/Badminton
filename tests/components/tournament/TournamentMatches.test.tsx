import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import TournamentMatches from '../../../src/components/tournament/TournamentMatches';
import { makeTeam, makeMatch } from '../../data/tournamentFactories';

const teamA = makeTeam('a', ['Alice']);
const teamB = makeTeam('b', ['Bob']);
const teamC = makeTeam('c', ['Carol']);

describe('TournamentMatches', () => {
  let onMatchResult: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onMatchResult = vi.fn();
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
      <TournamentMatches
        matches={threeMatchSingles}
        onMatchResult={onMatchResult}
      />,
    );

    expect(screen.getByTestId('round-1')).toBeInTheDocument();
    expect(screen.getByTestId('round-2')).toBeInTheDocument();
    expect(screen.getByTestId('round-3')).toBeInTheDocument();
  });

  it('current round (round 1) is expanded by default', () => {
    render(
      <TournamentMatches
        matches={threeMatchSingles}
        onMatchResult={onMatchResult}
      />,
    );

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('completed round shows score inline', () => {
    const completedMatch = makeMatch('m1', 1, teamA, teamB, 1, { team1: 21, team2: 14 });
    render(
      <TournamentMatches
        matches={[completedMatch]}
        onMatchResult={onMatchResult}
      />,
    );

    expect(screen.getByTestId(`match-result-m1`)).toBeInTheDocument();
    expect(screen.getByText('21 – 14')).toBeInTheDocument();
  });
});
