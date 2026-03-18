import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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

  it('clicking team 1 opens ScoreInputModal with winnerTeam=1', async () => {
    const user = userEvent.setup();
    render(
      <TournamentMatches
        matches={threeMatchSingles}
        onMatchResult={onMatchResult}
      />,
    );

    const aliceEl = screen.getAllByText('Alice')[0];
    await user.click(aliceEl);

    expect(screen.getByTestId('score-input-modal')).toBeInTheDocument();
    expect(screen.getByText(/Team 1 wins/)).toBeInTheDocument();
  });

  it('confirming modal with scores calls onMatchResult with correct args', async () => {
    const user = userEvent.setup();
    render(
      <TournamentMatches
        matches={threeMatchSingles}
        onMatchResult={onMatchResult}
      />,
    );

    await user.click(screen.getAllByText('Alice')[0]);
    await user.clear(screen.getByTestId('score-input-team1'));
    await user.type(screen.getByTestId('score-input-team1'), '21');
    await user.clear(screen.getByTestId('score-input-team2'));
    await user.type(screen.getByTestId('score-input-team2'), '15');
    await user.click(screen.getByTestId('score-modal-confirm'));

    expect(onMatchResult).toHaveBeenCalledOnce();
    expect(onMatchResult).toHaveBeenCalledWith('m1', 1, { team1: 21, team2: 15 });
  });

  it('confirming modal without entering scores uses defaults', async () => {
    const user = userEvent.setup();
    render(
      <TournamentMatches
        matches={threeMatchSingles}
        onMatchResult={onMatchResult}
      />,
    );

    await user.click(screen.getAllByText('Alice')[0]);
    await user.click(screen.getByTestId('score-modal-confirm'));

    expect(onMatchResult).toHaveBeenCalledOnce();
    expect(onMatchResult).toHaveBeenCalledWith('m1', 1, { team1: 21, team2: 18 });
  });

  it('cancelling modal does not call onMatchResult', async () => {
    const user = userEvent.setup();
    render(
      <TournamentMatches
        matches={threeMatchSingles}
        onMatchResult={onMatchResult}
      />,
    );

    await user.click(screen.getAllByText('Alice')[0]);
    expect(screen.getByTestId('score-input-modal')).toBeInTheDocument();

    await user.click(screen.getByTestId('score-input-modal'));

    expect(onMatchResult).not.toHaveBeenCalled();
  });

  it('clicking winner again on completed match clears winner', async () => {
    const user = userEvent.setup();
    const matchWithWinner = makeMatch('m1', 1, teamA, teamB, 1);
    render(
      <TournamentMatches
        matches={[matchWithWinner]}
        onMatchResult={onMatchResult}
      />,
    );

    const aliceEl = screen.getAllByText('Alice')[0];
    await user.click(aliceEl);

    expect(onMatchResult).toHaveBeenCalledWith('m1', 1);
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
