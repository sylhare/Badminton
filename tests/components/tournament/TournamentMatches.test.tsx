import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import TournamentMatches from '../../../src/components/tournament/TournamentMatches';
import type { TournamentMatch, TournamentTeam } from '../../../src/types/tournament';
import { createMockPlayer } from '../../data/testFactories';

function makeTeam(id: string, playerNames: string[]): TournamentTeam {
  return {
    id,
    players: playerNames.map((name, i) => createMockPlayer({ id: `${id}-p${i}`, name })),
  };
}

function makeMatch(
  id: string,
  round: number,
  team1: TournamentTeam,
  team2: TournamentTeam,
  winner?: 1 | 2,
  score?: { team1: number; team2: number },
): TournamentMatch {
  return { id, round, courtNumber: 1, team1, team2, winner, score };
}

const teamA = makeTeam('a', ['Alice']);
const teamB = makeTeam('b', ['Bob']);
const teamC = makeTeam('c', ['Carol']);

describe('TournamentMatches', () => {
  let onMatchResult: ReturnType<typeof vi.fn>;
  let onComplete: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onMatchResult = vi.fn();
    onComplete = vi.fn();
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
        onComplete={onComplete}
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
        onComplete={onComplete}
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
        onComplete={onComplete}
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
        onComplete={onComplete}
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

  it('clicking skip calls onMatchResult with score=undefined', async () => {
    const user = userEvent.setup();
    render(
      <TournamentMatches
        matches={threeMatchSingles}
        onMatchResult={onMatchResult}
        onComplete={onComplete}
      />,
    );

    await user.click(screen.getAllByText('Alice')[0]);
    await user.click(screen.getByTestId('score-modal-skip'));

    expect(onMatchResult).toHaveBeenCalledOnce();
    expect(onMatchResult).toHaveBeenCalledWith('m1', 1, undefined);
  });

  it('cancelling modal does not call onMatchResult', async () => {
    const user = userEvent.setup();
    render(
      <TournamentMatches
        matches={threeMatchSingles}
        onMatchResult={onMatchResult}
        onComplete={onComplete}
      />,
    );

    await user.click(screen.getAllByText('Alice')[0]);
    expect(screen.getByTestId('score-input-modal')).toBeInTheDocument();

    // Click the overlay to cancel
    await user.click(screen.getByTestId('score-input-modal'));

    expect(onMatchResult).not.toHaveBeenCalled();
  });

  it('clicking winner again on completed match clears winner', async () => {
    const user = userEvent.setup();
    // Single match in round 1 (already completed) so it's the current/expanded round
    const matchWithWinner = makeMatch('m1', 1, teamA, teamB, 1);
    render(
      <TournamentMatches
        matches={[matchWithWinner]}
        onMatchResult={onMatchResult}
        onComplete={onComplete}
      />,
    );

    // Alice is team1Player with winner=1 → clicking again should deselect
    const aliceEl = screen.getAllByText('Alice')[0];
    await user.click(aliceEl);

    expect(onMatchResult).toHaveBeenCalledWith('m1', 1);
  });

  it('Finish Tournament button disabled while matches unfinished', () => {
    render(
      <TournamentMatches
        matches={threeMatchSingles}
        onMatchResult={onMatchResult}
        onComplete={onComplete}
      />,
    );

    expect(screen.getByTestId('finish-tournament-button')).toBeDisabled();
  });

  it('Finish Tournament button enabled when all matches done', () => {
    const allDone: TournamentMatch[] = [
      makeMatch('m1', 1, teamA, teamB, 1),
      makeMatch('m2', 2, teamA, teamC, 2),
      makeMatch('m3', 3, teamB, teamC, 1),
    ];
    render(
      <TournamentMatches
        matches={allDone}
        onMatchResult={onMatchResult}
        onComplete={onComplete}
      />,
    );

    expect(screen.getByTestId('finish-tournament-button')).not.toBeDisabled();
  });

  it('clicking Finish Tournament calls onComplete', async () => {
    const user = userEvent.setup();
    const allDone: TournamentMatch[] = [
      makeMatch('m1', 1, teamA, teamB, 1),
      makeMatch('m2', 2, teamA, teamC, 2),
      makeMatch('m3', 3, teamB, teamC, 1),
    ];
    render(
      <TournamentMatches
        matches={allDone}
        onMatchResult={onMatchResult}
        onComplete={onComplete}
      />,
    );

    await user.click(screen.getByTestId('finish-tournament-button'));
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('completed round shows score inline', () => {
    const completedMatch = makeMatch('m1', 1, teamA, teamB, 1, { team1: 21, team2: 14 });
    render(
      <TournamentMatches
        matches={[completedMatch]}
        onMatchResult={onMatchResult}
        onComplete={onComplete}
      />,
    );

    expect(screen.getByTestId(`match-result-m1`)).toBeInTheDocument();
    expect(screen.getByText('21 – 14')).toBeInTheDocument();
  });
});
