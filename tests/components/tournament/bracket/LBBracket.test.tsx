import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import { LBBracket } from '../../../../src/components/tournament/bracket/LBBracket';
import { PlayersProvider } from '../../../../src/hooks/usePlayers';
import type { BracketNode } from '../../../../src/components/tournament/bracket/types';
import type { Player } from '../../../../src/types';
import { makeTeam, makeTeamPlayers, makeMatch } from '../../../data/tournamentFactories';

describe('LBBracket', () => {
  it('renders nothing when nodes is empty', () => {
    const { container } = render(
      <PlayersProvider value={[]}>
        <LBBracket nodes={[]} onTeamClick={vi.fn()} />
      </PlayersProvider>,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders TBD nodes when matches are not yet generated', () => {
    const tbdNodes: BracketNode[][] = [
      [{ type: 'tbd', team1: null, team2: null }],
    ];
    render(
      <PlayersProvider value={[]}>
        <LBBracket nodes={tbdNodes} onTeamClick={vi.fn()} />
      </PlayersProvider>,
    );
    expect(screen.getAllByText('TBD').length).toBeGreaterThan(0);
  });

  it('renders LB matches from nodes', () => {
    const alice = makeTeam('a', 'Alice');
    const bob = makeTeam('b', 'Bob');
    const carol = makeTeam('c', 'Carol');
    const dana = makeTeam('d', 'Dana');
    const players: Player[] = [
      ...makeTeamPlayers('a', 'Alice'),
      ...makeTeamPlayers('b', 'Bob'),
      ...makeTeamPlayers('c', 'Carol'),
      ...makeTeamPlayers('d', 'Dana'),
    ];

    const match1 = makeMatch('m1', 1, alice, bob, undefined, undefined, 'lb');
    const match2 = makeMatch('m2', 2, carol, dana, undefined, undefined, 'lb');

    const nodes: BracketNode[][] = [
      [{ type: 'match', match: match1, team1: alice, team2: bob }],
      [{ type: 'match', match: match2, team1: carol, team2: dana }],
    ];

    render(
      <PlayersProvider value={players}>
        <LBBracket nodes={nodes} onTeamClick={vi.fn()} />
      </PlayersProvider>,
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
    const players: Player[] = [
      ...makeTeamPlayers('a', 'Alice'),
      ...makeTeamPlayers('b', 'Bob'),
    ];
    const match = makeMatch('m1', 1, alice, bob, undefined, undefined, 'lb');
    const onTeamClick = vi.fn();

    const nodes: BracketNode[][] = [
      [{ type: 'match', match, team1: alice, team2: bob }],
    ];

    render(
      <PlayersProvider value={players}>
        <LBBracket nodes={nodes} onTeamClick={onTeamClick} />
      </PlayersProvider>,
    );

    await user.click(screen.getByTestId('bracket-team-1-m1'));
    expect(onTeamClick).toHaveBeenCalledWith(match, 1);
  });
});
