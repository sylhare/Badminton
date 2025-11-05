import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import { CourtCard } from '../../../../src/components/court/card';
import { Court } from '../../../../src/types';
import { TEST_PLAYERS } from '../../../data/testData';

describe('CourtCard', () => {
  describe('Court without teams', () => {
    const courtWithoutTeams: Court = {
      courtNumber: 1,
      players: [TEST_PLAYERS[0], TEST_PLAYERS[1]],
    };

    it('renders court without teams', () => {
      render(<CourtCard court={courtWithoutTeams} />);

      expect(screen.getByText(/Court 1/)).toBeInTheDocument();
      expect(screen.getByText('Players on court:')).toBeInTheDocument();
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });

    it('applies animating-shake class when isAnimating is true', () => {
      const { container } = render(
        <CourtCard court={courtWithoutTeams} isAnimating={true} />,
      );

      const courtCard = container.querySelector('.court-card');
      expect(courtCard).toHaveClass('animating-shake');
    });
  });

  describe('Singles match', () => {
    const singlesCourt: Court = {
      courtNumber: 2,
      players: [TEST_PLAYERS[0], TEST_PLAYERS[1]],
      teams: {
        team1: [TEST_PLAYERS[0]],
        team2: [TEST_PLAYERS[1]],
      },
    };

    it('renders singles match correctly', () => {
      render(<CourtCard court={singlesCourt} />);

      expect(screen.getByText(/Court 2 - Singles/)).toBeInTheDocument();
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByText('VS')).toBeInTheDocument();
    });

    it('displays winner crown in singles match', () => {
      const courtWithWinner: Court = {
        ...singlesCourt,
        winner: 1,
      };

      render(<CourtCard court={courtWithWinner} />);
      expect(screen.getByText('👑')).toBeInTheDocument();
    });

    it('calls onWinnerChange when singles player is clicked', async () => {
      const user = userEvent.setup();
      const mockOnWinnerChange = vi.fn();

      render(
        <CourtCard
          court={singlesCourt}
          onWinnerChange={mockOnWinnerChange}
        />,
      );

      const aliceContainer = screen.getByText('Alice').closest('.singles-player');
      await user.click(aliceContainer!);

      expect(mockOnWinnerChange).toHaveBeenCalledWith(2, 1);
    });

    it('renders singles match with waiting player', () => {
      const courtWithWaiting: Court = {
        courtNumber: 2,
        players: [TEST_PLAYERS[0], TEST_PLAYERS[1], TEST_PLAYERS[2]],
        teams: {
          team1: [TEST_PLAYERS[0]],
          team2: [TEST_PLAYERS[1]],
        },
      };

      render(<CourtCard court={courtWithWaiting} />);
      expect(screen.getByText(/Waiting: Charlie/)).toBeInTheDocument();
    });
  });

  describe('Doubles match', () => {
    const doublesCourt: Court = {
      courtNumber: 3,
      players: [TEST_PLAYERS[0], TEST_PLAYERS[1], TEST_PLAYERS[2], TEST_PLAYERS[3]],
      teams: {
        team1: [TEST_PLAYERS[0], TEST_PLAYERS[1]],
        team2: [TEST_PLAYERS[2], TEST_PLAYERS[3]],
      },
    };

    it('renders doubles match correctly', () => {
      render(<CourtCard court={doublesCourt} />);

      expect(screen.getByText(/Court 3 - Doubles/)).toBeInTheDocument();
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByText('Charlie')).toBeInTheDocument();
      expect(screen.getByText('Diana')).toBeInTheDocument();
    });

    it('displays winner in doubles match', () => {
      const courtWithWinner: Court = {
        ...doublesCourt,
        winner: 2,
      };

      const { container } = render(<CourtCard court={courtWithWinner} />);
      const team2 = container.querySelector('[data-testid="team-2"]');
      expect(team2).toHaveClass('team-winner');
    });

    it('calls onWinnerChange when doubles team is clicked', async () => {
      const user = userEvent.setup();
      const mockOnWinnerChange = vi.fn();

      const { container } = render(
        <CourtCard
          court={doublesCourt}
          onWinnerChange={mockOnWinnerChange}
        />,
      );

      const team1 = container.querySelector('[data-testid="team-1"]');
      await user.click(team1!);

      expect(mockOnWinnerChange).toHaveBeenCalledWith(3, 1);
    });
  });

  describe('Generic court (mixed teams)', () => {
    const genericCourt: Court = {
      courtNumber: 4,
      players: [TEST_PLAYERS[0], TEST_PLAYERS[1], TEST_PLAYERS[2]],
      teams: {
        team1: [TEST_PLAYERS[0], TEST_PLAYERS[1]],
        team2: [TEST_PLAYERS[2]],
      },
    };

    it('renders generic court with mixed team sizes', () => {
      render(<CourtCard court={genericCourt} />);

      expect(screen.getByText(/Court 4/)).toBeInTheDocument();
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByText('Charlie')).toBeInTheDocument();
      expect(screen.getByText('VS')).toBeInTheDocument();
    });

    it('displays manual court icon when isManualCourt is true', () => {
      render(<CourtCard court={genericCourt} isManualCourt={true} />);

      const icon = screen.getByTitle('Manually assigned court');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('Animation states', () => {
    const testCourt: Court = {
      courtNumber: 5,
      players: [TEST_PLAYERS[0], TEST_PLAYERS[1]],
      teams: {
        team1: [TEST_PLAYERS[0]],
        team2: [TEST_PLAYERS[1]],
      },
    };

    it('applies animating-shake class to court card when isAnimating is true', () => {
      const { container } = render(
        <CourtCard court={testCourt} isAnimating={true} />,
      );

      const courtCard = container.querySelector('.court-card');
      expect(courtCard).toHaveClass('animating-shake');
    });

    it('does not apply animating-shake class when isAnimating is false', () => {
      const { container } = render(
        <CourtCard court={testCourt} isAnimating={false} />,
      );

      const courtCard = container.querySelector('.court-card');
      expect(courtCard).not.toHaveClass('animating-shake');
    });
  });

  describe('Test ID', () => {
    it('sets correct data-testid for court', () => {
      const court: Court = {
        courtNumber: 7,
        players: [TEST_PLAYERS[0]],
        teams: {
          team1: [TEST_PLAYERS[0]],
          team2: [],
        },
      };

      render(<CourtCard court={court} />);
      expect(screen.getByTestId('court-7')).toBeInTheDocument();
    });
  });
});

