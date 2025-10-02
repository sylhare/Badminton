import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';

import ManualCourtSelection from '../../src/components/ManualCourtSelection';
import { createMockPlayers } from '../data/testFactories';

describe('ManualCourtSelection Component', () => {
  const mockOnSelectionChange = vi.fn();
  const mockPlayers = createMockPlayers(8, { isPresent: true });

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the manual court selection header', () => {
      render(
        <ManualCourtSelection
          players={mockPlayers}
          onSelectionChange={mockOnSelectionChange}
          currentSelection={null}
        />,
      );

      expect(screen.getByTestId('manual-court-header')).toBeInTheDocument();
      expect(screen.getByText('⚙️ Manual Court Assignment (Optional)')).toBeInTheDocument();
    });

    it('does not render when fewer than 2 present players', () => {
      const onePlayer = createMockPlayers(1, { isPresent: true });

      const { container } = render(
        <ManualCourtSelection
          players={onePlayer}
          onSelectionChange={mockOnSelectionChange}
          currentSelection={null}
        />,
      );

      expect(container.firstChild).toBeNull();
    });

    it('shows collapsed state initially', () => {
      render(
        <ManualCourtSelection
          players={mockPlayers}
          onSelectionChange={mockOnSelectionChange}
          currentSelection={null}
        />,
      );

      expect(screen.queryByText('Select 2-4 players to play together')).not.toBeInTheDocument();
      expect(screen.getByText('▶')).toBeInTheDocument();
    });

    it('expands when header is clicked', async () => {
      const user = userEvent.setup();
      render(
        <ManualCourtSelection
          players={mockPlayers}
          onSelectionChange={mockOnSelectionChange}
          currentSelection={null}
        />,
      );

      await act(async () => {
        await user.click(screen.getByTestId('manual-court-header'));
      });

      expect(screen.getByText('Select 2-4 players to play together on Court 1. The rest will be assigned automatically.')).toBeInTheDocument();
      expect(screen.getByText('▼')).toBeInTheDocument();
    });
  });

  describe('Player Selection', () => {
    const renderAndExpand = async () => {
      const user = userEvent.setup();
      render(
        <ManualCourtSelection
          players={mockPlayers}
          onSelectionChange={mockOnSelectionChange}
          currentSelection={null}
        />,
      );

      // Expand the selection panel
      await act(async () => {
        await user.click(screen.getByTestId('manual-court-header'));
      });

      return user;
    };

    it('shows all present players as selectable buttons', async () => {
      await renderAndExpand();

      mockPlayers.forEach(player => {
        expect(screen.getByTestId(`manual-court-player-${player.id}`)).toBeInTheDocument();
        expect(screen.getByText(player.name)).toBeInTheDocument();
      });
    });

    it('shows selection count initially as 0/4', async () => {
      await renderAndExpand();

      expect(screen.getByText('0/4 players selected')).toBeInTheDocument();
    });

    it('selects a player when clicked', async () => {
      const user = await renderAndExpand();
      const firstPlayerButton = screen.getByTestId(`manual-court-player-${mockPlayers[0].id}`);

      await act(async () => {
        await user.click(firstPlayerButton);
      });

      expect(mockOnSelectionChange).toHaveBeenCalledWith({
        players: [mockPlayers[0]],
      });
    });

    it('shows correct selection count after selecting players', async () => {
      const user = userEvent.setup();

      render(
        <ManualCourtSelection
          players={mockPlayers}
          onSelectionChange={mockOnSelectionChange}
          currentSelection={{ players: [mockPlayers[0]] }}
        />,
      );

      await act(async () => {
        await user.click(screen.getByTestId('manual-court-header'));
      });

      expect(screen.getByText('1/4 players selected')).toBeInTheDocument();
    });

    it('prevents selection of more than 4 players', async () => {
      const user = userEvent.setup();
      const selection = { players: mockPlayers.slice(0, 4) }; // 4 players already selected

      render(
        <ManualCourtSelection
          players={mockPlayers}
          onSelectionChange={mockOnSelectionChange}
          currentSelection={selection}
        />,
      );

      await act(async () => {
        await user.click(screen.getByTestId('manual-court-header'));
      });

      // Try to click a 5th player
      const fifthPlayerButton = screen.getByTestId(`manual-court-player-${mockPlayers[4].id}`);
      expect(fifthPlayerButton).toBeDisabled();
    });

    it('deselects a player when clicked again', async () => {
      const user = userEvent.setup();
      const selection = { players: [mockPlayers[0], mockPlayers[1]] };

      render(
        <ManualCourtSelection
          players={mockPlayers}
          onSelectionChange={mockOnSelectionChange}
          currentSelection={selection}
        />,
      );

      await act(async () => {
        await user.click(screen.getByTestId('manual-court-header'));
      });

      await act(async () => {
        await user.click(screen.getByTestId(`manual-court-player-${mockPlayers[0].id}`));
      });

      expect(mockOnSelectionChange).toHaveBeenCalledWith({
        players: [mockPlayers[1]],
      });
    });
  });

  describe('Match Type Preview', () => {
    const expandAndSelect = async (user: any, playerCount: number) => {
      render(
        <ManualCourtSelection
          players={mockPlayers}
          onSelectionChange={mockOnSelectionChange}
          currentSelection={{ players: mockPlayers.slice(0, playerCount) }}
        />,
      );

      await act(async () => {
        await user.click(screen.getByTestId('manual-court-header'));
      });
    };

    it('shows singles match preview for 2 players', async () => {
      const user = userEvent.setup();
      await expandAndSelect(user, 2);

      expect(screen.getByText('Will create: Singles match')).toBeInTheDocument();
    });

    it('shows singles match with waiting preview for 3 players', async () => {
      const user = userEvent.setup();
      await expandAndSelect(user, 3);

      expect(screen.getByText('Will create: Singles match (1 waiting)')).toBeInTheDocument();
    });

    it('shows doubles match preview for 4 players', async () => {
      const user = userEvent.setup();
      await expandAndSelect(user, 4);

      expect(screen.getByText('Will create: Doubles match')).toBeInTheDocument();
    });

    it('does not show preview for 1 player', async () => {
      const user = userEvent.setup();
      await expandAndSelect(user, 1);

      expect(screen.queryByText(/Will create:/)).not.toBeInTheDocument();
    });
  });

  describe('Selected Players Display', () => {
    it('shows selected players with tags', async () => {
      const user = userEvent.setup();
      const selection = { players: [mockPlayers[0], mockPlayers[1]] };

      render(
        <ManualCourtSelection
          players={mockPlayers}
          onSelectionChange={mockOnSelectionChange}
          currentSelection={selection}
        />,
      );

      await act(async () => {
        await user.click(screen.getByTestId('manual-court-header'));
      });

      expect(screen.getByText('Selected for Court 1:')).toBeInTheDocument();
      expect(screen.getByText(/Selected for Court 1:/)).toBeInTheDocument();

      // Check for selected player tags specifically
      const selectedPlayerTags = screen.getAllByText(mockPlayers[0].name);
      expect(selectedPlayerTags.length).toBeGreaterThan(0);

      const selectedPlayerTags2 = screen.getAllByText(mockPlayers[1].name);
      expect(selectedPlayerTags2.length).toBeGreaterThan(0);
    });

    it('allows removing players from selected tags', async () => {
      const user = userEvent.setup();
      const selection = { players: [mockPlayers[0], mockPlayers[1]] };

      render(
        <ManualCourtSelection
          players={mockPlayers}
          onSelectionChange={mockOnSelectionChange}
          currentSelection={selection}
        />,
      );

      await act(async () => {
        await user.click(screen.getByTestId('manual-court-header'));
      });

      // Find and click the remove button (×) for the first player
      const removeButtons = screen.getAllByText('×');
      await act(async () => {
        await user.click(removeButtons[0]);
      });

      expect(mockOnSelectionChange).toHaveBeenCalledWith({
        players: [mockPlayers[1]],
      });
    });

    it('shows clear selection button and clears all when clicked', async () => {
      const user = userEvent.setup();
      const selection = { players: [mockPlayers[0], mockPlayers[1]] };

      render(
        <ManualCourtSelection
          players={mockPlayers}
          onSelectionChange={mockOnSelectionChange}
          currentSelection={selection}
        />,
      );

      await act(async () => {
        await user.click(screen.getByTestId('manual-court-header'));
      });

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
      const mixedPlayers = [
        ...createMockPlayers(3, { isPresent: true }),
        ...createMockPlayers(2, { isPresent: false }),
      ];

      render(
        <ManualCourtSelection
          players={mixedPlayers}
          onSelectionChange={mockOnSelectionChange}
          currentSelection={null}
        />,
      );

      // Should render because there are 3 present players (>= 2)
      expect(screen.getByTestId('manual-court-header')).toBeInTheDocument();
    });

    it('does not render when no present players meet minimum', () => {
      const absentPlayers = createMockPlayers(5, { isPresent: false });

      const { container } = render(
        <ManualCourtSelection
          players={absentPlayers}
          onSelectionChange={mockOnSelectionChange}
          currentSelection={null}
        />,
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels for player buttons', async () => {
      const user = userEvent.setup();
      render(
        <ManualCourtSelection
          players={mockPlayers}
          onSelectionChange={mockOnSelectionChange}
          currentSelection={null}
        />,
      );

      await act(async () => {
        await user.click(screen.getByTestId('manual-court-header'));
      });

      const firstPlayerButton = screen.getByTestId(`manual-court-player-${mockPlayers[0].id}`);
      expect(firstPlayerButton).toHaveAttribute('aria-label',
        `Add ${mockPlayers[0].name} to manual court`);
    });

    it('has proper ARIA labels for remove buttons', async () => {
      const user = userEvent.setup();
      const selection = { players: [mockPlayers[0]] };

      render(
        <ManualCourtSelection
          players={mockPlayers}
          onSelectionChange={mockOnSelectionChange}
          currentSelection={selection}
        />,
      );

      await act(async () => {
        await user.click(screen.getByTestId('manual-court-header'));
      });

      const removeButton = screen.getByTitle('Remove from manual court');
      expect(removeButton).toHaveAttribute('aria-label',
        `Remove ${mockPlayers[0].name} from manual court`);
    });
  });
});
