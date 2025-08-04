import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import TeamDisplay from '../../src/components/TeamDisplay';
import { createMockPlayers, MOCK_PLAYERS } from '../data/testFactories';
import { expectPlayersInOrder, expectPlayersToBeRendered, getElementByText } from '../data/testHelpers';

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

  it('should handle large team numbers', () => {
    render(<TeamDisplay teamNumber={999} players={MOCK_PLAYERS.team} />);

    getElementByText('Team 999');
  });

  it('should preserve player order in team display', () => {
    const orderedPlayers = createMockPlayers(3, { isPresent: true });
    render(<TeamDisplay teamNumber={1} players={orderedPlayers} />);

    expectPlayersInOrder(orderedPlayers);
  });

  describe('Winner functionality', () => {
    const mockOnTeamClick = vi.fn();

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should not display crown when team is not winner', () => {
      render(
        <TeamDisplay
          teamNumber={1}
          players={MOCK_PLAYERS.team}
          isWinner={false}
        />,
      );

      expect(screen.queryByText('👑')).not.toBeInTheDocument();
    });

    it('should display crown when team is winner', () => {
      render(
        <TeamDisplay
          teamNumber={1}
          players={MOCK_PLAYERS.team}
          isWinner={true}
        />,
      );

      expect(screen.getByText('👑')).toBeInTheDocument();
    });

    it('should call onTeamClick when team is clicked and clickable', async () => {
      const user = userEvent.setup();
      render(
        <TeamDisplay
          teamNumber={2}
          players={MOCK_PLAYERS.team}
          isClickable={true}
          onTeamClick={mockOnTeamClick}
        />,
      );

      const teamElement = screen.getByText('Team 2').closest('.team');
      await user.click(teamElement!);

      expect(mockOnTeamClick).toHaveBeenCalledWith(2);
      expect(mockOnTeamClick).toHaveBeenCalledTimes(1);
    });

    it('should not call onTeamClick when team is clicked but not clickable', async () => {
      const user = userEvent.setup();
      render(
        <TeamDisplay
          teamNumber={1}
          players={MOCK_PLAYERS.team}
          isClickable={false}
          onTeamClick={mockOnTeamClick}
        />,
      );

      const teamElement = screen.getByText('Team 1').closest('.team');
      await user.click(teamElement!);

      expect(mockOnTeamClick).not.toHaveBeenCalled();
    });

    it('should not call onTeamClick when onTeamClick is not provided', async () => {
      const user = userEvent.setup();
      render(
        <TeamDisplay
          teamNumber={1}
          players={MOCK_PLAYERS.team}
          isClickable={true}
        />,
      );

      const teamElement = screen.getByText('Team 1').closest('.team');
      await user.click(teamElement!);

    });

    it('should display both crown and VS divider when winner and showVsDivider', () => {
      render(
        <TeamDisplay
          teamNumber={1}
          players={MOCK_PLAYERS.team}
          isWinner={true}
          showVsDivider={true}
        />,
      );

      expect(screen.getByText('👑')).toBeInTheDocument();
      expect(screen.getByText('VS')).toBeInTheDocument();
    });
  });
});