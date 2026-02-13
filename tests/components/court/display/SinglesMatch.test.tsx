import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SinglesMatch } from '../../../../src/components/court/display';
import { TEST_PLAYERS } from '../../../data/testData';

describe('SinglesMatch', () => {
  const team1Player = TEST_PLAYERS[0]; 
  const team2Player = TEST_PLAYERS[1]; 

  it('renders both players correctly', () => {
    render(
      <SinglesMatch
        team1Player={team1Player}
        team2Player={team2Player}
      />,
    );

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('VS')).toBeInTheDocument();
  });

  it('displays winner crown for team 1', () => {
    render(
      <SinglesMatch
        team1Player={team1Player}
        team2Player={team2Player}
        winner={1}
      />,
    );

    const aliceContainer = screen.getByText('Alice').closest('.singles-player');
    expect(aliceContainer).toHaveClass('singles-player-winner');
    expect(screen.getByText('👑')).toBeInTheDocument();
  });

  it('displays winner crown for team 2', () => {
    render(
      <SinglesMatch
        team1Player={team1Player}
        team2Player={team2Player}
        winner={2}
      />,
    );

    const bobContainer = screen.getByText('Bob').closest('.singles-player');
    expect(bobContainer).toHaveClass('singles-player-winner');
    expect(screen.getByText('👑')).toBeInTheDocument();
  });

  it('displays waiting player when provided', () => {
    const waitingPlayer = TEST_PLAYERS[2]; 
    render(
      <SinglesMatch
        team1Player={team1Player}
        team2Player={team2Player}
        waitingPlayer={waitingPlayer}
      />,
    );

    expect(screen.getByText(/Waiting: Charlie/)).toBeInTheDocument();
  });

  it('does not display waiting section when no waiting player', () => {
    render(
      <SinglesMatch
        team1Player={team1Player}
        team2Player={team2Player}
      />,
    );

    expect(screen.queryByText(/Waiting:/)).not.toBeInTheDocument();
  });

  it('adds clickable class when isClickable is true', () => {
    render(
      <SinglesMatch
        team1Player={team1Player}
        team2Player={team2Player}
        isClickable={true}
      />,
    );

    const aliceContainer = screen.getByText('Alice').closest('.singles-player');
    expect(aliceContainer).toHaveClass('singles-player-clickable');
  });

  it('calls onPlayerClick when player is clicked', async () => {
    const user = userEvent.setup();
    const mockOnPlayerClick = vi.fn();

    render(
      <SinglesMatch
        team1Player={team1Player}
        team2Player={team2Player}
        isClickable={true}
        onPlayerClick={mockOnPlayerClick}
      />,
    );

    const aliceContainer = screen.getByText('Alice').closest('.singles-player');
    await user.click(aliceContainer!);

    expect(mockOnPlayerClick).toHaveBeenCalledTimes(1);
    expect(mockOnPlayerClick).toHaveBeenCalledWith(expect.any(Object), 1);
  });

  it('applies animating-blur class when isAnimating is true', () => {
    render(
      <SinglesMatch
        team1Player={team1Player}
        team2Player={team2Player}
        isAnimating={true}
      />,
    );

    const singlesPlayers = document.querySelector('.singles-players');
    expect(singlesPlayers).toHaveClass('animating-blur');
  });

  it('does not apply animating-blur class when isAnimating is false', () => {
    render(
      <SinglesMatch
        team1Player={team1Player}
        team2Player={team2Player}
        isAnimating={false}
      />,
    );

    const singlesPlayers = document.querySelector('.singles-players');
    expect(singlesPlayers).not.toHaveClass('animating-blur');
  });
});

