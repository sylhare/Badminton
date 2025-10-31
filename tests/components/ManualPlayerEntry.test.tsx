import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';

import ManualPlayerEntry from '../../src/components/ManualPlayerEntry';

vi.mock('../../src/components/ImageUpload', () => ({
  default: ({ onPlayersExtracted }: { onPlayersExtracted: (players: string[]) => void }) => (
    <div data-testid="mock-image-upload">Mock Image Upload</div>
  ),
}));

describe('ManualPlayerEntry Component', () => {
  const mockOnPlayersAdded = vi.fn();
  const mockOnPlayersExtracted = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders both single and bulk entry forms', () => {
    render(<ManualPlayerEntry onPlayersAdded={mockOnPlayersAdded} onPlayersExtracted={mockOnPlayersExtracted} />);

    expect(screen.getByText('✍️ Add Single Player')).toBeInTheDocument();
    expect(screen.getByText('📝 Add Multiple Players')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter player name...')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/John Doe, Jane Smith/)).toBeInTheDocument();
  });

  it('renders collapsible image upload section', () => {
    render(<ManualPlayerEntry onPlayersAdded={mockOnPlayersAdded} onPlayersExtracted={mockOnPlayersExtracted} />);

    expect(screen.getByText('📸 Add users with a picture')).toBeInTheDocument();
    expect(screen.getByTestId('image-upload-toggle')).toBeInTheDocument();
  });

  it('expands and collapses image upload section on click', async () => {
    const user = userEvent.setup();
    render(<ManualPlayerEntry onPlayersAdded={mockOnPlayersAdded} onPlayersExtracted={mockOnPlayersExtracted} />);

    const toggleButton = screen.getByTestId('image-upload-toggle');
    
    expect(screen.queryByTestId('mock-image-upload')).not.toBeInTheDocument();

    await act(async () => await user.click(toggleButton));

    expect(screen.getByTestId('mock-image-upload')).toBeInTheDocument();
    await act(async () => await user.click(toggleButton));

    expect(screen.queryByTestId('mock-image-upload')).not.toBeInTheDocument();
  });

  it('adds a single player correctly', async () => {
    const user = userEvent.setup();
    render(<ManualPlayerEntry onPlayersAdded={mockOnPlayersAdded} onPlayersExtracted={mockOnPlayersExtracted} />);

    const input = screen.getByPlaceholderText('Enter player name...');
    const button = screen.getByRole('button', { name: /add player/i });

    await act(async () => {
      await user.type(input, 'John Doe');
      await user.click(button);
    });

    expect(mockOnPlayersAdded).toHaveBeenCalledWith(['John Doe']);
    expect(input).toHaveValue('');
  });

  it('adds multiple players with comma separation', async () => {
    const user = userEvent.setup();
    render(<ManualPlayerEntry onPlayersAdded={mockOnPlayersAdded} onPlayersExtracted={mockOnPlayersExtracted} />);

    const textarea = screen.getByPlaceholderText(/John Doe, Jane Smith/);
    const button = screen.getByRole('button', { name: /add all players/i });

    await act(async () => {
      await user.type(textarea, 'John Doe, Jane Smith, Mike Johnson');
      await user.click(button);
    });

    expect(mockOnPlayersAdded).toHaveBeenCalledWith([
      'John Doe',
      'Jane Smith',
      'Mike Johnson',
    ]);
    expect(textarea).toHaveValue('');
  });

  it('adds multiple players with newline separation', async () => {
    const user = userEvent.setup();
    render(<ManualPlayerEntry onPlayersAdded={mockOnPlayersAdded} onPlayersExtracted={mockOnPlayersExtracted} />);

    const textarea = screen.getByPlaceholderText(/John Doe, Jane Smith/);
    const button = screen.getByRole('button', { name: /add all players/i });

    await act(async () => {
      await user.type(textarea, 'John Doe\nJane Smith\nMike Johnson');
      await user.click(button);
    });

    expect(mockOnPlayersAdded).toHaveBeenCalledWith([
      'John Doe',
      'Jane Smith',
      'Mike Johnson',
    ]);
  });

  it('handles mixed comma and newline separation', async () => {
    const user = userEvent.setup();
    render(<ManualPlayerEntry onPlayersAdded={mockOnPlayersAdded} onPlayersExtracted={mockOnPlayersExtracted} />);

    const textarea = screen.getByPlaceholderText(/John Doe, Jane Smith/);
    const button = screen.getByRole('button', { name: /add all players/i });

    await act(async () => {
      await user.type(textarea, 'John Doe, Jane Smith\nMike Johnson,Sarah Davis');
      await user.click(button);
    });

    expect(mockOnPlayersAdded).toHaveBeenCalledWith([
      'John Doe',
      'Jane Smith',
      'Mike Johnson',
      'Sarah Davis',
    ]);
  });

  it('filters out empty entries', async () => {
    const user = userEvent.setup();
    render(<ManualPlayerEntry onPlayersAdded={mockOnPlayersAdded} onPlayersExtracted={mockOnPlayersExtracted} />);

    const textarea = screen.getByPlaceholderText(/John Doe, Jane Smith/);
    const button = screen.getByRole('button', { name: /add all players/i });

    await act(async () => {
      await user.type(textarea, 'John Doe,, \n  ,Jane Smith,   \n\nMike Johnson,');
      await user.click(button);
    });

    expect(mockOnPlayersAdded).toHaveBeenCalledWith([
      'John Doe',
      'Jane Smith',
      'Mike Johnson',
    ]);
  });

  it('trims whitespace from names', async () => {
    const user = userEvent.setup();
    render(<ManualPlayerEntry onPlayersAdded={mockOnPlayersAdded} onPlayersExtracted={mockOnPlayersExtracted} />);

    const textarea = screen.getByPlaceholderText(/John Doe, Jane Smith/);
    const button = screen.getByRole('button', { name: /add all players/i });

    await act(async () => {
      await user.type(textarea, '  John Doe  ,  Jane Smith  ');
      await user.click(button);
    });

    expect(mockOnPlayersAdded).toHaveBeenCalledWith([
      'John Doe',
      'Jane Smith',
    ]);
  });

  it('does not add empty single player name', async () => {
    const user = userEvent.setup();
    render(<ManualPlayerEntry onPlayersAdded={mockOnPlayersAdded} onPlayersExtracted={mockOnPlayersExtracted} />);

    const input = screen.getByPlaceholderText('Enter player name...');
    const button = screen.getByRole('button', { name: /add player/i });

    await act(async () => {
      await user.type(input, '   ');
      await user.click(button);
    });

    expect(mockOnPlayersAdded).not.toHaveBeenCalled();
  });

  it('does not add empty bulk text', async () => {
    const user = userEvent.setup();
    render(<ManualPlayerEntry onPlayersAdded={mockOnPlayersAdded} onPlayersExtracted={mockOnPlayersExtracted} />);

    const textarea = screen.getByPlaceholderText(/John Doe, Jane Smith/);
    const button = screen.getByRole('button', { name: /add all players/i });

    await act(async () => {
      await user.type(textarea, '   \n  \n  ');
      await user.click(button);
    });

    expect(mockOnPlayersAdded).not.toHaveBeenCalled();
  });
});