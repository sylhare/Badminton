import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import PlayerList from '../../src/components/PlayerList';
import { createMockPlayers } from '../data/testFactories';

describe('PlayerList Component', () => {
  const user = userEvent.setup();
  const mockToggle = vi.fn();
  const mockRemove = vi.fn();
  const mockClearAll = vi.fn();
  const mockResetAlgorithm = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays all players in the list', () => {
    const players = createMockPlayers(3);

    render(
      <PlayerList
        players={players}
        onPlayerToggle={mockToggle}
        onRemovePlayer={mockRemove}
        onClearAllPlayers={mockClearAll}
        onResetAlgorithm={mockResetAlgorithm}
      />,
    );

    expect(screen.getByText('Player 1')).toBeInTheDocument();
    expect(screen.getByText('Player 2')).toBeInTheDocument();
    expect(screen.getByText('Player 3')).toBeInTheDocument();
  });

  it('shows correct stats for present and absent players', () => {
    const players = [
      { id: '1', name: 'Present Player 1', isPresent: true },
      { id: '2', name: 'Present Player 2', isPresent: true },
      { id: '3', name: 'Absent Player 1', isPresent: false },
    ];

    render(
      <PlayerList
        players={players}
        onPlayerToggle={mockToggle}
        onRemovePlayer={mockRemove}
        onClearAllPlayers={mockClearAll}
        onResetAlgorithm={mockResetAlgorithm}
      />,
    );

    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('calls onPlayerToggle when toggle presence button is clicked', async () => {
    const players = createMockPlayers(1);

    render(
      <PlayerList
        players={players}
        onPlayerToggle={mockToggle}
        onRemovePlayer={mockRemove}
        onClearAllPlayers={mockClearAll}
        onResetAlgorithm={mockResetAlgorithm}
      />,
    );

    const toggleButton = screen.getByTestId('toggle-presence-player-0');
    await user.click(toggleButton);

    expect(mockToggle).toHaveBeenCalledWith('player-0');
  });

  it('shows toggle buttons with correct styling based on isPresent', () => {
    const players = [
      { id: '1', name: 'Present Player', isPresent: true },
      { id: '2', name: 'Absent Player', isPresent: false },
    ];

    render(
      <PlayerList
        players={players}
        onPlayerToggle={mockToggle}
        onRemovePlayer={mockRemove}
        onClearAllPlayers={mockClearAll}
        onResetAlgorithm={mockResetAlgorithm}
      />,
    );

    const presentToggle = screen.getByTestId('toggle-presence-1');
    const absentToggle = screen.getByTestId('toggle-presence-2');

    expect(presentToggle).toHaveClass('present');
    expect(presentToggle).toHaveAttribute('title', 'Mark as absent');

    expect(absentToggle).toHaveClass('absent');
    expect(absentToggle).toHaveAttribute('title', 'Mark as present');
  });

  it('maintains all players in the list regardless of isPresent status', () => {
    const players = [
      { id: '1', name: 'Player A', isPresent: true },
      { id: '2', name: 'Player B', isPresent: false },
      { id: '3', name: 'Player C', isPresent: true },
      { id: '4', name: 'Player D', isPresent: false },
    ];

    render(
      <PlayerList
        players={players}
        onPlayerToggle={mockToggle}
        onRemovePlayer={mockRemove}
        onClearAllPlayers={mockClearAll}
        onResetAlgorithm={mockResetAlgorithm}
      />,
    );

    expect(screen.getByText('Player A')).toBeInTheDocument();
    expect(screen.getByText('Player B')).toBeInTheDocument();
    expect(screen.getByText('Player C')).toBeInTheDocument();
    expect(screen.getByText('Player D')).toBeInTheDocument();

    expect(screen.getAllByTestId(/^toggle-presence-/)).toHaveLength(4);

    expect(screen.getAllByTitle('Delete player permanently')).toHaveLength(4);
  });

  it('opens removal modal when remove button is clicked', async () => {
    const players = createMockPlayers(1);

    render(
      <PlayerList
        players={players}
        onPlayerToggle={mockToggle}
        onRemovePlayer={mockRemove}
        onClearAllPlayers={mockClearAll}
        onResetAlgorithm={mockResetAlgorithm}
      />,
    );

    const removeButton = screen.getByTitle('Delete player permanently');
    await user.click(removeButton);

    expect(screen.getByTestId('player-removal-modal')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Remove Player' })).toBeInTheDocument();
    const playerNameElements = screen.getAllByText(/Player 1/);
    expect(playerNameElements).toHaveLength(2);
  });

  describe('Clear All Players Functionality', () => {
    it('shows clear all button when there are players', () => {
      const players = createMockPlayers(2);

      render(
        <PlayerList
          players={players}
          onPlayerToggle={mockToggle}
          onRemovePlayer={mockRemove}
          onClearAllPlayers={mockClearAll}
          onResetAlgorithm={mockResetAlgorithm}
        />,
      );

      expect(screen.getByRole('button', { name: /clear all players/i })).toBeInTheDocument();
    });

    it('does not show clear all button when there are no players', () => {
      render(
        <PlayerList
          players={[]}
          onPlayerToggle={mockToggle}
          onRemovePlayer={mockRemove}
          onClearAllPlayers={mockClearAll}
          onResetAlgorithm={mockResetAlgorithm}
        />,
      );

      expect(screen.queryByRole('button', { name: /clear all players/i })).not.toBeInTheDocument();
    });

    it('opens confirmation modal when clear all button is clicked', async () => {
      const players = createMockPlayers(2);

      render(
        <PlayerList
          players={players}
          onPlayerToggle={mockToggle}
          onRemovePlayer={mockRemove}
          onClearAllPlayers={mockClearAll}
          onResetAlgorithm={mockResetAlgorithm}
        />,
      );

      const clearButton = screen.getByRole('button', { name: /clear all players/i });
      await user.click(clearButton);

      expect(screen.getByRole('heading', { name: 'Clear All Players' })).toBeInTheDocument();
      expect(screen.getByText(/are you sure you want to remove all players/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Clear All' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('calls onClearAllPlayers when confirmation is accepted', async () => {
      const players = createMockPlayers(2);

      render(
        <PlayerList
          players={players}
          onPlayerToggle={mockToggle}
          onRemovePlayer={mockRemove}
          onClearAllPlayers={mockClearAll}
          onResetAlgorithm={mockResetAlgorithm}
        />,
      );

      const clearButton = screen.getByRole('button', { name: /clear all players/i });
      await user.click(clearButton);

      const confirmButton = screen.getByRole('button', { name: 'Clear All' });
      await user.click(confirmButton);

      expect(mockClearAll).toHaveBeenCalledTimes(1);

      expect(screen.queryByRole('heading', { name: 'Clear All Players' })).not.toBeInTheDocument();
    });

    it('does not call onClearAllPlayers when confirmation is cancelled', async () => {
      const players = createMockPlayers(2);

      render(
        <PlayerList
          players={players}
          onPlayerToggle={mockToggle}
          onRemovePlayer={mockRemove}
          onClearAllPlayers={mockClearAll}
          onResetAlgorithm={mockResetAlgorithm}
        />,
      );

      const clearButton = screen.getByRole('button', { name: /clear all players/i });
      await user.click(clearButton);

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await user.click(cancelButton);

      expect(mockClearAll).not.toHaveBeenCalled();

      expect(screen.queryByRole('heading', { name: 'Clear All Players' })).not.toBeInTheDocument();
    });

    it('closes modal when clicking the X button', async () => {
      const players = createMockPlayers(1);

      render(
        <PlayerList
          players={players}
          onPlayerToggle={mockToggle}
          onRemovePlayer={mockRemove}
          onClearAllPlayers={mockClearAll}
          onResetAlgorithm={mockResetAlgorithm}
        />,
      );

      const clearButton = screen.getByRole('button', { name: /clear all players/i });
      await user.click(clearButton);

      const closeButton = document.querySelector('.modal-close');

      expect(closeButton).toBeInTheDocument();
      await user.click(closeButton!);

      expect(mockClearAll).not.toHaveBeenCalled();
      expect(screen.queryByRole('heading', { name: 'Clear All Players' })).not.toBeInTheDocument();
    });

    it('has proper tooltip on clear all button', () => {
      const players = createMockPlayers(1);

      render(
        <PlayerList
          players={players}
          onPlayerToggle={mockToggle}
          onRemovePlayer={mockRemove}
          onClearAllPlayers={mockClearAll}
          onResetAlgorithm={mockResetAlgorithm}
        />,
      );

      const clearButton = screen.getByRole('button', { name: /clear all players/i });
      expect(clearButton).toHaveAttribute('title', 'Remove all players and reset scores');
    });
  });

  describe('Bench counts and force bench functionality', () => {
    const mockToggleForceBench = vi.fn();

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('shows bench counts for present players', () => {
      const players = createMockPlayers(2);
      const benchCounts = new Map([['player-0', 5], ['player-1', 3]]);

      render(
        <PlayerList
          players={players}
          onPlayerToggle={mockToggle}
          onRemovePlayer={mockRemove}
          onClearAllPlayers={mockClearAll}
          onResetAlgorithm={mockResetAlgorithm}
          benchCounts={benchCounts}
        />,
      );

      const benchCount0 = screen.getByTestId('bench-count-player-0');
      const benchCount1 = screen.getByTestId('bench-count-player-1');
      expect(benchCount0).toHaveAttribute('title', 'Bench count: 5');
      expect(benchCount1).toHaveAttribute('title', 'Bench count: 3');
    });

    it('shows 0 bench count when player has no bench history', () => {
      const players = createMockPlayers(1);
      const benchCounts = new Map<string, number>();

      render(
        <PlayerList
          players={players}
          onPlayerToggle={mockToggle}
          onRemovePlayer={mockRemove}
          onClearAllPlayers={mockClearAll}
          onResetAlgorithm={mockResetAlgorithm}
          benchCounts={benchCounts}
        />,
      );

      const benchCount = screen.getByTestId('bench-count-player-0');
      expect(benchCount).toBeInTheDocument();
      expect(benchCount).toHaveAttribute('title', 'Bench count: 0');
    });

    it('shows bench next toggle for present players', () => {
      const players = createMockPlayers(2);

      render(
        <PlayerList
          players={players}
          onPlayerToggle={mockToggle}
          onRemovePlayer={mockRemove}
          onClearAllPlayers={mockClearAll}
          onResetAlgorithm={mockResetAlgorithm}
          onToggleForceBench={mockToggleForceBench}
        />,
      );

      expect(screen.getAllByText('Bench next')).toHaveLength(2);
    });

    it('does not show bench info for absent players', () => {
      const players = [
        { id: 'present-1', name: 'Present Player', isPresent: true },
        { id: 'absent-1', name: 'Absent Player', isPresent: false },
      ];
      const benchCounts = new Map([['present-1', 2], ['absent-1', 3]]);

      render(
        <PlayerList
          players={players}
          onPlayerToggle={mockToggle}
          onRemovePlayer={mockRemove}
          onClearAllPlayers={mockClearAll}
          onResetAlgorithm={mockResetAlgorithm}
          benchCounts={benchCounts}
        />,
      );

      expect(screen.getByTestId('bench-count-present-1')).toBeInTheDocument();
      expect(screen.queryByTestId('bench-count-absent-1')).not.toBeInTheDocument();
      expect(screen.getAllByText('Bench next')).toHaveLength(1);
    });

    it('calls onToggleForceBench when toggle is clicked', async () => {
      const players = createMockPlayers(1);

      render(
        <PlayerList
          players={players}
          onPlayerToggle={mockToggle}
          onRemovePlayer={mockRemove}
          onClearAllPlayers={mockClearAll}
          onResetAlgorithm={mockResetAlgorithm}
          onToggleForceBench={mockToggleForceBench}
        />,
      );

      const checkbox = screen.getByTestId('force-bench-player-0');
      await user.click(checkbox);

      expect(mockToggleForceBench).toHaveBeenCalledWith('player-0');
    });

    it('shows force bench toggle as checked when player is force-benched', () => {
      const players = createMockPlayers(2);
      const forceBenchPlayerIds = new Set(['player-0']);

      render(
        <PlayerList
          players={players}
          onPlayerToggle={mockToggle}
          onRemovePlayer={mockRemove}
          onClearAllPlayers={mockClearAll}
          onResetAlgorithm={mockResetAlgorithm}
          forceBenchPlayerIds={forceBenchPlayerIds}
          onToggleForceBench={mockToggleForceBench}
        />,
      );

      const checkbox0 = screen.getByTestId('force-bench-player-0') as HTMLInputElement;
      const checkbox1 = screen.getByTestId('force-bench-player-1') as HTMLInputElement;

      expect(checkbox0.checked).toBe(true);
      expect(checkbox1.checked).toBe(false);
    });

    it('shows active toggle switch styling when force-benched', () => {
      const players = createMockPlayers(1);
      const forceBenchPlayerIds = new Set(['player-0']);

      render(
        <PlayerList
          players={players}
          onPlayerToggle={mockToggle}
          onRemovePlayer={mockRemove}
          onClearAllPlayers={mockClearAll}
          onResetAlgorithm={mockResetAlgorithm}
          forceBenchPlayerIds={forceBenchPlayerIds}
          onToggleForceBench={mockToggleForceBench}
        />,
      );

      const toggleSwitch = document.querySelector('.toggle-switch');
      expect(toggleSwitch).toHaveClass('active');
    });

    it('always adds with-bench-info class to player items', () => {
      const players = createMockPlayers(1);

      render(
        <PlayerList
          players={players}
          onPlayerToggle={mockToggle}
          onRemovePlayer={mockRemove}
          onClearAllPlayers={mockClearAll}
          onResetAlgorithm={mockResetAlgorithm}
        />,
      );

      const playerItem = document.querySelector('.player-item');
      expect(playerItem).toHaveClass('with-bench-info');
    });
  });

  describe('Player Removal Modal functionality', () => {
    it('calls onRemovePlayer when confirm remove is clicked', async () => {
      const players = createMockPlayers(1);

      render(
        <PlayerList
          players={players}
          onPlayerToggle={mockToggle}
          onRemovePlayer={mockRemove}
          onClearAllPlayers={mockClearAll}
          onResetAlgorithm={mockResetAlgorithm}
        />,
      );

      const removeButton = screen.getByTitle('Delete player permanently');
      await user.click(removeButton);

      const confirmRemoveButton = screen.getByTestId('player-removal-modal-remove');
      await user.click(confirmRemoveButton);

      expect(mockRemove).toHaveBeenCalledWith('player-0');
      expect(screen.queryByTestId('player-removal-modal')).not.toBeInTheDocument();
    });

    it('calls onPlayerToggle when mark as absent is clicked', async () => {
      const players = [{ id: 'test-1', name: 'Test Player', isPresent: true }];

      render(
        <PlayerList
          players={players}
          onPlayerToggle={mockToggle}
          onRemovePlayer={mockRemove}
          onClearAllPlayers={mockClearAll}
          onResetAlgorithm={mockResetAlgorithm}
        />,
      );

      const removeButton = screen.getByTestId('remove-player-test-1');
      await user.click(removeButton);

      const absentButton = screen.getByTestId('player-removal-modal-absent');
      await user.click(absentButton);

      expect(mockToggle).toHaveBeenCalledWith('test-1');
      expect(mockRemove).not.toHaveBeenCalled();
      expect(screen.queryByTestId('player-removal-modal')).not.toBeInTheDocument();
    });

    it('closes modal when X button is clicked', async () => {
      const players = createMockPlayers(1);

      render(
        <PlayerList
          players={players}
          onPlayerToggle={mockToggle}
          onRemovePlayer={mockRemove}
          onClearAllPlayers={mockClearAll}
          onResetAlgorithm={mockResetAlgorithm}
        />,
      );

      const removeButton = screen.getByTitle('Delete player permanently');
      await user.click(removeButton);

      const closeButton = screen.getByTestId('player-removal-modal-close');
      await user.click(closeButton);

      expect(mockRemove).not.toHaveBeenCalled();
      expect(mockToggle).not.toHaveBeenCalled();
      expect(screen.queryByTestId('player-removal-modal')).not.toBeInTheDocument();
    });

    it('closes modal when clicking on overlay', async () => {
      const players = createMockPlayers(1);

      render(
        <PlayerList
          players={players}
          onPlayerToggle={mockToggle}
          onRemovePlayer={mockRemove}
          onClearAllPlayers={mockClearAll}
          onResetAlgorithm={mockResetAlgorithm}
        />,
      );

      const removeButton = screen.getByTitle('Delete player permanently');
      await user.click(removeButton);

      const overlay = screen.getByTestId('player-removal-modal');
      await user.click(overlay);

      expect(mockRemove).not.toHaveBeenCalled();
      expect(screen.queryByTestId('player-removal-modal')).not.toBeInTheDocument();
    });

    it('shows correct player name in modal', async () => {
      const players = [
        { id: '1', name: 'Alice Johnson', isPresent: true },
        { id: '2', name: 'Bob Smith', isPresent: true },
      ];

      render(
        <PlayerList
          players={players}
          onPlayerToggle={mockToggle}
          onRemovePlayer={mockRemove}
          onClearAllPlayers={mockClearAll}
          onResetAlgorithm={mockResetAlgorithm}
        />,
      );

      const removeButton = screen.getByTestId('remove-player-2');
      await user.click(removeButton);

      const bobSmithElements = screen.getAllByText(/Bob Smith/);
      expect(bobSmithElements).toHaveLength(2);

      const aliceElements = screen.getAllByText(/Alice Johnson/);
      expect(aliceElements).toHaveLength(1);
    });
  });

  describe('Reset Algorithm functionality', () => {
    it('shows Reset Algorithm button when players exist', () => {
      const players = createMockPlayers(2);

      render(
        <PlayerList
          players={players}
          onPlayerToggle={mockToggle}
          onRemovePlayer={mockRemove}
          onClearAllPlayers={mockClearAll}
          onResetAlgorithm={mockResetAlgorithm}
        />,
      );

      expect(screen.getByTestId('reset-algorithm-button')).toBeInTheDocument();
      expect(screen.getByText('Reset Algorithm')).toBeInTheDocument();
    });

    it('has proper tooltip on reset algorithm button', () => {
      const players = createMockPlayers(1);

      render(
        <PlayerList
          players={players}
          onPlayerToggle={mockToggle}
          onRemovePlayer={mockRemove}
          onClearAllPlayers={mockClearAll}
          onResetAlgorithm={mockResetAlgorithm}
        />,
      );

      const resetButton = screen.getByTestId('reset-algorithm-button');
      expect(resetButton).toHaveAttribute('title', 'Reset who played with who history (keeps all players)');
    });

    it('calls onResetAlgorithm when Reset Algorithm is confirmed', async () => {
      const players = createMockPlayers(2);

      render(
        <PlayerList
          players={players}
          onPlayerToggle={mockToggle}
          onRemovePlayer={mockRemove}
          onClearAllPlayers={mockClearAll}
          onResetAlgorithm={mockResetAlgorithm}
        />,
      );

      const resetButton = screen.getByTestId('reset-algorithm-button');
      await user.click(resetButton);

      expect(screen.getByRole('heading', { name: 'Reset Algorithm' })).toBeInTheDocument();
      expect(screen.getByText(/reset the algorithm's memory/)).toBeInTheDocument();

      const confirmButton = screen.getByTestId('confirm-modal-confirm');
      await user.click(confirmButton);

      expect(mockResetAlgorithm).toHaveBeenCalledOnce();
    });

    it('does not call onResetAlgorithm when Reset Algorithm is canceled', async () => {
      const players = createMockPlayers(2);

      render(
        <PlayerList
          players={players}
          onPlayerToggle={mockToggle}
          onRemovePlayer={mockRemove}
          onClearAllPlayers={mockClearAll}
          onResetAlgorithm={mockResetAlgorithm}
        />,
      );

      const resetButton = screen.getByTestId('reset-algorithm-button');
      await user.click(resetButton);

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await user.click(cancelButton);

      expect(mockResetAlgorithm).not.toHaveBeenCalled();
    });
  });
});
