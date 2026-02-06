import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';

import ManualCourtModal from '../../src/components/ManualCourtModal';
import { createMockPlayers } from '../data/testFactories';

describe('ManualCourtModal Component', () => {
  const mockOnClose = vi.fn();
  const mockOnSelectionChange = vi.fn();
  const mockPlayers = createMockPlayers(8, { isPresent: true });

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('does not render when isOpen is false', () => {
      render(
        <ManualCourtModal
          isOpen={false}
          onClose={mockOnClose}
          players={mockPlayers}
          onSelectionChange={mockOnSelectionChange}
          currentSelection={null}
        />,
      );

      expect(screen.queryByTestId('manual-court-modal')).not.toBeInTheDocument();
    });

    it('renders when isOpen is true', () => {
      render(
        <ManualCourtModal
          isOpen={true}
          onClose={mockOnClose}
          players={mockPlayers}
          onSelectionChange={mockOnSelectionChange}
          currentSelection={null}
        />,
      );

      expect(screen.getByTestId('manual-court-modal')).toBeInTheDocument();
      expect(screen.getByText('Manual Court 1 Assignment')).toBeInTheDocument();
    });

    it('shows description text', () => {
      render(
        <ManualCourtModal
          isOpen={true}
          onClose={mockOnClose}
          players={mockPlayers}
          onSelectionChange={mockOnSelectionChange}
          currentSelection={null}
        />,
      );

      expect(screen.getByText('Select 2-4 players to play together on Court 1. The rest will be assigned automatically.')).toBeInTheDocument();
    });
  });

  describe('Close functionality', () => {
    it('calls onClose when overlay is clicked', async () => {
      const user = userEvent.setup();
      render(
        <ManualCourtModal
          isOpen={true}
          onClose={mockOnClose}
          players={mockPlayers}
          onSelectionChange={mockOnSelectionChange}
          currentSelection={null}
        />,
      );

      const overlay = screen.getByTestId('manual-court-modal');
      await act(async () => {
        await user.click(overlay);
      });

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('calls onClose when close button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <ManualCourtModal
          isOpen={true}
          onClose={mockOnClose}
          players={mockPlayers}
          onSelectionChange={mockOnSelectionChange}
          currentSelection={null}
        />,
      );

      const closeButton = screen.getByRole('button', { name: '×' });
      await act(async () => {
        await user.click(closeButton);
      });

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('calls onClose when Done button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <ManualCourtModal
          isOpen={true}
          onClose={mockOnClose}
          players={mockPlayers}
          onSelectionChange={mockOnSelectionChange}
          currentSelection={null}
        />,
      );

      const doneButton = screen.getByText('Done');
      await act(async () => {
        await user.click(doneButton);
      });

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('does not close when clicking inside modal content', async () => {
      const user = userEvent.setup();
      render(
        <ManualCourtModal
          isOpen={true}
          onClose={mockOnClose}
          players={mockPlayers}
          onSelectionChange={mockOnSelectionChange}
          currentSelection={null}
        />,
      );

      const modalContent = screen.getByText('Manual Court 1 Assignment');
      await act(async () => {
        await user.click(modalContent);
      });

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('Player Selection', () => {
    it('shows all present players as selectable buttons', () => {
      render(
        <ManualCourtModal
          isOpen={true}
          onClose={mockOnClose}
          players={mockPlayers}
          onSelectionChange={mockOnSelectionChange}
          currentSelection={null}
        />,
      );

      mockPlayers.forEach(player => {
        expect(screen.getByTestId(`manual-court-player-${player.id}`)).toBeInTheDocument();
        expect(screen.getByText(player.name)).toBeInTheDocument();
      });
    });

    it('shows selection count initially as 0/4', () => {
      render(
        <ManualCourtModal
          isOpen={true}
          onClose={mockOnClose}
          players={mockPlayers}
          onSelectionChange={mockOnSelectionChange}
          currentSelection={null}
        />,
      );

      expect(screen.getByText('0/4 players selected')).toBeInTheDocument();
    });

    it('selects a player when clicked', async () => {
      const user = userEvent.setup();
      render(
        <ManualCourtModal
          isOpen={true}
          onClose={mockOnClose}
          players={mockPlayers}
          onSelectionChange={mockOnSelectionChange}
          currentSelection={null}
        />,
      );

      const firstPlayerButton = screen.getByTestId(`manual-court-player-${mockPlayers[0].id}`);
      await act(async () => {
        await user.click(firstPlayerButton);
      });

      expect(mockOnSelectionChange).toHaveBeenCalledWith({
        players: [mockPlayers[0]],
      });
    });

    it('shows correct selection count with selected players', () => {
      render(
        <ManualCourtModal
          isOpen={true}
          onClose={mockOnClose}
          players={mockPlayers}
          onSelectionChange={mockOnSelectionChange}
          currentSelection={{ players: [mockPlayers[0]] }}
        />,
      );

      expect(screen.getByText('1/4 players selected')).toBeInTheDocument();
    });

    it('prevents selection of more than 4 players', () => {
      const selection = { players: mockPlayers.slice(0, 4) };

      render(
        <ManualCourtModal
          isOpen={true}
          onClose={mockOnClose}
          players={mockPlayers}
          onSelectionChange={mockOnSelectionChange}
          currentSelection={selection}
        />,
      );

      const fifthPlayerButton = screen.getByTestId(`manual-court-player-${mockPlayers[4].id}`);
      expect(fifthPlayerButton).toBeDisabled();
    });

    it('deselects a player when clicked again', async () => {
      const user = userEvent.setup();
      const selection = { players: [mockPlayers[0], mockPlayers[1]] };

      render(
        <ManualCourtModal
          isOpen={true}
          onClose={mockOnClose}
          players={mockPlayers}
          onSelectionChange={mockOnSelectionChange}
          currentSelection={selection}
        />,
      );

      await act(async () => {
        await user.click(screen.getByTestId(`manual-court-player-${mockPlayers[0].id}`));
      });

      expect(mockOnSelectionChange).toHaveBeenCalledWith({
        players: [mockPlayers[1]],
      });
    });
  });

  describe('Match Type Preview', () => {
    it('shows singles match preview for 2 players', () => {
      render(
        <ManualCourtModal
          isOpen={true}
          onClose={mockOnClose}
          players={mockPlayers}
          onSelectionChange={mockOnSelectionChange}
          currentSelection={{ players: mockPlayers.slice(0, 2) }}
        />,
      );

      expect(screen.getByText('Will create: Singles match')).toBeInTheDocument();
    });

    it('shows singles match with waiting preview for 3 players', () => {
      render(
        <ManualCourtModal
          isOpen={true}
          onClose={mockOnClose}
          players={mockPlayers}
          onSelectionChange={mockOnSelectionChange}
          currentSelection={{ players: mockPlayers.slice(0, 3) }}
        />,
      );

      expect(screen.getByText('Will create: Singles match (1 waiting)')).toBeInTheDocument();
    });

    it('shows doubles match preview for 4 players', () => {
      render(
        <ManualCourtModal
          isOpen={true}
          onClose={mockOnClose}
          players={mockPlayers}
          onSelectionChange={mockOnSelectionChange}
          currentSelection={{ players: mockPlayers.slice(0, 4) }}
        />,
      );

      expect(screen.getByText('Will create: Doubles match')).toBeInTheDocument();
    });

    it('does not show preview for 1 player', () => {
      render(
        <ManualCourtModal
          isOpen={true}
          onClose={mockOnClose}
          players={mockPlayers}
          onSelectionChange={mockOnSelectionChange}
          currentSelection={{ players: [mockPlayers[0]] }}
        />,
      );

      expect(screen.queryByText(/Will create:/)).not.toBeInTheDocument();
    });
  });

  describe('Selected Players Display', () => {
    it('shows selected players with tags', () => {
      const selection = { players: [mockPlayers[0], mockPlayers[1]] };

      render(
        <ManualCourtModal
          isOpen={true}
          onClose={mockOnClose}
          players={mockPlayers}
          onSelectionChange={mockOnSelectionChange}
          currentSelection={selection}
        />,
      );

      expect(screen.getByText('Selected for Court 1:')).toBeInTheDocument();

      const selectedPlayerTags = screen.getAllByText(mockPlayers[0].name);
      expect(selectedPlayerTags.length).toBeGreaterThan(0);

      const selectedPlayerTags2 = screen.getAllByText(mockPlayers[1].name);
      expect(selectedPlayerTags2.length).toBeGreaterThan(0);
    });

    it('allows removing players from selected tags', async () => {
      const user = userEvent.setup();
      const selection = { players: [mockPlayers[0], mockPlayers[1]] };

      render(
        <ManualCourtModal
          isOpen={true}
          onClose={mockOnClose}
          players={mockPlayers}
          onSelectionChange={mockOnSelectionChange}
          currentSelection={selection}
        />,
      );

      const removeButtons = screen.getAllByText('×');
      await act(async () => {
        await user.click(removeButtons[1]);
      });

      expect(mockOnSelectionChange).toHaveBeenCalledWith({
        players: [mockPlayers[1]],
      });
    });

    it('shows clear selection button and clears all when clicked', async () => {
      const user = userEvent.setup();
      const selection = { players: [mockPlayers[0], mockPlayers[1]] };

      render(
        <ManualCourtModal
          isOpen={true}
          onClose={mockOnClose}
          players={mockPlayers}
          onSelectionChange={mockOnSelectionChange}
          currentSelection={selection}
        />,
      );

      const clearButton = screen.getByTestId('clear-manual-selection');
      expect(clearButton).toBeInTheDocument();

      await act(async () => {
        await user.click(clearButton);
      });

      expect(mockOnSelectionChange).toHaveBeenCalledWith(null);
    });
  });

  describe('Player Filtering', () => {
    it('only shows present players', () => {
      const presentPlayers = createMockPlayers(3, { isPresent: true });
      const absentPlayers = createMockPlayers(2, { isPresent: false }).map((p, i) => ({
        ...p,
        id: `absent-${i}`,
        name: `Absent Player ${i + 1}`,
      }));
      const mixedPlayers = [...presentPlayers, ...absentPlayers];

      render(
        <ManualCourtModal
          isOpen={true}
          onClose={mockOnClose}
          players={mixedPlayers}
          onSelectionChange={mockOnSelectionChange}
          currentSelection={null}
        />,
      );

      presentPlayers.forEach(player => {
        expect(screen.getByTestId(`manual-court-player-${player.id}`)).toBeInTheDocument();
      });

      absentPlayers.forEach(player => {
        expect(screen.queryByTestId(`manual-court-player-${player.id}`)).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels for player buttons', () => {
      render(
        <ManualCourtModal
          isOpen={true}
          onClose={mockOnClose}
          players={mockPlayers}
          onSelectionChange={mockOnSelectionChange}
          currentSelection={null}
        />,
      );

      const firstPlayerButton = screen.getByTestId(`manual-court-player-${mockPlayers[0].id}`);
      expect(firstPlayerButton).toHaveAttribute('aria-label',
        `Add ${mockPlayers[0].name} to manual court`);
    });

    it('has proper ARIA labels for remove buttons', () => {
      const selection = { players: [mockPlayers[0]] };

      render(
        <ManualCourtModal
          isOpen={true}
          onClose={mockOnClose}
          players={mockPlayers}
          onSelectionChange={mockOnSelectionChange}
          currentSelection={selection}
        />,
      );

      const removeButton = screen.getByTitle('Remove from manual court');
      expect(removeButton).toHaveAttribute('aria-label',
        `Remove ${mockPlayers[0].name} from manual court`);
    });
  });
});
