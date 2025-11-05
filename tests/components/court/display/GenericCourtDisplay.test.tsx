import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import { GenericCourtDisplay } from '../../../../src/components/court/display';
import { TEST_PLAYERS } from '../../../data/testData';

describe('GenericCourtDisplay', () => {
  const team1Players = [TEST_PLAYERS[0], TEST_PLAYERS[1]]; // Alice, Bob
  const team2Players = [TEST_PLAYERS[2]]; // Charlie

  it('renders team 1 players', () => {
    render(
      <GenericCourtDisplay
        team1Players={team1Players}
        team2Players={[]}
      />,
    );

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('renders both teams when team 2 has players', () => {
    render(
      <GenericCourtDisplay
        team1Players={team1Players}
        team2Players={team2Players}
      />,
    );

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
    expect(screen.getByText('VS')).toBeInTheDocument();
  });

  it('does not render VS divider when team 2 is empty', () => {
    render(
      <GenericCourtDisplay
        team1Players={team1Players}
        team2Players={[]}
      />,
    );

    expect(screen.queryByText('VS')).not.toBeInTheDocument();
  });

  it('does not render team 2 when empty', () => {
    const { container } = render(
      <GenericCourtDisplay
        team1Players={team1Players}
        team2Players={[]}
      />,
    );

    expect(container.querySelector('[data-testid="team-2"]')).not.toBeInTheDocument();
  });

  it('highlights winning team 1', () => {
    const { container } = render(
      <GenericCourtDisplay
        team1Players={team1Players}
        team2Players={team2Players}
        winner={1}
      />,
    );

    const team1Container = container.querySelector('[data-testid="team-1"]');
    expect(team1Container).toHaveClass('team-winner');
  });

  it('highlights winning team 2', () => {
    const { container } = render(
      <GenericCourtDisplay
        team1Players={team1Players}
        team2Players={team2Players}
        winner={2}
      />,
    );

    const team2Container = container.querySelector('[data-testid="team-2"]');
    expect(team2Container).toHaveClass('team-winner');
  });

  it('calls onTeamClick when team is clicked', async () => {
    const user = userEvent.setup();
    const mockOnTeamClick = vi.fn();

    const { container } = render(
      <GenericCourtDisplay
        team1Players={team1Players}
        team2Players={team2Players}
        isClickable={true}
        onTeamClick={mockOnTeamClick}
      />,
    );

    const team2Container = container.querySelector('[data-testid="team-2"]');
    await user.click(team2Container!);

    expect(mockOnTeamClick).toHaveBeenCalledTimes(1);
    expect(mockOnTeamClick).toHaveBeenCalledWith(2);
  });

  it('applies animating-blur class when isAnimating is true', () => {
    const { container } = render(
      <GenericCourtDisplay
        team1Players={team1Players}
        team2Players={team2Players}
        isAnimating={true}
      />,
    );

    const teamsContainer = container.querySelector('.teams');
    expect(teamsContainer).toHaveClass('animating-blur');
  });

  it('handles mixed team sizes correctly', () => {
    const singlePlayer = [TEST_PLAYERS[0]];
    const triplePlayers = [TEST_PLAYERS[1], TEST_PLAYERS[2], TEST_PLAYERS[3]];

    render(
      <GenericCourtDisplay
        team1Players={singlePlayer}
        team2Players={triplePlayers}
      />,
    );

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
    expect(screen.getByText('Diana')).toBeInTheDocument();
  });
});

