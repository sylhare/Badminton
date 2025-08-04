import React from 'react';
import { describe, it, expect } from 'vitest';
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
    expect(screen.getAllByText('2')).toHaveLength(2);
  });
}); 