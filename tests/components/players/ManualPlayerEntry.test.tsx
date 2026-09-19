import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ManualPlayerEntry from '../../../src/components/players/ManualPlayerEntry';
import { useImageOcr } from '../../../src/hooks/useImageOcr';

vi.mock('../../../src/hooks/useImageOcr', () => ({
  useImageOcr: vi.fn(() => ({
    isProcessing: false,
    progress: 0,
    processImage: vi.fn(),
  })),
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

    expect(screen.queryByTestId('image-upload-modal')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('open-image-modal-button'));

    expect(await screen.findByTestId('image-upload-modal')).toBeInTheDocument();
    expect(screen.getByText('📸 Import Players from Image')).toBeInTheDocument();
  });

  it('closes image upload modal', async () => {
    const { user } = setup();

    await user.click(screen.getByTestId('open-image-modal-button'));

    expect(await screen.findByTestId('image-upload-modal')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.queryByTestId('image-upload-modal')).not.toBeInTheDocument();
  });

  it('adds players from image upload modal', async () => {
    let onPlayersExtracted: ((players: string[]) => void) | undefined;
    vi.mocked(useImageOcr).mockImplementation(({ onPlayersExtracted: callback }) => {
      onPlayersExtracted = callback;
      return { isProcessing: false, progress: 0, processImage: vi.fn() };
    });
    const { user } = setup();

    await user.click(screen.getByTestId('open-image-modal-button'));
    await screen.findByTestId('image-upload-modal');

    await act(async () => onPlayersExtracted!(['Player1', 'Player2']));

    expect(screen.getByTestId('extracted-player-0')).toBeChecked();
    expect(screen.getByTestId('extracted-player-1')).toBeChecked();

    await user.click(screen.getByTestId('add-extracted-players-button'));

    expect(mockOnPlayersAdded).toHaveBeenCalledWith(['Player1', 'Player2']);
    expect(screen.queryByTestId('image-upload-modal')).not.toBeInTheDocument();
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
