import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { GroupKnockout } from '../../../src/components/tournament/GroupKnockout';
import { GroupKnockoutTournament } from '../../../src/tournament/GroupKnockoutTournament';
import { createTournamentTeams } from '../../data/testFactories';

function startTournament(teamIds: string[], groupSize: number, qualifiersPerGroup: number) {
  return GroupKnockoutTournament
    .create('doubles', 2, 1, groupSize, qualifiersPerGroup)
    .start(createTournamentTeams(teamIds), 2);
}

function decideGroupPhase(tournament: GroupKnockoutTournament): GroupKnockoutTournament {
  let current = tournament;
  for (const id of current.groupMatches().map(m => m.id)) {
    current = current.withMatchResult(id, 1, [{ team1: 21, team2: 10 }]);
  }
  return current;
}

describe('GroupKnockout', () => {
  it('renders a section with a standings table for each group', () => {
    const tournament = startTournament(['a', 'b', 'c', 'd', 'e', 'f'], 3, 2);
    render(<GroupKnockout tournament={tournament} onMatchResult={vi.fn()} />);

    expect(screen.getByTestId('group-section-0')).toBeInTheDocument();
    expect(screen.getByTestId('group-section-1')).toBeInTheDocument();
    expect(screen.queryByTestId('group-section-2')).not.toBeInTheDocument();
    expect(screen.getByTestId('group-0-standing-0')).toBeInTheDocument();
  });

  it('does not show the knockout stage while the group phase is in progress', () => {
    const tournament = startTournament(['a', 'b', 'c', 'd'], 2, 1);
    render(<GroupKnockout tournament={tournament} onMatchResult={vi.fn()} />);

    expect(screen.getByTestId('group-stage')).toBeInTheDocument();
    expect(screen.queryByTestId('knockout-stage')).not.toBeInTheDocument();
  });

  it('shows the knockout bracket once the group phase completes', () => {
    const decided = decideGroupPhase(startTournament(['a', 'b', 'c', 'd'], 2, 1));
    render(<GroupKnockout tournament={decided} onMatchResult={vi.fn()} />);

    expect(screen.getByTestId('knockout-stage')).toBeInTheDocument();
    expect(screen.getByTestId('elimination-bracket')).toBeInTheDocument();
  });

  it('marks the qualifying rows in each group standings table', () => {
    const decided = decideGroupPhase(startTournament(['a', 'b', 'c', 'd'], 2, 1));
    render(<GroupKnockout tournament={decided} onMatchResult={vi.fn()} />);

    expect(screen.getByTestId('group-0-standing-0')).toHaveClass('qualified');
    expect(screen.getByTestId('group-0-standing-1')).not.toHaveClass('qualified');
  });

  it('routes a group match result through onMatchResult', async () => {
    const user = userEvent.setup();
    const onMatchResult = vi.fn();
    const tournament = startTournament(['a', 'b', 'c', 'd'], 2, 1);
    render(<GroupKnockout tournament={tournament} onMatchResult={onMatchResult} />);

    const firstMatch = tournament.groupMatches()[0];
    const matchArea = within(screen.getByTestId('group-section-0')).getByTestId('tournament-matches');
    await user.click(within(matchArea).getByText(firstMatch.team1.players[0].name));
    await user.click(screen.getByTestId('score-modal-confirm'));

    expect(onMatchResult).toHaveBeenCalledWith(firstMatch.id, 1, [{ team1: 21, team2: 18 }]);
  });
});
