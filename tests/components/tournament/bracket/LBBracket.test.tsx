import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import { LBBracket } from '../../../../src/components/tournament/bracket/LBBracket';
import type { TournamentMatch, TournamentTeam } from '../../../../src/types/tournament';

function makeTeam(id: string, name: string): TournamentTeam {
  return { id, players: [{ id: `p-${id}`, name, isPresent: true }] };
}

function makeMatch(id: string, team1: TournamentTeam, team2: TournamentTeam, round = 1): TournamentMatch {
  return { id, round, bracket: 'lb', courtNumber: 1, team1, team2 };
}

describe('LBBracket', () => {
  it('shows pending message when no LB matches', () => {
    render(<LBBracket lbMatches={[]} teams={[]} onTeamClick={vi.fn()} />);
    expect(screen.getByText(/Awaiting Winners Bracket/i)).toBeInTheDocument();
  });

  it('renders LB matches grouped by round', () => {
    const alice = makeTeam('a', 'Alice');
    const bob = makeTeam('b', 'Bob');
    const carol = makeTeam('c', 'Carol');
    const dana = makeTeam('d', 'Dana');

    const match1 = makeMatch('m1', alice, bob, 1);
    const match2 = makeMatch('m2', carol, dana, 2);

    render(
      <LBBracket
        lbMatches={[match1, match2]}
        teams={[alice, bob, carol, dana]}
        onTeamClick={vi.fn()}
      />,
    );

    expect(screen.getByTestId('bracket-match-m1')).toBeInTheDocument();
    expect(screen.getByTestId('bracket-match-m2')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Carol')).toBeInTheDocument();
  });

  it('calls onTeamClick when a team is clicked', async () => {
    const user = userEvent.setup();
    const alice = makeTeam('a', 'Alice');
    const bob = makeTeam('b', 'Bob');
    const match = makeMatch('m1', alice, bob, 1);
    const onTeamClick = vi.fn();

    render(<LBBracket lbMatches={[match]} teams={[alice, bob]} onTeamClick={onTeamClick} />);

    await user.click(screen.getByTestId('bracket-team-1-m1'));
    expect(onTeamClick).toHaveBeenCalledWith(match, 1);
  });
});
