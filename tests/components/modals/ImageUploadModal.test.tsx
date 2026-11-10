import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ImageUploadModal from '../../../src/components/modals/ImageUploadModal';
import { useImageOcr } from '../../../src/hooks/useImageOcr';

vi.mock('../../../src/hooks/useImageOcr', () => ({
  useImageOcr: vi.fn(() => ({
    isSupported: true,
    isProcessing: false,
    progress: 0,
    processImage: vi.fn(),
  })),
}));

vi.mock('../../../src/hooks/useDragAndDrop', () => ({
  useDragAndDrop: vi.fn(({ onFileDropped }) => ({
    isDragOver: false,
    handleDrop: (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (file) onFileDropped(file);
    },
    handleDragOver: vi.fn((e: React.DragEvent) => e.preventDefault()),
    handleDragLeave: vi.fn(),
  })),
}));

vi.mock('../../../src/hooks/useAnalytics', () => ({
  useAnalytics: () => ({
    trackPlayerAction: vi.fn(),
  }),
}));

describe('ImageUploadModal', () => {
  const mockOnClose = vi.fn();
  const mockOnPlayersAdded = vi.fn();
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  const renderModal = (isOpen = true) => {
    return render(
      <ImageUploadModal
        isOpen={isOpen}
        onClose={mockOnClose}
        onPlayersAdded={mockOnPlayersAdded}
      />,
    );
  };

  /** Renders the modal and simulates OCR extraction of the given player names. */
  const renderWithExtractedPlayers = async (players: string[]) => {
    let extractionCallback: ((players: string[]) => void) | undefined;

    vi.mocked(useImageOcr).mockImplementation(({ onPlayersExtracted }) => {
      extractionCallback = onPlayersExtracted;
      return {
        isSupported: true,
        isProcessing: false,
        progress: 0,
        processImage: vi.fn(),
      };
    });

    const result = renderModal();

    await act(async () => {
      extractionCallback!(players);
    });

    return result;
  };

  describe('Modal visibility', () => {
    it('should not render when isOpen is false', () => {
      renderModal(false);
      expect(screen.queryByTestId('image-upload-modal')).not.toBeInTheDocument();
    });

    it('should render when isOpen is true', () => {
      renderModal(true);
      expect(screen.getByTestId('image-upload-modal')).toBeInTheDocument();
    });

    it('should display the modal header with title', () => {
      renderModal();
      expect(screen.getByText('📸 Import Players from Image')).toBeInTheDocument();
    });

    it('should have a close button', () => {
      renderModal();
      const closeButton = screen.getByRole('button', { name: 'Close' });
      expect(closeButton).toHaveClass('modal-close');
    });
  });

  describe('Upload area', () => {
    it('should display upload instructions', () => {
      renderModal();
      expect(screen.getByText(/Take a photo or upload an image/)).toBeInTheDocument();
      expect(screen.getByText(/Drag and drop, or click to select/)).toBeInTheDocument();
    });

    it('should have a file input for image selection', () => {
      renderModal();
      const fileInput = screen.getByTestId('image-file-input');
      expect(fileInput).toBeInTheDocument();
      expect(fileInput).toHaveAttribute('accept', 'image/*');
      expect(fileInput).toHaveAttribute('capture', 'environment');
    });

    it('should have a Choose Image button', () => {
      renderModal();
      expect(screen.getByText('Choose Image')).toBeInTheDocument();
    });
  });

  describe('Close functionality', () => {
    it('should call onClose when clicking the overlay', async () => {
      renderModal();
      const overlay = screen.getByTestId('image-upload-modal');
      await user.click(overlay);
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should call onClose when clicking the close button', async () => {
      renderModal();
      const closeButton = screen.getByRole('button', { name: 'Close' });
      await user.click(closeButton);
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should not close when clicking inside modal content', async () => {
      renderModal();
      const modalContent = screen.getByText('📸 Import Players from Image');
      await user.click(modalContent);
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('Unsupported OCR state', () => {
    it('should display fallback state when isSupported is false', () => {
      vi.mocked(useImageOcr).mockReturnValue({
        isSupported: false,
        isProcessing: false,
        progress: 0,
        processImage: vi.fn(),
      });

      renderModal();

      expect(screen.getByTestId('ocr-not-supported')).toBeInTheDocument();
      expect(screen.getByText('Text Recognition Not Available')).toBeInTheDocument();
      expect(screen.getByTestId('enter-manually-button')).toBeInTheDocument();
    });

    it('should call onClose when clicking enter players manually button', async () => {
      vi.mocked(useImageOcr).mockReturnValue({
        isSupported: false,
        isProcessing: false,
        progress: 0,
        processImage: vi.fn(),
      });

      renderModal();

      await user.click(screen.getByTestId('enter-manually-button'));
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Processing state', () => {
    it('should display processing indicator when processing image', () => {
      vi.mocked(useImageOcr).mockReturnValue({
        isSupported: true,
        isProcessing: true,
        progress: 0.5,
        processImage: vi.fn(),
      });

      renderModal();

      expect(screen.getByText(/Processing image and extracting player names/)).toBeInTheDocument();
      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('should show progress bar during processing', () => {
      vi.mocked(useImageOcr).mockReturnValue({
        isSupported: true,
        isProcessing: true,
        progress: 0.75,
        processImage: vi.fn(),
      });

      renderModal();

      const progressBar = document.querySelector('.progress-bar') as HTMLElement;
      expect(progressBar).toBeInTheDocument();
      expect(progressBar.style.width).toBe('75%');
    });
  });

  describe('Extracted players list', () => {
    it('should display count of extracted players', async () => {
      await renderWithExtractedPlayers(['Alice', 'Bob']);

      await waitFor(() => {
        expect(screen.getByText(/Found/)).toBeInTheDocument();
      });
    });

    it('should have select all and deselect all buttons', async () => {
      await renderWithExtractedPlayers(['Alice', 'Bob']);

      await waitFor(() => {
        expect(screen.getByText('Select all')).toBeInTheDocument();
        expect(screen.getByText('Deselect all')).toBeInTheDocument();
      });
    });

    it('should keep the file input mounted so "Try another image" can open the picker', async () => {
      await renderWithExtractedPlayers(['Alice', 'Bob']);

      await waitFor(() => {
        expect(screen.getByText('📸 Try another image')).toBeInTheDocument();
      });
      expect(screen.getByTestId('image-file-input')).toBeInTheDocument();
    });

    it('should have a try another image button when players are extracted', async () => {
      await renderWithExtractedPlayers(['Alice']);

      await waitFor(() => {
        expect(screen.getByText('📸 Try another image')).toBeInTheDocument();
      });
    });

    it('should toggle player selection when clicking player checkbox', async () => {
      await renderWithExtractedPlayers(['Alice', 'Bob']);

      await waitFor(() => {
        expect(screen.getByTestId('extracted-player-0')).toBeChecked();
      });

      await user.click(screen.getByTestId('extracted-player-0'));
      expect(screen.getByTestId('extracted-player-0')).not.toBeChecked();
      expect(screen.getByTestId('add-extracted-players-button')).toHaveTextContent('Add 1 Player');

      await user.click(screen.getByTestId('extracted-player-0'));
      expect(screen.getByTestId('extracted-player-0')).toBeChecked();
      expect(screen.getByTestId('add-extracted-players-button')).toHaveTextContent('Add 2 Players');
    });

    it('should deselect all and select all players', async () => {
      await renderWithExtractedPlayers(['Alice', 'Bob']);

      await waitFor(() => {
        expect(screen.getByText('Deselect all')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Deselect all'));
      expect(screen.getByTestId('extracted-player-0')).not.toBeChecked();
      expect(screen.getByTestId('extracted-player-1')).not.toBeChecked();
      expect(screen.getByTestId('add-extracted-players-button')).toBeDisabled();

      await user.click(screen.getByText('Select all'));
      expect(screen.getByTestId('extracted-player-0')).toBeChecked();
      expect(screen.getByTestId('extracted-player-1')).toBeChecked();
      expect(screen.getByTestId('add-extracted-players-button')).toBeEnabled();
    });
  });

  describe('Add players functionality', () => {
    it('should have an add players button when players are extracted', async () => {
      await renderWithExtractedPlayers(['Alice', 'Bob']);

      await waitFor(() => {
        expect(screen.getByTestId('add-extracted-players-button')).toBeInTheDocument();
      });
    });

    it('should call onPlayersAdded when clicking add button with selected players', async () => {
      await renderWithExtractedPlayers(['Alice', 'Bob']);

      await waitFor(() => {
        expect(screen.getByTestId('add-extracted-players-button')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('add-extracted-players-button'));

      expect(mockOnPlayersAdded).toHaveBeenCalledWith(expect.arrayContaining(['Alice', 'Bob']));
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should have cancel button in footer', async () => {
      await renderWithExtractedPlayers(['Alice']);

      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Cancel'));
      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});
