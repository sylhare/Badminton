import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import TeamDisplay from '../../src/components/TeamDisplay';
import { createMockPlayers, MOCK_PLAYERS } from '../utils/testFactories';
import {
  expectParentToHaveClass,
  expectPlayersInOrder,
  expectPlayersToBeRendered,
  expectSiblingToHaveClass,
  getElementByText,
} from '../utils/testHelpers';

describe('TeamDisplay Component', () => {
  it('should render team with correct number and players', () => {
    render(<TeamDisplay teamNumber={1} players={MOCK_PLAYERS.team} />);

    getElementByText('Team 1');
    expectPlayersToBeRendered(MOCK_PLAYERS.team);
  });

  it('should render team without VS divider by default', () => {
    render(<TeamDisplay teamNumber={2} players={MOCK_PLAYERS.team} />);

    getElementByText('Team 2');
    expect(screen.queryByText('VS')).not.toBeInTheDocument();
  });

  it('should render team with VS divider when showVsDivider is true', () => {
    render(<TeamDisplay teamNumber={1} players={MOCK_PLAYERS.team} showVsDivider />);

    getElementByText('Team 1');
    getElementByText('VS');
  });

  it('should not render VS divider when showVsDivider is false', () => {
    render(<TeamDisplay teamNumber={1} players={MOCK_PLAYERS.team} showVsDivider={false} />);

    getElementByText('Team 1');
    expect(screen.queryByText('VS')).not.toBeInTheDocument();
  });

  it('should render single player team correctly', () => {
    render(<TeamDisplay teamNumber={3} players={MOCK_PLAYERS.single} />);

    getElementByText('Team 3');
    expectPlayersToBeRendered(MOCK_PLAYERS.single);
  });

  it('should render empty team correctly', () => {
    render(<TeamDisplay teamNumber={4} players={[]} />);

    const teamElement = getElementByText('Team 4');
    expect(teamElement.nextElementSibling).toBeInTheDocument();
  });

  it('should render different team numbers correctly', () => {
    const { rerender } = render(<TeamDisplay teamNumber={5} players={MOCK_PLAYERS.single} />);
    getElementByText('Team 5');

    rerender(<TeamDisplay teamNumber={10} players={MOCK_PLAYERS.single} />);
    getElementByText('Team 10');
  });

  it('should have correct CSS classes structure', () => {
    render(<TeamDisplay teamNumber={1} players={MOCK_PLAYERS.team} />);

    expectParentToHaveClass('Team 1', 'team');
    expectSiblingToHaveClass('Team 1', 'team-players');
  });

  it('should handle large team numbers', () => {
    render(<TeamDisplay teamNumber={999} players={MOCK_PLAYERS.team} />);

    getElementByText('Team 999');
  });

  it('should preserve player order in team display', () => {
    const orderedPlayers = createMockPlayers(3, { isPresent: true });
    render(<TeamDisplay teamNumber={1} players={orderedPlayers} />);

    expectPlayersInOrder(orderedPlayers);
  });
});