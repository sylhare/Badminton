import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import RoundRobinMatches from '../../../../src/components/tournament/round-robin/RoundRobinMatches';
import { RoundRobinTournament } from '../../../../src/tournament/RoundRobinTournament';
import type { TournamentMatch, TournamentTeam } from '../../../../src/tournament/types';
import { createMockPlayer } from '../../../data/testFactories';

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

function makeTournament(matches: TournamentMatch[], teams: TournamentTeam[]) {
  return RoundRobinTournament.fromState({
    phase: 'active',
    format: 'singles',
    type: 'round-robin',
    numberOfCourts: 1,
    teams,
    matches,
  });
}

const teamA = makeTeam('a', ['Alice']);
const teamB = makeTeam('b', ['Bob']);
const teamC = makeTeam('c', ['Carol']);

describe('RoundRobinMatches', () => {
  let onMatchResult: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onMatchResult = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const threeMatchSingles = makeTournament(
    [
      makeMatch('m1', 1, teamA, teamB),
      makeMatch('m2', 2, teamA, teamC),
      makeMatch('m3', 3, teamB, teamC),
    ],
    [teamA, teamB, teamC],
  );

  it('renders all rounds', () => {
    render(
      <RoundRobinMatches
        tournament={threeMatchSingles}
        onMatchResult={onMatchResult}
      />,
    );

    expect(screen.getByTestId('round-1')).toBeInTheDocument();
    expect(screen.getByTestId('round-2')).toBeInTheDocument();
    expect(screen.getByTestId('round-3')).toBeInTheDocument();
  });

  it('current round (round 1) is expanded by default', () => {
    render(
      <RoundRobinMatches
        tournament={threeMatchSingles}
        onMatchResult={onMatchResult}
      />,
    );

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('clicking team 1 opens ScoreInputModal with winnerTeam=1', async () => {
    const user = userEvent.setup();
    render(
      <RoundRobinMatches
        tournament={threeMatchSingles}
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
      <RoundRobinMatches
        tournament={threeMatchSingles}
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
      <RoundRobinMatches
        tournament={threeMatchSingles}
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
      <RoundRobinMatches
        tournament={threeMatchSingles}
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
    const tournament = makeTournament(
      [makeMatch('m1', 1, teamA, teamB, 1)],
      [teamA, teamB],
    );
    render(
      <RoundRobinMatches
        tournament={tournament}
        onMatchResult={onMatchResult}
      />,
    );

    const aliceEl = screen.getAllByText('Alice')[0];
    await user.click(aliceEl);

    expect(onMatchResult).toHaveBeenCalledWith('m1', 1);
  });

  it('completed round shows score inline', () => {
    const tournament = makeTournament(
      [makeMatch('m1', 1, teamA, teamB, 1, { team1: 21, team2: 14 })],
      [teamA, teamB],
    );
    render(
      <RoundRobinMatches
        tournament={tournament}
        onMatchResult={onMatchResult}
      />,
    );

    expect(screen.getByTestId(`match-result-m1`)).toBeInTheDocument();
    expect(screen.getByText('21 – 14')).toBeInTheDocument();
  });
});
