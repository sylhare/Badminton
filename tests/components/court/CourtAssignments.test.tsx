import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CourtAssignments } from '../../../src/components/court';
import { Court, Player } from '../../../src/types';
import { TEST_COURTS, TEST_PLAYERS } from '../../data/testData';

vi.mock('../../../src/components/ManualCourtModal', () => ({
  default: () => null,
}));

describe('CourtAssignments Component', () => {
  const mockOnGenerateAssignments = vi.fn();
  const mockOnNumberOfCourtsChange = vi.fn();
  const mockOnManualCourtSelectionChange = vi.fn();

  const mockAssignments: Court[] = [
    {
      courtNumber: 1,
      players: [TEST_PLAYERS[0], TEST_PLAYERS[1], TEST_PLAYERS[2], TEST_PLAYERS[3]],
      teams: {
        team1: [TEST_PLAYERS[0], TEST_PLAYERS[1]],
        team2: [TEST_PLAYERS[2], TEST_PLAYERS[3]],
      },
    },
  ];

  const mockBenchedPlayers: Player[] = [TEST_PLAYERS[4], TEST_PLAYERS[5]];

  const defaultProps = {
    players: TEST_PLAYERS,
    assignments: mockAssignments,
    benchedPlayers: mockBenchedPlayers,
    numberOfCourts: 4,
    onNumberOfCourtsChange: mockOnNumberOfCourtsChange,
    onGenerateAssignments: mockOnGenerateAssignments,
    manualCourtSelection: null,
    onManualCourtSelectionChange: mockOnManualCourtSelectionChange,
  };

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders court settings inline', () => {
    render(<CourtAssignments {...defaultProps} />);

    expect(screen.getByText('Courts:')).toBeInTheDocument();
    expect(screen.getByTestId('court-count-input')).toHaveValue(4);
    expect(screen.getByTestId('generate-assignments-button')).toBeInTheDocument();
  });

  it('renders court assignments correctly', () => {
    render(<CourtAssignments {...defaultProps} />);

    expect(screen.getByTestId('court-1')).toBeInTheDocument();
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

  it('calls onGenerateAssignments when generate button is clicked', async () => {
    const user = userEvent.setup();
    render(<CourtAssignments {...defaultProps} />);

    const button = screen.getByTestId('generate-assignments-button');
    await user.click(button);

    await waitFor(() => {
      expect(mockOnGenerateAssignments).toHaveBeenCalledTimes(1);
    }, { timeout: 500 });
  });

  it('does not render bench section when no benched players', () => {
    const propsWithoutBench = {
      ...defaultProps,
      benchedPlayers: [],
    };

    render(<CourtAssignments {...propsWithoutBench} />);

    expect(screen.queryByText(/🪑 Bench/)).not.toBeInTheDocument();
  });

  it('handles singular bench player count correctly', () => {
    const propsWithOneBench = {
      ...defaultProps,
      benchedPlayers: [TEST_PLAYERS[4]],
    };

    render(<CourtAssignments {...propsWithOneBench} />);

    expect(screen.getByText('🪑 Bench (1 player)')).toBeInTheDocument();
  });

  it('calls onNumberOfCourtsChange when court input changes', async () => {
    const user = userEvent.setup();
    render(<CourtAssignments {...defaultProps} />);

    const input = screen.getByTestId('court-count-input');
    await user.tripleClick(input);
    await user.keyboard('6');

    expect(mockOnNumberOfCourtsChange).toHaveBeenCalledWith(6);
  });

  it('shows "Regenerate" text when assignments exist', () => {
    render(<CourtAssignments {...defaultProps} />);

    expect(screen.getByTestId('generate-assignments-button')).toHaveTextContent('Regenerate Assignments');
  });

  it('shows "Generate" text when no assignments', () => {
    render(<CourtAssignments {...defaultProps} assignments={[]} benchedPlayers={[]} />);

    expect(screen.getByTestId('generate-assignments-button')).toHaveTextContent('Generate Assignments');
  });

  it('disables generate button when no players present', () => {
    const noPlayersProps = {
      ...defaultProps,
      players: TEST_PLAYERS.map(p => ({ ...p, isPresent: false })),
      assignments: [],
      benchedPlayers: [],
    };

    render(<CourtAssignments {...noPlayersProps} />);

    expect(screen.getByTestId('generate-assignments-button')).toBeDisabled();
  });

  it('shows no-players hint when no players present', () => {
    const noPlayersProps = {
      ...defaultProps,
      players: [],
      assignments: [],
      benchedPlayers: [],
    };

    render(<CourtAssignments {...noPlayersProps} />);

    expect(screen.getByText(/Add some players above/)).toBeInTheDocument();
  });

  it('shows hint when players present but no assignments', () => {
    render(<CourtAssignments {...defaultProps} assignments={[]} benchedPlayers={[]} />);

    expect(screen.getByText(/How it works/)).toBeInTheDocument();
  });

  describe('View bench counts button', () => {
    it('shows view bench counts button when players are benched and onViewBenchCounts is provided', () => {
      const mockOnViewBenchCounts = vi.fn();

      render(
        <CourtAssignments
          {...defaultProps}
          onViewBenchCounts={mockOnViewBenchCounts}
        />,
      );

      expect(screen.getByRole('button', { name: /view bench counts/i })).toBeInTheDocument();
    });

    it('does not show view bench counts button when onViewBenchCounts is not provided', () => {
      render(<CourtAssignments {...defaultProps} />);

      expect(screen.queryByRole('button', { name: /view bench counts/i })).not.toBeInTheDocument();
    });

    it('does not show view bench counts button when no players are benched', () => {
      const mockOnViewBenchCounts = vi.fn();
      const propsWithoutBench = {
        ...defaultProps,
        benchedPlayers: [],
        onViewBenchCounts: mockOnViewBenchCounts,
      };

      render(<CourtAssignments {...propsWithoutBench} />);

      expect(screen.queryByRole('button', { name: /view bench counts/i })).not.toBeInTheDocument();
    });

    it('calls onViewBenchCounts when button is clicked', async () => {
      const user = userEvent.setup();
      const mockOnViewBenchCounts = vi.fn();

      render(
        <CourtAssignments
          {...defaultProps}
          onViewBenchCounts={mockOnViewBenchCounts}
        />,
      );

      const button = screen.getByRole('button', { name: /view bench counts/i });
      await user.click(button);

      expect(mockOnViewBenchCounts).toHaveBeenCalledTimes(1);
    });
  });

  it('renders multiple courts correctly', () => {
    const multipleCourtAssignments: Court[] = [
      {
        courtNumber: 1,
        players: [TEST_PLAYERS[0], TEST_PLAYERS[1]],
        teams: {
          team1: [TEST_PLAYERS[0]],
          team2: [TEST_PLAYERS[1]],
        },
      },
      {
        courtNumber: 2,
        players: [TEST_PLAYERS[2], TEST_PLAYERS[3]],
        teams: {
          team1: [TEST_PLAYERS[2]],
          team2: [TEST_PLAYERS[3]],
        },
      },
    ];

    const propsWithMultipleCourts = {
      ...defaultProps,
      assignments: multipleCourtAssignments,
    };

    render(<CourtAssignments {...propsWithMultipleCourts} />);

    expect(screen.getByTestId('court-1')).toBeInTheDocument();
    expect(screen.getByTestId('court-2')).toBeInTheDocument();
  });
});

describe('Winner Selection', () => {
  const mockOnGenerateAssignments = vi.fn();
  const mockOnNumberOfCourtsChange = vi.fn();
  const mockOnManualCourtSelectionChange = vi.fn();
  const mockOnWinnerChange = vi.fn();

  const doublesAssignment: Court[] = [TEST_COURTS.doublesWithTeams()];
  const singlesAssignment: Court[] = [TEST_COURTS.singlesWithTeams()];
  const multipleCourtAssignments: Court[] = [
    TEST_COURTS.doublesWithTeams(),
    {
      courtNumber: 2,
      players: TEST_PLAYERS.slice(4, 6),
      teams: {
        team1: [TEST_PLAYERS[4]],
        team2: [TEST_PLAYERS[5]],
      },
    },
  ];

  const baseProps = {
    players: TEST_PLAYERS,
    numberOfCourts: 4,
    onNumberOfCourtsChange: mockOnNumberOfCourtsChange,
    onGenerateAssignments: mockOnGenerateAssignments,
    benchedPlayers: [],
    manualCourtSelection: null,
    onManualCourtSelectionChange: mockOnManualCourtSelectionChange,
  };

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('Basic winner selection', () => {
    it('should allow selecting winner in doubles match', async () => {
      const user = userEvent.setup();

      render(
        <CourtAssignments
          {...baseProps}
          assignments={doublesAssignment}
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
          {...baseProps}
          assignments={singlesAssignment}
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
          {...baseProps}
          assignments={doublesAssignment}
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
          {...baseProps}
          assignments={assignmentWithWinner}
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
          {...baseProps}
          assignments={multipleCourtAssignments}
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
          {...baseProps}
          assignments={assignmentsWithWinners}
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
          {...baseProps}
          assignments={assignmentWithWinner}
          onWinnerChange={mockOnWinnerChange}
        />,
      );

      const team2Element = screen.getByText('Team 2').closest('.team');
      await user.click(team2Element!);

      expect(mockOnWinnerChange).toHaveBeenCalledWith(1, 2);
    });

    it('should display crown for winners', () => {
      const assignmentWithWinner: Court[] = [TEST_COURTS.withWinner(1)];

      render(
        <CourtAssignments
          {...baseProps}
          assignments={assignmentWithWinner}
          onWinnerChange={mockOnWinnerChange}
        />,
      );

      expect(screen.getByText('👑')).toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('should handle courts without teams', () => {
      const courtWithoutTeams: Court[] = [TEST_COURTS.withoutTeams()];

      render(
        <CourtAssignments
          {...baseProps}
          assignments={courtWithoutTeams}
          onWinnerChange={mockOnWinnerChange}
        />,
      );

      expect(screen.getByTestId('court-1')).toBeInTheDocument();
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.queryByText('👑')).not.toBeInTheDocument();
    });

    it('should work without onWinnerChange callback', () => {
      render(
        <CourtAssignments
          {...baseProps}
          assignments={doublesAssignment}
        />,
      );

      expect(screen.queryByText(/Click on a team to mark them as the winner/)).not.toBeInTheDocument();
    });
  });
});
