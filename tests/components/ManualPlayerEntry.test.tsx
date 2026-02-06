import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';

import ManualPlayerEntry from '../../src/components/ManualPlayerEntry';

vi.mock('../../src/components/ImageUploadModal', () => ({
  default: ({ isOpen, onClose, onPlayersAdded }: { isOpen: boolean; onClose: () => void; onPlayersAdded: (players: string[]) => void }) => (
    isOpen ? (
      <div data-testid="mock-image-upload-modal">
        <button onClick={onClose} data-testid="close-modal">Close</button>
        <button onClick={() => onPlayersAdded(['Player1', 'Player2'])} data-testid="add-from-modal">Add Players</button>
      </div>
    ) : null
  ),
}));

describe('ManualPlayerEntry Component', () => {
  const mockOnPlayersAdded = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders player entry form with input, camera button, and add button', () => {
    render(<ManualPlayerEntry onPlayersAdded={mockOnPlayersAdded} />);

    expect(screen.getByTestId('player-entry-input')).toBeInTheDocument();
    expect(screen.getByTestId('open-image-modal-button')).toBeInTheDocument();
    expect(screen.getByTestId('add-player-button')).toBeInTheDocument();
  });

  it('add button is disabled when input is empty', () => {
    render(<ManualPlayerEntry onPlayersAdded={mockOnPlayersAdded} />);

    const addButton = screen.getByTestId('add-player-button');
    expect(addButton).toBeDisabled();
  });

  it('adds a single player correctly', async () => {
    const user = userEvent.setup();
    render(<ManualPlayerEntry onPlayersAdded={mockOnPlayersAdded} />);

    const input = screen.getByTestId('player-entry-input');
    const button = screen.getByTestId('add-player-button');

    await act(async () => {
      await user.type(input, 'John Doe');
      await user.click(button);
    });

    expect(mockOnPlayersAdded).toHaveBeenCalledWith(['John Doe']);
    expect(input).toHaveValue('');
  });

  it('adds multiple players with comma separation', async () => {
    const user = userEvent.setup();
    render(<ManualPlayerEntry onPlayersAdded={mockOnPlayersAdded} />);

    const input = screen.getByTestId('player-entry-input');
    const button = screen.getByTestId('add-player-button');

    await act(async () => {
      await user.type(input, 'John Doe, Jane Smith, Mike Johnson');
      await user.click(button);
    });

    expect(mockOnPlayersAdded).toHaveBeenCalledWith([
      'John Doe',
      'Jane Smith',
      'Mike Johnson',
    ]);
    expect(input).toHaveValue('');
  });

  it('adds multiple players with backtick separation', async () => {
    const user = userEvent.setup();
    render(<ManualPlayerEntry onPlayersAdded={mockOnPlayersAdded} />);

    const input = screen.getByTestId('player-entry-input');
    const button = screen.getByTestId('add-player-button');

    await act(async () => {
      await user.type(input, 'John Doe`Jane Smith`Mike Johnson');
      await user.click(button);
    });

    expect(mockOnPlayersAdded).toHaveBeenCalledWith([
      'John Doe',
      'Jane Smith',
      'Mike Johnson',
    ]);
  });

  it('filters out empty entries', async () => {
    const user = userEvent.setup();
    render(<ManualPlayerEntry onPlayersAdded={mockOnPlayersAdded} />);

    const input = screen.getByTestId('player-entry-input');
    const button = screen.getByTestId('add-player-button');

    await act(async () => {
      await user.type(input, 'John Doe,, Jane Smith,   ,Mike Johnson,');
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
    render(<ManualPlayerEntry onPlayersAdded={mockOnPlayersAdded} />);

    const input = screen.getByTestId('player-entry-input');
    const button = screen.getByTestId('add-player-button');

    await act(async () => {
      await user.type(input, '  John Doe  ,  Jane Smith  ');
      await user.click(button);
    });

    expect(mockOnPlayersAdded).toHaveBeenCalledWith([
      'John Doe',
      'Jane Smith',
    ]);
  });

  it('does not add empty/whitespace only input', async () => {
    const user = userEvent.setup();
    render(<ManualPlayerEntry onPlayersAdded={mockOnPlayersAdded} />);

    const input = screen.getByTestId('player-entry-input');

    await act(async () => {
      await user.type(input, '   ');
    });

    // Button should still be disabled because trimmed input is empty
    expect(screen.getByTestId('add-player-button')).toBeDisabled();
  });

  it('shows multi-input hint when multiple players detected', async () => {
    const user = userEvent.setup();
    render(<ManualPlayerEntry onPlayersAdded={mockOnPlayersAdded} />);

    const input = screen.getByTestId('player-entry-input');

    await act(async () => {
      await user.type(input, 'John, Jane, Bob');
    });

    expect(screen.getByText(/Detected 3 players/)).toBeInTheDocument();
  });

  it('opens image upload modal when camera button is clicked', async () => {
    const user = userEvent.setup();
    render(<ManualPlayerEntry onPlayersAdded={mockOnPlayersAdded} />);

    expect(screen.queryByTestId('mock-image-upload-modal')).not.toBeInTheDocument();

    await act(async () => {
      await user.click(screen.getByTestId('open-image-modal-button'));
    });

    expect(screen.getByTestId('mock-image-upload-modal')).toBeInTheDocument();
  });

  it('closes image upload modal', async () => {
    const user = userEvent.setup();
    render(<ManualPlayerEntry onPlayersAdded={mockOnPlayersAdded} />);

    await act(async () => {
      await user.click(screen.getByTestId('open-image-modal-button'));
    });

    expect(screen.getByTestId('mock-image-upload-modal')).toBeInTheDocument();

    await act(async () => {
      await user.click(screen.getByTestId('close-modal'));
    });

    expect(screen.queryByTestId('mock-image-upload-modal')).not.toBeInTheDocument();
  });

  it('adds players from image upload modal', async () => {
    const user = userEvent.setup();
    render(<ManualPlayerEntry onPlayersAdded={mockOnPlayersAdded} />);

    await act(async () => {
      await user.click(screen.getByTestId('open-image-modal-button'));
    });

    await act(async () => {
      await user.click(screen.getByTestId('add-from-modal'));
    });

    expect(mockOnPlayersAdded).toHaveBeenCalledWith(['Player1', 'Player2']);
  });

  it('updates button text based on player count', async () => {
    const user = userEvent.setup();
    render(<ManualPlayerEntry onPlayersAdded={mockOnPlayersAdded} />);

    const input = screen.getByTestId('player-entry-input');

    // Single player
    await act(async () => {
      await user.type(input, 'John');
    });
    expect(screen.getByTestId('add-player-button')).toHaveTextContent('Add Player');

    // Clear and add multiple
    await act(async () => {
      await user.clear(input);
      await user.type(input, 'John, Jane, Bob');
    });
    expect(screen.getByTestId('add-player-button')).toHaveTextContent('Add 3 Players');
  });
});
