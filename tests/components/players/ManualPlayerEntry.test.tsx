import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ManualPlayerEntry from '../../../src/components/players/ManualPlayerEntry';

vi.mock('../../../src/components/modals/ImageUploadModal', () => ({
  default: ({ isOpen, onClose, onPlayersAdded }: {
    isOpen: boolean;
    onClose: () => void;
    onPlayersAdded: (players: string[]) => void
  }) => (
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

  function setup() {
    const user = userEvent.setup();
    render(<ManualPlayerEntry onPlayersAdded={mockOnPlayersAdded} />);
    const input = screen.getByTestId('player-entry-input');
    const button = screen.getByTestId('add-player-button');
    return { user, input, button };
  }

  it('renders player entry form with input, camera button, and add button', () => {
    setup();

    expect(screen.getByTestId('player-entry-input')).toBeInTheDocument();
    expect(screen.getByTestId('open-image-modal-button')).toBeInTheDocument();
    expect(screen.getByTestId('add-player-button')).toBeInTheDocument();
  });

  it('add button is disabled when input is empty', () => {
    const { button } = setup();

    expect(button).toBeDisabled();
  });

  it('adds a single player correctly', async () => {
    const { user, input, button } = setup();

    await act(async () => {
      await user.type(input, 'John Doe');
      await user.click(button);
    });

    expect(mockOnPlayersAdded).toHaveBeenCalledWith(['John Doe']);
    expect(input).toHaveValue('');
  });

  it('adds multiple players with comma separation', async () => {
    const { user, input, button } = setup();

    await act(async () => {
      await user.type(input, 'John Doe, Jane Smith, Mike Johnson');
      await user.click(button);
    });

    expect(mockOnPlayersAdded).toHaveBeenCalledWith(['John Doe', 'Jane Smith', 'Mike Johnson']);
    expect(input).toHaveValue('');
  });

  it('adds multiple players with backtick separation', async () => {
    const { user, input, button } = setup();

    await act(async () => {
      await user.type(input, 'John Doe`Jane Smith`Mike Johnson');
      await user.click(button);
    });

    expect(mockOnPlayersAdded).toHaveBeenCalledWith(['John Doe', 'Jane Smith', 'Mike Johnson']);
  });

  it('filters out empty entries', async () => {
    const { user, input, button } = setup();

    await act(async () => {
      await user.type(input, 'John Doe,, Jane Smith,   ,Mike Johnson,');
      await user.click(button);
    });

    expect(mockOnPlayersAdded).toHaveBeenCalledWith(['John Doe', 'Jane Smith', 'Mike Johnson']);
  });

  it('trims whitespace from names', async () => {
    const { user, input, button } = setup();

    await act(async () => {
      await user.type(input, '  John Doe  ,  Jane Smith  ');
      await user.click(button);
    });

    expect(mockOnPlayersAdded).toHaveBeenCalledWith(['John Doe', 'Jane Smith']);
  });

  it('does not add empty/whitespace only input', async () => {
    const { user, input, button } = setup();

    await act(async () => {
      await user.type(input, '   ');
    });

    expect(button).toBeDisabled();
  });

  it('shows multi-input hint when multiple players detected', async () => {
    const { user, input } = setup();

    await act(async () => {
      await user.type(input, 'John, Jane, Bob');
    });

    expect(screen.getByText(/Detected 3 players/)).toBeInTheDocument();
  });

  it('opens image upload modal when camera button is clicked', async () => {
    const { user } = setup();

    expect(screen.queryByTestId('mock-image-upload-modal')).not.toBeInTheDocument();

    await act(async () => {
      await user.click(screen.getByTestId('open-image-modal-button'));
    });

    expect(screen.getByTestId('mock-image-upload-modal')).toBeInTheDocument();
  });

  it('closes image upload modal', async () => {
    const { user } = setup();

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
    const { user } = setup();

    await act(async () => {
      await user.click(screen.getByTestId('open-image-modal-button'));
    });

    await act(async () => {
      await user.click(screen.getByTestId('add-from-modal'));
    });

    expect(mockOnPlayersAdded).toHaveBeenCalledWith(['Player1', 'Player2']);
  });

  it('updates button text based on player count', async () => {
    const { user, input, button } = setup();

    await act(async () => {
      await user.type(input, 'John');
    });
    expect(button).toHaveTextContent('Add Player');

    await act(async () => {
      await user.clear(input);
      await user.type(input, 'John, Jane, Bob');
    });
    expect(button).toHaveTextContent('Add 3 Players');
  });
});
