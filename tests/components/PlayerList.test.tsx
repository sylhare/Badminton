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

  it('calls onPlayerToggle when checkbox is clicked', async () => {
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

    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);

    expect(mockToggle).toHaveBeenCalledWith('player-0');
  });

  it('shows checkboxes in correct state based on isPresent', () => {
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

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(2);

    expect(checkboxes[0]).toBeChecked();

    expect(checkboxes[1]).not.toBeChecked();
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

    expect(screen.getAllByRole('checkbox')).toHaveLength(4);

    expect(screen.getAllByTitle('Delete player permanently')).toHaveLength(4);
  });

  it('calls onRemovePlayer when remove button is clicked', async () => {
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

    expect(mockRemove).toHaveBeenCalledWith('player-0');
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