import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DoublesMatch } from '../../../../src/components/court/display';
import { TEST_PLAYERS } from '../../../data/testData';

describe('DoublesMatch', () => {
  const team1Players = [TEST_PLAYERS[0], TEST_PLAYERS[1]];
  const team2Players = [TEST_PLAYERS[2], TEST_PLAYERS[3]];

  it('renders both teams with all players', () => {
    render(
      <DoublesMatch
        team1Players={team1Players}
        team2Players={team2Players}
      />,
    );

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
    expect(screen.getByText('Diana')).toBeInTheDocument();
  });

  it('displays VS divider', () => {
    render(
      <DoublesMatch
        team1Players={team1Players}
        team2Players={team2Players}
      />,
    );

    expect(screen.getByText('VS')).toBeInTheDocument();
  });

  it('highlights winning team 1', () => {
    const { container } = render(
      <DoublesMatch
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
      <DoublesMatch
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
      <DoublesMatch
        team1Players={team1Players}
        team2Players={team2Players}
        isClickable={true}
        onTeamClick={mockOnTeamClick}
      />,
    );

    const team1Container = container.querySelector('[data-testid="team-1"]');
    await user.click(team1Container!);

    expect(mockOnTeamClick).toHaveBeenCalledTimes(1);
    expect(mockOnTeamClick).toHaveBeenCalledWith(1);
  });

  it('applies animating-blur class when isAnimating is true', () => {
    const { container } = render(
      <DoublesMatch
        team1Players={team1Players}
        team2Players={team2Players}
        isAnimating={true}
      />,
    );

    const teamsContainer = container.querySelector('.teams');
    expect(teamsContainer).toHaveClass('animating-blur');
  });

  it('does not apply animating-blur class when isAnimating is false', () => {
    const { container } = render(
      <DoublesMatch
        team1Players={team1Players}
        team2Players={team2Players}
        isAnimating={false}
      />,
    );

    const teamsContainer = container.querySelector('.teams');
    expect(teamsContainer).not.toHaveClass('animating-blur');
  });

  it('applies clickable class when isClickable is true', () => {
    const { container } = render(
      <DoublesMatch
        team1Players={team1Players}
        team2Players={team2Players}
        isClickable={true}
      />,
    );

    const team1Container = container.querySelector('[data-testid="team-1"]');
    expect(team1Container).toHaveClass('team-clickable');
  });

  it('does not apply clickable class when isClickable is false', () => {
    const { container } = render(
      <DoublesMatch
        team1Players={team1Players}
        team2Players={team2Players}
        isClickable={false}
      />,
    );

    const team1Container = container.querySelector('[data-testid="team-1"]');
    expect(team1Container).not.toHaveClass('team-clickable');
  });
});

