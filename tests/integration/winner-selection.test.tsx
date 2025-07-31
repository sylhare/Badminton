import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import CourtAssignments from '../../src/components/CourtAssignments';
import { TEST_PLAYERS, TEST_COURTS, DEFAULT_PROPS } from '../utils/testData';
import type { Court } from '../../src/App';

describe('Winner Selection Integration', () => {
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
        />
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
        />
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
        />
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
        />
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
        />
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
        />
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
        />
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
        />
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
        />
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
        />
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
        />
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
        />
      );

      const team1Element = screen.getByText('Team 1').closest('.team') as HTMLElement;
      
      await user.click(team1Element);
      expect(mockOnWinnerChange).toHaveBeenCalledWith(1, 1);
    });
  });
}); 