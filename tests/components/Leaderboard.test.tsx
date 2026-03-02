import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import Leaderboard from '../../src/components/Leaderboard';
import type { Player } from '../../src/types';
import { TEST_PLAYERS } from '../data/testData';

describe('Leaderboard Component', () => {
  const mockPlayers = TEST_PLAYERS.slice(0, 2);

  it('does not render when no player has wins', () => {
    const winCounts = new Map<string, number>();
    const { container } = render(<Leaderboard players={mockPlayers} winCounts={winCounts} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders table when at least one player has a win', () => {
    const winCounts = new Map<string, number>([['1', 2]]);
    render(<Leaderboard players={mockPlayers} winCounts={winCounts} />);

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows absent players with wins', () => {
    const players: Player[] = [
      { id: '1', name: 'Alice', isPresent: true },
      { id: '2', name: 'Bob', isPresent: false },
    ];
    const winCounts = new Map([['2', 3]]);

    render(<Leaderboard players={players} winCounts={winCounts} />);

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText(/Bob/)).toBeInTheDocument();
  });

  it('does not show players from win data who are not in the players list', () => {
    const players: Player[] = [
      { id: '1', name: 'Alice', isPresent: true },
    ];
    const winCounts = new Map([
      ['1', 2],
      ['unknown-id', 5],
    ]);

    render(<Leaderboard players={players} winCounts={winCounts} />);

    expect(screen.getAllByRole('row')).toHaveLength(2);
  });

  it('ranks players by wins descending', () => {
    const players: Player[] = [
      { id: '1', name: 'Alice', isPresent: true },
      { id: '2', name: 'Bob', isPresent: true },
      { id: '3', name: 'Charlie', isPresent: true },
    ];
    const winCounts = new Map([['1', 1], ['2', 3], ['3', 2]]);

    render(<Leaderboard players={players} winCounts={winCounts} />);

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('Bob');
    expect(rows[1]).toHaveTextContent('Charlie');
    expect(rows[2]).toHaveTextContent('Alice');
  });
});