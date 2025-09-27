import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import Leaderboard from '../../src/components/Leaderboard';
import type { Player } from '../../src/App';
import { TEST_PLAYERS } from '../data/testData';

const mockPlayers: Player[] = TEST_PLAYERS.slice(0, 2);

describe('Leaderboard Component', () => {
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

  it('shows players from historical win data even when not in current players array', () => {
    const emptyPlayersArray: Player[] = [];
    const winCounts = new Map<string, number>([
      ['manual_Alice', 3],
      ['extracted_Bob', 1]
    ]);

    render(<Leaderboard players={emptyPlayersArray} winCounts={winCounts} />);

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('🏆 Leaderboard')).toBeInTheDocument();
    
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
    expect(screen.getByText(/Bob/)).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    
    const allOnes = screen.getAllByText('1');
    expect(allOnes).toHaveLength(2);
    
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(3);
  });

  it('combines current players with historical players correctly', () => {
    const currentPlayers: Player[] = [
      { id: 'current_Charlie', name: 'Charlie', isPresent: true },
      { id: 'manual_Alice', name: 'Alice', isPresent: true },
    ];
    
    const winCounts = new Map<string, number>([
      ['manual_Alice', 2],
      ['extracted_Bob', 4], 
      ['current_Charlie', 1],
    ]);

    render(<Leaderboard players={currentPlayers} winCounts={winCounts} />);

    expect(screen.getByRole('table')).toBeInTheDocument();
    
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
    expect(screen.getByText(/Bob/)).toBeInTheDocument();
    expect(screen.getByText(/Charlie/)).toBeInTheDocument();
    
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(4);
    
    const cells = screen.getAllByRole('cell');
    const bobRow = cells.find(cell => cell.textContent?.includes('🥇 Bob'));
    expect(bobRow).toBeInTheDocument();
  });
});