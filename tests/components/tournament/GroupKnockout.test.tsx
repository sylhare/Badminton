import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { GroupKnockout } from '../../../src/components/tournament/GroupKnockout';
import { GroupKnockoutTournament } from '../../../src/tournament/GroupKnockoutTournament';
import type { TournamentMatch } from '../../../src/tournament/types';
import { createTournamentTeams } from '../../data/testFactories';

function startTournament(teamIds: string[], groupSize: number, qualifiersPerGroup: number) {
  return GroupKnockoutTournament
    .create({ format: 'doubles', numberOfCourts: 2, bestOf: 1, groupSize, qualifiersPerGroup })
    .start(createTournamentTeams(teamIds), 2);
}

/** A single group of three whose cyclic results (a>b>c>a) leave every team exactly tied. */
function tiedGroupTournament(): GroupKnockoutTournament {
  const teams = createTournamentTeams(['a', 'b', 'c']);
  const [a, b, c] = teams;
  const set = [{ team1: 21, team2: 10 }];
  const matches: TournamentMatch[] = [
    { id: 'g0', round: 1, courtNumber: 1, team1: a, team2: b, winner: 1, sets: set, group: 0 },
    { id: 'g1', round: 2, courtNumber: 1, team1: b, team2: c, winner: 1, sets: set, group: 0 },
    { id: 'g2', round: 3, courtNumber: 1, team1: c, team2: a, winner: 1, sets: set, group: 0 },
  ];
  return GroupKnockoutTournament.fromState({
    format: 'singles', type: 'group-knockout', numberOfCourts: 1, bestOf: 1,
    teams, matches, groupSize: 3, qualifiersPerGroup: 2,
  });
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
    render(<GroupKnockout tournament={tournament} onMatchResult={vi.fn()} onUpdateTournament={vi.fn()} />);

    expect(screen.getByTestId('group-section-0')).toBeInTheDocument();
    expect(screen.getByTestId('group-section-1')).toBeInTheDocument();
    expect(screen.queryByTestId('group-section-2')).not.toBeInTheDocument();
    expect(screen.getByTestId('group-0-standing-0')).toBeInTheDocument();
  });

  it('does not show the knockout stage while the group phase is in progress', () => {
    const tournament = startTournament(['a', 'b', 'c', 'd'], 2, 1);
    render(<GroupKnockout tournament={tournament} onMatchResult={vi.fn()} onUpdateTournament={vi.fn()} />);

    expect(screen.getByTestId('group-stage')).toBeInTheDocument();
    expect(screen.queryByTestId('knockout-stage')).not.toBeInTheDocument();
  });

  it('shows the knockout bracket once the group phase completes', () => {
    const decided = decideGroupPhase(startTournament(['a', 'b', 'c', 'd'], 2, 1));
    render(<GroupKnockout tournament={decided} onMatchResult={vi.fn()} onUpdateTournament={vi.fn()} />);

    expect(screen.getByTestId('knockout-stage')).toBeInTheDocument();
    expect(screen.getByTestId('elimination-bracket')).toBeInTheDocument();
  });

  it('marks the qualifying rows in each group standings table', () => {
    const decided = decideGroupPhase(startTournament(['a', 'b', 'c', 'd'], 2, 1));
    render(<GroupKnockout tournament={decided} onMatchResult={vi.fn()} onUpdateTournament={vi.fn()} />);

    expect(screen.getByTestId('group-0-standing-0')).toHaveClass('qualified');
    expect(screen.getByTestId('group-0-standing-1')).not.toHaveClass('qualified');
  });

  it('routes a group match result through onMatchResult', async () => {
    const user = userEvent.setup();
    const onMatchResult = vi.fn();
    const tournament = startTournament(['a', 'b', 'c', 'd'], 2, 1);
    render(<GroupKnockout tournament={tournament} onMatchResult={onMatchResult} onUpdateTournament={vi.fn()} />);

    const firstMatch = tournament.groupMatches()[0];
    const matchArea = within(screen.getByTestId('group-section-0')).getByTestId('tournament-matches');
    await user.click(within(matchArea).getByText(firstMatch.team1.players[0].name));
    await user.click(screen.getByTestId('score-modal-confirm'));

    expect(onMatchResult).toHaveBeenCalledWith(firstMatch.id, 1, [{ team1: 21, team2: 18 }]);
  });

  it('shows sets-won and score-diff columns in the group tables', () => {
    const tournament = startTournament(['a', 'b', 'c', 'd'], 2, 1);
    render(<GroupKnockout tournament={tournament} onMatchResult={vi.fn()} onUpdateTournament={vi.fn()} />);

    const groupA = within(screen.getByTestId('group-section-0'));
    expect(groupA.getByTestId('set-diff-0')).toBeInTheDocument();
    expect(groupA.getByTestId('score-diff-0')).toBeInTheDocument();
  });

  it('offers a tie-break control for tied teams and saves a manual order', async () => {
    const user = userEvent.setup();
    const onUpdateTournament = vi.fn();
    render(
      <GroupKnockout
        tournament={tiedGroupTournament()}
        onMatchResult={vi.fn()}
        onUpdateTournament={onUpdateTournament}
      />,
    );

    await user.click(screen.getByTestId('tie-break-0-0'));
    expect(screen.getByTestId('manual-order-modal')).toBeInTheDocument();

    await user.click(screen.getByTestId('manual-order-down-0'));
    await user.click(screen.getByTestId('manual-order-save'));

    expect(onUpdateTournament).toHaveBeenCalledTimes(1);
    expect(onUpdateTournament.mock.calls[0][0].state().manualPoints).toEqual({ b: 3, a: 2, c: 1 });
  });

  it('warns that a tie blocks the knockout, and clears the warning once it is resolved', () => {
    const tied = tiedGroupTournament();
    const { rerender } = render(
      <GroupKnockout tournament={tied} onMatchResult={vi.fn()} onUpdateTournament={vi.fn()} />,
    );

    expect(screen.getByTestId('knockout-tie-warning')).toBeInTheDocument();
    expect(screen.queryByTestId('knockout-stage')).not.toBeInTheDocument();

    rerender(
      <GroupKnockout
        tournament={tied.withManualOrder(['a', 'b', 'c'])}
        onMatchResult={vi.fn()}
        onUpdateTournament={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('knockout-tie-warning')).not.toBeInTheDocument();
    expect(screen.getByTestId('knockout-stage')).toBeInTheDocument();
  });

  it('does not warn about ties when the group phase is still in progress', () => {
    const tournament = startTournament(['a', 'b', 'c', 'd'], 2, 1);
    render(<GroupKnockout tournament={tournament} onMatchResult={vi.fn()} onUpdateTournament={vi.fn()} />);

    expect(screen.queryByTestId('knockout-tie-warning')).not.toBeInTheDocument();
  });

  it('hides the tie-break control once the knockout has started', () => {
    const decided = decideGroupPhase(startTournament(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], 4, 1));
    render(<GroupKnockout tournament={decided} onMatchResult={vi.fn()} onUpdateTournament={vi.fn()} />);

    expect(screen.getByTestId('knockout-stage')).toBeInTheDocument();
    expect(screen.queryByTestId('tie-break-0-1')).not.toBeInTheDocument();
  });

  it('shows the final standings table once the tournament is complete', () => {
    let decided = decideGroupPhase(startTournament(['a', 'b', 'c', 'd'], 2, 1));
    decided = decided.withMatchResult(decided.knockoutMatches()[0].id, 1, [{ team1: 21, team2: 15 }]);
    render(<GroupKnockout tournament={decided} onMatchResult={vi.fn()} onUpdateTournament={vi.fn()} />);

    expect(screen.getByTestId('group-knockout-final')).toBeInTheDocument();
    expect(screen.getByTestId('tournament-standings')).toBeInTheDocument();
  });
});
