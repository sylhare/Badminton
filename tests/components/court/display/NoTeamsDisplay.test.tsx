import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { NoTeamsDisplay } from '../../../../src/components/court/display';
import { TEST_PLAYERS } from '../../../data/testData';

describe('NoTeamsDisplay', () => {
  it('renders header text', () => {
    render(<NoTeamsDisplay players={[TEST_PLAYERS[0]]} />);
    expect(screen.getByText('Players on court:')).toBeInTheDocument();
  });

  it('renders single player', () => {
    render(<NoTeamsDisplay players={[TEST_PLAYERS[0]]} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('renders multiple players', () => {
    const players = [TEST_PLAYERS[0], TEST_PLAYERS[1], TEST_PLAYERS[2]];
    render(<NoTeamsDisplay players={players} />);

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
  });

  it('renders empty list when no players', () => {
    const { container } = render(<NoTeamsDisplay players={[]} />);
    expect(screen.getByText('Players on court:')).toBeInTheDocument();

    // TeamPlayerList should still render but be empty
    const playerList = container.querySelector('.team-player-list');
    expect(playerList?.children.length || 0).toBe(0);
  });

  it('applies animating-blur class when isAnimating is true', () => {
    const { container } = render(
      <NoTeamsDisplay players={[TEST_PLAYERS[0]]} isAnimating={true} />,
    );

    const blurredElements = container.querySelectorAll('.animating-blur');
    expect(blurredElements.length).toBeGreaterThan(0);
  });

  it('does not apply animating-blur class when isAnimating is false', () => {
    const { container } = render(
      <NoTeamsDisplay players={[TEST_PLAYERS[0]]} isAnimating={false} />,
    );

    const blurredElements = container.querySelectorAll('.animating-blur');
    expect(blurredElements.length).toBe(0);
  });

  it('applies animating-blur to both text containers when animating', () => {
    const { container } = render(
      <NoTeamsDisplay players={[TEST_PLAYERS[0]]} isAnimating={true} />,
    );

    const blurredElements = container.querySelectorAll('.animating-blur');
    // Should have 2 elements with animating-blur class
    expect(blurredElements.length).toBe(2);
  });
});

