import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import Leaderboard from '../../src/components/Leaderboard';
import type { Player } from '../../src/App';

const mockPlayers: Player[] = [
  { id: '1', name: 'Alice', isPresent: true },
  { id: '2', name: 'Bob', isPresent: true },
  { id: '3', name: 'Charlie', isPresent: true },
];

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
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });
}); 