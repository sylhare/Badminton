import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import ImageUploadModal from '../../src/components/ImageUploadModal';
import { createMockFile, createMockFileList, createMockDragEvent, MOCK_FILES } from '../data/testFactories';

vi.mock('../../src/hooks/useImageOcr', () => ({
  useImageOcr: vi.fn(() => ({
    isProcessing: false,
    progress: 0,
    processImage: vi.fn(),
  })),
}));

vi.mock('../../src/hooks/useDragAndDrop', () => ({
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

vi.mock('../../src/hooks/useAnalytics', () => ({
  useAnalytics: () => ({
    trackPlayerAction: vi.fn(),
  }),
}));

import { useImageOcr } from '../../src/hooks/useImageOcr';

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
      const closeButton = screen.getByRole('button', { name: '' });
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
      const closeButton = screen.getByRole('button', { name: '' });
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

  describe('Processing state', () => {
    it('should display processing indicator when processing image', () => {
      vi.mocked(useImageOcr).mockReturnValue({
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
    const setupWithExtractedPlayers = () => {
      const mockProcessImage = vi.fn();
      let extractionCallback: ((players: string[]) => void) | undefined;

      vi.mocked(useImageOcr).mockImplementation(({ onPlayersExtracted }) => {
        extractionCallback = onPlayersExtracted;
        return {
          isProcessing: false,
          progress: 0,
          processImage: mockProcessImage,
        };
      });

      const { rerender } = renderModal();

      if (extractionCallback) {
        extractionCallback(['Alice', 'Bob', 'Charlie']);
      }

      rerender(
        <ImageUploadModal
          isOpen={true}
          onClose={mockOnClose}
          onPlayersAdded={mockOnPlayersAdded}
        />,
      );

      return { mockProcessImage, rerender };
    };

    it('should display count of extracted players', async () => {
      let extractionCallback: ((players: string[]) => void) | undefined;

      vi.mocked(useImageOcr).mockImplementation(({ onPlayersExtracted }) => {
        extractionCallback = onPlayersExtracted;
        return {
          isProcessing: false,
          progress: 0,
          processImage: vi.fn(),
        };
      });

      const { rerender } = renderModal();

      if (extractionCallback) {
        extractionCallback(['Alice', 'Bob']);
      }

      rerender(
        <ImageUploadModal
          isOpen={true}
          onClose={mockOnClose}
          onPlayersAdded={mockOnPlayersAdded}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText(/Found/)).toBeInTheDocument();
      });
    });

    it('should have select all and deselect all buttons', async () => {
      let extractionCallback: ((players: string[]) => void) | undefined;

      vi.mocked(useImageOcr).mockImplementation(({ onPlayersExtracted }) => {
        extractionCallback = onPlayersExtracted;
        return {
          isProcessing: false,
          progress: 0,
          processImage: vi.fn(),
        };
      });

      const { rerender } = renderModal();

      if (extractionCallback) {
        extractionCallback(['Alice', 'Bob']);
      }

      rerender(
        <ImageUploadModal
          isOpen={true}
          onClose={mockOnClose}
          onPlayersAdded={mockOnPlayersAdded}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('Select all')).toBeInTheDocument();
        expect(screen.getByText('Deselect all')).toBeInTheDocument();
      });
    });

    it('should have a try another image button when players are extracted', async () => {
      let extractionCallback: ((players: string[]) => void) | undefined;

      vi.mocked(useImageOcr).mockImplementation(({ onPlayersExtracted }) => {
        extractionCallback = onPlayersExtracted;
        return {
          isProcessing: false,
          progress: 0,
          processImage: vi.fn(),
        };
      });

      const { rerender } = renderModal();

      if (extractionCallback) {
        extractionCallback(['Alice']);
      }

      rerender(
        <ImageUploadModal
          isOpen={true}
          onClose={mockOnClose}
          onPlayersAdded={mockOnPlayersAdded}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('📸 Try another image')).toBeInTheDocument();
      });
    });
  });

  describe('Add players functionality', () => {
    it('should have an add players button when players are extracted', async () => {
      let extractionCallback: ((players: string[]) => void) | undefined;

      vi.mocked(useImageOcr).mockImplementation(({ onPlayersExtracted }) => {
        extractionCallback = onPlayersExtracted;
        return {
          isProcessing: false,
          progress: 0,
          processImage: vi.fn(),
        };
      });

      const { rerender } = renderModal();

      if (extractionCallback) {
        extractionCallback(['Alice', 'Bob']);
      }

      rerender(
        <ImageUploadModal
          isOpen={true}
          onClose={mockOnClose}
          onPlayersAdded={mockOnPlayersAdded}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId('add-extracted-players-button')).toBeInTheDocument();
      });
    });

    it('should call onPlayersAdded when clicking add button with selected players', async () => {
      let extractionCallback: ((players: string[]) => void) | undefined;

      vi.mocked(useImageOcr).mockImplementation(({ onPlayersExtracted }) => {
        extractionCallback = onPlayersExtracted;
        return {
          isProcessing: false,
          progress: 0,
          processImage: vi.fn(),
        };
      });

      const { rerender } = renderModal();

      if (extractionCallback) {
        extractionCallback(['Alice', 'Bob']);
      }

      rerender(
        <ImageUploadModal
          isOpen={true}
          onClose={mockOnClose}
          onPlayersAdded={mockOnPlayersAdded}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId('add-extracted-players-button')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('add-extracted-players-button'));

      expect(mockOnPlayersAdded).toHaveBeenCalledWith(expect.arrayContaining(['Alice', 'Bob']));
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should have cancel button in footer', async () => {
      let extractionCallback: ((players: string[]) => void) | undefined;

      vi.mocked(useImageOcr).mockImplementation(({ onPlayersExtracted }) => {
        extractionCallback = onPlayersExtracted;
        return {
          isProcessing: false,
          progress: 0,
          processImage: vi.fn(),
        };
      });

      const { rerender } = renderModal();

      if (extractionCallback) {
        extractionCallback(['Alice']);
      }

      rerender(
        <ImageUploadModal
          isOpen={true}
          onClose={mockOnClose}
          onPlayersAdded={mockOnPlayersAdded}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Cancel'));
      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});
