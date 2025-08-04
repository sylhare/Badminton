import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';

import CourtAssignments from '../../src/components/CourtAssignments';
import { Court, Player } from '../../src/App';
import { TEST_COURTS, TEST_PLAYERS } from '../data/testData';

describe('CourtAssignments Component', () => {
  const mockOnGenerateNewAssignments = vi.fn();

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
});

describe('Winner Selection', () => {
  const doublesAssignment: Court[] = [TEST_COURTS.doublesWithTeams()];
  const singlesAssignment: Court[] = [TEST_COURTS.singlesWithTeams()];
  const multipleCourtAssignments: Court[] = [
    TEST_COURTS.doublesWithTeams(),
    {
      courtNumber: 2,
      players: TEST_PLAYERS.slice(4, 6), // Eve and Frank
      teams: {
        team1: [TEST_PLAYERS[4]], // Eve
        team2: [TEST_PLAYERS[5]], // Frank
      },
    },
  ];

  const mockOnGenerateNewAssignments = vi.fn();
  const mockOnWinnerChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic winner selection', () => {
    it('should allow selecting winner in doubles match', async () => {
      const user = userEvent.setup();

      render(
        <CourtAssignments
          assignments={doublesAssignment}
          benchedPlayers={[]}
          onGenerateNewAssignments={mockOnGenerateNewAssignments}
          onWinnerChange={mockOnWinnerChange}
        />,
      );

      expect(screen.queryByText('👑')).not.toBeInTheDocument();

      const team1Element = screen.getByText('Team 1').closest('.team');
      await user.click(team1Element!);

      expect(mockOnWinnerChange).toHaveBeenCalledWith(1, 1);
    });

    it('should allow selecting winner in singles match', async () => {
      const user = userEvent.setup();

      render(
        <CourtAssignments
          assignments={singlesAssignment}
          benchedPlayers={[]}
          onGenerateNewAssignments={mockOnGenerateNewAssignments}
          onWinnerChange={mockOnWinnerChange}
        />,
      );

      const aliceElement = screen.getByText('Alice');
      await user.click(aliceElement);

      expect(mockOnWinnerChange).toHaveBeenCalledWith(1, 1);
    });
  });

  describe('Winner display', () => {
    it('should display winner instructions', () => {
      render(
        <CourtAssignments
          assignments={doublesAssignment}
          benchedPlayers={[]}
          onGenerateNewAssignments={mockOnGenerateNewAssignments}
          onWinnerChange={mockOnWinnerChange}
        />,
      );

      expect(screen.getByText(/Click on a team to mark them as the winner/)).toBeInTheDocument();
    });

    it('should handle winner toggle workflow', async () => {
      const user = userEvent.setup();

      const assignmentWithWinner: Court[] = [
        TEST_COURTS.withWinner(1),
      ];

      render(
        <CourtAssignments
          assignments={assignmentWithWinner}
          benchedPlayers={[]}
          onGenerateNewAssignments={mockOnGenerateNewAssignments}
          onWinnerChange={mockOnWinnerChange}
        />,
      );

      expect(screen.getByText('👑')).toBeInTheDocument();

      const team1Element = screen.getByText('Team 1').closest('.team');
      await user.click(team1Element!);

      expect(mockOnWinnerChange).toHaveBeenCalledWith(1, undefined);
    });

    it('should handle multiple courts with independent winner selection', async () => {
      const user = userEvent.setup();

      render(
        <CourtAssignments
          assignments={multipleCourtAssignments}
          benchedPlayers={[]}
          onGenerateNewAssignments={mockOnGenerateNewAssignments}
          onWinnerChange={mockOnWinnerChange}
        />,
      );

      const court1Team1 = screen.getAllByText('Team 1')[0].closest('.team');
      await user.click(court1Team1!);

      expect(mockOnWinnerChange).toHaveBeenCalledWith(1, 1);

      const eveElement = screen.getByText('Eve');
      await user.click(eveElement);

      expect(mockOnWinnerChange).toHaveBeenCalledWith(2, 1);

      expect(mockOnWinnerChange).toHaveBeenCalledTimes(2);
    });

    it('should display multiple winners correctly', () => {
      const assignmentsWithWinners: Court[] = [
        TEST_COURTS.withWinner(1),
        { ...TEST_COURTS.singlesWithTeams(TEST_PLAYERS.slice(4, 6)), courtNumber: 2, winner: 2 },
      ];

      render(
        <CourtAssignments
          assignments={assignmentsWithWinners}
          benchedPlayers={[]}
          onGenerateNewAssignments={mockOnGenerateNewAssignments}
          onWinnerChange={mockOnWinnerChange}
        />,
      );

      const crowns = screen.getAllByText('👑');
      expect(crowns).toHaveLength(2);
    });

    it('should handle switching winners within same court', async () => {
      const user = userEvent.setup();

      const assignmentWithWinner: Court[] = [TEST_COURTS.withWinner(1)];

      render(
        <CourtAssignments
          assignments={assignmentWithWinner}
          benchedPlayers={[]}
          onGenerateNewAssignments={mockOnGenerateNewAssignments}
          onWinnerChange={mockOnWinnerChange}
        />,
      );

      const team2Element = screen.getByText('Team 2').closest('.team');
      await user.click(team2Element!);

      expect(mockOnWinnerChange).toHaveBeenCalledWith(1, 2);
    });

    it('should handle click events correctly', async () => {
      const user = userEvent.setup();

      render(
        <CourtAssignments
          assignments={doublesAssignment}
          benchedPlayers={[]}
          onGenerateNewAssignments={mockOnGenerateNewAssignments}
          onWinnerChange={mockOnWinnerChange}
        />,
      );

      const team1Element = screen.getByText('Team 1').closest('.team');
      await user.click(team1Element!);

      expect(mockOnWinnerChange).toHaveBeenCalledWith(1, 1);
    });
  });

  describe('Edge cases', () => {
    it('should handle courts without teams', () => {
      const courtWithoutTeams: Court[] = [TEST_COURTS.withoutTeams()];

      render(
        <CourtAssignments
          assignments={courtWithoutTeams}
          benchedPlayers={[]}
          onGenerateNewAssignments={mockOnGenerateNewAssignments}
          onWinnerChange={mockOnWinnerChange}
        />,
      );

      expect(screen.getByText(/Court 1/)).toBeInTheDocument();
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.queryByText('👑')).not.toBeInTheDocument();
    });

    it('should work without onWinnerChange callback', () => {
      render(
        <CourtAssignments
          assignments={doublesAssignment}
          benchedPlayers={[]}
          onGenerateNewAssignments={mockOnGenerateNewAssignments}
        />,
      );

      expect(screen.queryByText(/Click on a team to mark them as the winner/)).not.toBeInTheDocument();
    });
  });

  describe('Functionality tests', () => {
    it('should display crown for winners', () => {
      const assignmentWithWinner: Court[] = [TEST_COURTS.withWinner(1)];

      render(
        <CourtAssignments
          assignments={assignmentWithWinner}
          benchedPlayers={[]}
          onGenerateNewAssignments={mockOnGenerateNewAssignments}
          onWinnerChange={mockOnWinnerChange}
        />,
      );

      expect(screen.getByText('👑')).toBeInTheDocument();
    });

    it('should handle click interactions correctly', async () => {
      const user = userEvent.setup();

      render(
        <CourtAssignments
          assignments={doublesAssignment}
          benchedPlayers={[]}
          onGenerateNewAssignments={mockOnGenerateNewAssignments}
          onWinnerChange={mockOnWinnerChange}
        />,
      );

      const team1Element = screen.getByText('Team 1').closest('.team') as HTMLElement;

      await user.click(team1Element);
      expect(mockOnWinnerChange).toHaveBeenCalledWith(1, 1);
    });
  });
});