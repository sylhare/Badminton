import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';

import CourtAssignments from '../../src/components/CourtAssignments';
import { Court, Player } from '../../src/App';

describe('CourtAssignments Component', () => {
  const mockOnGenerateNewAssignments = vi.fn();
  const mockOnWinnerChange = vi.fn();

  const mockPlayers: Player[] = [
    { id: '1', name: 'Alice', isPresent: true },
    { id: '2', name: 'Bob', isPresent: true },
    { id: '3', name: 'Charlie', isPresent: true },
    { id: '4', name: 'Diana', isPresent: true },
    { id: '5', name: 'Eve', isPresent: true },
    { id: '6', name: 'Frank', isPresent: true },
  ];

  const mockAssignments: Court[] = [
    {
      courtNumber: 1,
      players: [mockPlayers[0], mockPlayers[1], mockPlayers[2], mockPlayers[3]],
      teams: {
        team1: [mockPlayers[0], mockPlayers[1]],
        team2: [mockPlayers[2], mockPlayers[3]],
      },
    },
  ];

  const mockBenchedPlayers: Player[] = [mockPlayers[4], mockPlayers[5]];

  const defaultProps = {
    assignments: mockAssignments,
    benchedPlayers: mockBenchedPlayers,
    onGenerateNewAssignments: mockOnGenerateNewAssignments,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders court assignments correctly', () => {
    render(<CourtAssignments {...defaultProps} />);

    expect(screen.getByText(/Court 1/)).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
    expect(screen.getByText('Diana')).toBeInTheDocument();
  });

  it('renders benched players correctly', () => {
    render(<CourtAssignments {...defaultProps} />);

    expect(screen.getByText('🪑 Bench (2 players)')).toBeInTheDocument();
    expect(screen.getByText('Eve')).toBeInTheDocument();
    expect(screen.getByText('Frank')).toBeInTheDocument();
  });

  it('renders generate new assignments button', () => {
    render(<CourtAssignments {...defaultProps} />);

    const button = screen.getByRole('button', { name: /generate new assignments/i });
    expect(button).toBeInTheDocument();
  });

  it('calls onGenerateNewAssignments when generate button is clicked', async () => {
    const user = userEvent.setup();
    render(<CourtAssignments {...defaultProps} />);

    const button = screen.getByRole('button', { name: /generate new assignments/i });
    await user.click(button);

    expect(mockOnGenerateNewAssignments).toHaveBeenCalledTimes(1);
  });

  it('does not render bench section when no benched players', () => {
    const propsWithoutBench = {
      ...defaultProps,
      benchedPlayers: [],
    };

    render(<CourtAssignments {...propsWithoutBench} />);

    expect(screen.queryByText(/bench/i)).not.toBeInTheDocument();
  });

  it('handles singular bench player count correctly', () => {
    const propsWithOneBench = {
      ...defaultProps,
      benchedPlayers: [mockPlayers[4]],
    };

    render(<CourtAssignments {...propsWithOneBench} />);

    expect(screen.getByText('🪑 Bench (1 player)')).toBeInTheDocument();
  });

  it('renders multiple courts correctly', () => {
    const multipleCourtAssignments: Court[] = [
      {
        courtNumber: 1,
        players: [mockPlayers[0], mockPlayers[1]],
        teams: {
          team1: [mockPlayers[0]],
          team2: [mockPlayers[1]],
        },
      },
      {
        courtNumber: 2,
        players: [mockPlayers[2], mockPlayers[3]],
        teams: {
          team1: [mockPlayers[2]],
          team2: [mockPlayers[3]],
        },
      },
    ];

    const propsWithMultipleCourts = {
      ...defaultProps,
      assignments: multipleCourtAssignments,
    };

    render(<CourtAssignments {...propsWithMultipleCourts} />);

    expect(screen.getByText(/Court 1/)).toBeInTheDocument();
    expect(screen.getByText(/Court 2/)).toBeInTheDocument();
  });

  it('preserves player data when generating new assignments', async () => {
    const user = userEvent.setup();
    render(<CourtAssignments {...defaultProps} />);

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Eve')).toBeInTheDocument();

    const button = screen.getByRole('button', { name: /generate new assignments/i });
    await user.click(button);

    expect(mockOnGenerateNewAssignments).toHaveBeenCalledTimes(1);

  });

  describe('Winner functionality', () => {
    const assignmentsWithWinner: Court[] = [
      {
        courtNumber: 1,
        players: [mockPlayers[0], mockPlayers[1], mockPlayers[2], mockPlayers[3]],
        teams: {
          team1: [mockPlayers[0], mockPlayers[1]],
          team2: [mockPlayers[2], mockPlayers[3]],
        },
        winner: 1,
      },
    ];

    const singlesAssignment: Court[] = [
      {
        courtNumber: 1,
        players: [mockPlayers[0], mockPlayers[1]],
        teams: {
          team1: [mockPlayers[0]],
          team2: [mockPlayers[1]],
        },
        winner: 2,
      },
    ];

    it('shows winner instructions when onWinnerChange is provided', () => {
      render(
        <CourtAssignments 
          {...defaultProps} 
          onWinnerChange={mockOnWinnerChange}
        />
      );

      expect(screen.getByText(/Click on a team to mark them as the winner/)).toBeInTheDocument();
    });

    it('does not show winner instructions when onWinnerChange is not provided', () => {
      render(<CourtAssignments {...defaultProps} />);

      expect(screen.queryByText(/Click on a team to mark them as the winner/)).not.toBeInTheDocument();
    });

    it('displays crown for winning team in doubles match', () => {
      render(
        <CourtAssignments 
          {...defaultProps} 
          assignments={assignmentsWithWinner}
          onWinnerChange={mockOnWinnerChange}
        />
      );

      expect(screen.getByText('👑')).toBeInTheDocument();
    });

    it('displays crown for winning player in singles match', () => {
      render(
        <CourtAssignments 
          {...defaultProps} 
          assignments={singlesAssignment}
          onWinnerChange={mockOnWinnerChange}
        />
      );

      expect(screen.getByText('👑')).toBeInTheDocument();
    });

    it('calls onWinnerChange when team is clicked in doubles match', async () => {
      const user = userEvent.setup();
      render(
        <CourtAssignments 
          {...defaultProps} 
          onWinnerChange={mockOnWinnerChange}
        />
      );

      const team1Element = screen.getByText('Team 1').closest('.team');
      await user.click(team1Element!);

      expect(mockOnWinnerChange).toHaveBeenCalledWith(1, 1);
    });

    it('calls onWinnerChange when player is clicked in singles match', async () => {
      const user = userEvent.setup();
      render(
        <CourtAssignments 
          {...defaultProps} 
          assignments={singlesAssignment}
          onWinnerChange={mockOnWinnerChange}
        />
      );

      const aliceElement = screen.getByText('Alice');
      await user.click(aliceElement);

      expect(mockOnWinnerChange).toHaveBeenCalledWith(1, 1);
    });

    it('toggles winner when clicking the same team twice', async () => {
      const user = userEvent.setup();
      render(
        <CourtAssignments 
          {...defaultProps} 
          assignments={assignmentsWithWinner}
          onWinnerChange={mockOnWinnerChange}
        />
      );

      const team1Element = screen.getByText('Team 1').closest('.team');
      await user.click(team1Element!);

      expect(mockOnWinnerChange).toHaveBeenCalledWith(1, undefined);
    });

    it('switches winner when clicking different team', async () => {
      const user = userEvent.setup();
      render(
        <CourtAssignments 
          {...defaultProps} 
          assignments={assignmentsWithWinner}
          onWinnerChange={mockOnWinnerChange}
        />
      );

      const team2Element = screen.getByText('Team 2').closest('.team');
      await user.click(team2Element!);

      expect(mockOnWinnerChange).toHaveBeenCalledWith(1, 2);
    });

    it('handles court without teams gracefully', () => {
      const courtWithoutTeams: Court[] = [
        {
          courtNumber: 1,
          players: [mockPlayers[0], mockPlayers[1]],
        },
      ];

      render(
        <CourtAssignments 
          {...defaultProps} 
          assignments={courtWithoutTeams}
          onWinnerChange={mockOnWinnerChange}
        />
      );

      expect(screen.getByText(/Court 1/)).toBeInTheDocument();
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.queryByText('👑')).not.toBeInTheDocument();
    });

    it('handles multiple courts with different winners', () => {
      const multipleCourtsWithWinners: Court[] = [
        {
          courtNumber: 1,
          players: [mockPlayers[0], mockPlayers[1]],
          teams: {
            team1: [mockPlayers[0]],
            team2: [mockPlayers[1]],
          },
          winner: 1,
        },
        {
          courtNumber: 2,
          players: [mockPlayers[2], mockPlayers[3]],
          teams: {
            team1: [mockPlayers[2]],
            team2: [mockPlayers[3]],
          },
          winner: 2,
        },
      ];

      render(
        <CourtAssignments 
          {...defaultProps} 
          assignments={multipleCourtsWithWinners}
          onWinnerChange={mockOnWinnerChange}
        />
      );

      const crowns = screen.getAllByText('👑');
      expect(crowns).toHaveLength(2);
    });
  });
});