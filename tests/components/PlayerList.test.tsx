import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import PlayerList from '../../src/components/PlayerList';
import { createMockPlayers } from '../data/testFactories';

describe('PlayerList Component', () => {
  const user = userEvent.setup();

  it('displays all players in the list', () => {
    const players = createMockPlayers(3);
    const mockToggle = vi.fn();
    const mockRemove = vi.fn();

    render(
      <PlayerList
        players={players}
        onPlayerToggle={mockToggle}
        onRemovePlayer={mockRemove}
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
    const mockToggle = vi.fn();
    const mockRemove = vi.fn();

    render(
      <PlayerList
        players={players}
        onPlayerToggle={mockToggle}
        onRemovePlayer={mockRemove}
      />,
    );

    expect(screen.getByText('2')).toBeInTheDocument(); // Present count
    expect(screen.getByText('1')).toBeInTheDocument(); // Absent count
    expect(screen.getByText('3')).toBeInTheDocument(); // Total count
  });

  it('calls onPlayerToggle when checkbox is clicked', async () => {
    const players = createMockPlayers(1);
    const mockToggle = vi.fn();
    const mockRemove = vi.fn();

    render(
      <PlayerList
        players={players}
        onPlayerToggle={mockToggle}
        onRemovePlayer={mockRemove}
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
    const mockToggle = vi.fn();
    const mockRemove = vi.fn();

    render(
      <PlayerList
        players={players}
        onPlayerToggle={mockToggle}
        onRemovePlayer={mockRemove}
      />,
    );

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(2);

    // First checkbox should be checked (present player)
    expect(checkboxes[0]).toBeChecked();

    // Second checkbox should be unchecked (absent player)
    expect(checkboxes[1]).not.toBeChecked();
  });

  it('maintains all players in the list regardless of isPresent status', () => {
    const players = [
      { id: '1', name: 'Player A', isPresent: true },
      { id: '2', name: 'Player B', isPresent: false },
      { id: '3', name: 'Player C', isPresent: true },
      { id: '4', name: 'Player D', isPresent: false },
    ];
    const mockToggle = vi.fn();
    const mockRemove = vi.fn();

    render(
      <PlayerList
        players={players}
        onPlayerToggle={mockToggle}
        onRemovePlayer={mockRemove}
      />,
    );

    // All players should be visible in the list
    expect(screen.getByText('Player A')).toBeInTheDocument();
    expect(screen.getByText('Player B')).toBeInTheDocument();
    expect(screen.getByText('Player C')).toBeInTheDocument();
    expect(screen.getByText('Player D')).toBeInTheDocument();

    // Should have 4 checkboxes total
    expect(screen.getAllByRole('checkbox')).toHaveLength(4);

    // Should have 4 remove buttons total
    expect(screen.getAllByTitle('Delete player permanently')).toHaveLength(4);
  });

  it('calls onRemovePlayer when remove button is clicked', async () => {
    const players = createMockPlayers(1);
    const mockToggle = vi.fn();
    const mockRemove = vi.fn();

    render(
      <PlayerList
        players={players}
        onPlayerToggle={mockToggle}
        onRemovePlayer={mockRemove}
      />,
    );

    const removeButton = screen.getByTitle('Delete player permanently');
    await user.click(removeButton);

    expect(mockRemove).toHaveBeenCalledWith('player-0');
  });
});