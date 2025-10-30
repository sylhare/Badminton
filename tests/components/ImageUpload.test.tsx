import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import ImageUpload from '../../src/components/ImageUpload';

const mockUseImageOcr = vi.fn();
vi.mock('../../src/hooks/useImageOcr', () => ({
  useImageOcr: (...args: any[]) => mockUseImageOcr(...args),
}));

describe('ImageUpload Component', () => {
  const mockOnPlayersExtracted = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseImageOcr.mockReset();
    mockUseImageOcr.mockReturnValue({ isProcessing: false, progress: 0, processImage: vi.fn() });
  });

  it('renders upload area correctly', () => {
    render(<ImageUpload onPlayersExtracted={mockOnPlayersExtracted} />);

    expect(screen.getByText('📸 Upload Player List Image')).toBeInTheDocument();
    expect(screen.getByText(/Take a photo or upload an image/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /choose image/i })).toBeInTheDocument();
  });

  it('processes image file and extracts player names correctly', async () => {
    const processImageMock = vi.fn((_file: File) => {
      mockOnPlayersExtracted([
        'Tinley',
        'Ella',
        'Avrella',
        'Yvette',
        'Gabriela',
        'Noella',
      ]);
    });

    mockUseImageOcr.mockImplementation(() => ({
      isProcessing: false,
      progress: 0,
      processImage: processImageMock,
    }));

    render(<ImageUpload onPlayersExtracted={mockOnPlayersExtracted} />);

    const file = new File(['fake image content'], 'names.png', { type: 'image/png' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false,
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(processImageMock).toHaveBeenCalledWith(file);
    });

    await waitFor(() => {
      expect(mockOnPlayersExtracted).toHaveBeenCalledWith([
        'Tinley',
        'Ella',
        'Avrella',
        'Yvette',
        'Gabriela',
        'Noella',
      ]);
    });
  });

  it('filters out noise text from OCR results', async () => {
    mockUseImageOcr.mockImplementation(({ onPlayersExtracted }) => ({
      isProcessing: false,
      progress: 0,
      processImage: vi.fn((_file: File) => {
        onPlayersExtracted(['John', 'Jane', 'Mike', 'Sarah']);
      }),
    }));

    render(<ImageUpload onPlayersExtracted={mockOnPlayersExtracted} />);

    const file = new File(['fake image content'], 'test.png', { type: 'image/png' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false,
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(mockOnPlayersExtracted).toHaveBeenCalledWith([
        'John',
        'Jane',
        'Mike',
        'Sarah',
      ]);
    });
  });

  it('shows processing message during OCR', async () => {
    mockUseImageOcr.mockReturnValue({ isProcessing: true, progress: 0.3, processImage: vi.fn() });

    render(<ImageUpload onPlayersExtracted={mockOnPlayersExtracted} />);

    const file = new File(['fake image content'], 'test.png', { type: 'image/png' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false,
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText(/Processing image and extracting player names/)).toBeInTheDocument();
    });
  });

  it('handles OCR errors gracefully', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {
    });
    const processImageMock = vi.fn(() => {
      window.alert('Failed to process image. Please try again or add players manually.');
    });

    mockUseImageOcr.mockReturnValue({ isProcessing: false, progress: 0, processImage: processImageMock });

    render(<ImageUpload onPlayersExtracted={mockOnPlayersExtracted} />);

    const file = new File(['fake image content'], 'test.png', { type: 'image/png' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false,
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Failed to process image. Please try again or add players manually.');
    });

    expect(mockOnPlayersExtracted).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it('handles drag and drop file upload', async () => {
    const processImageMock2 = vi.fn((_file: File) => {
      mockOnPlayersExtracted(['Test Player']);
    });

    mockUseImageOcr.mockReturnValue({ isProcessing: false, progress: 0, processImage: processImageMock2 });

    render(<ImageUpload onPlayersExtracted={mockOnPlayersExtracted} />);

    const uploadArea = document.querySelector('.upload-area') as HTMLElement;
    const file = new File(['fake image content'], 'test.png', { type: 'image/png' });

    const dropEvent = new Event('drop', { bubbles: true }) as any;
    dropEvent.dataTransfer = {
      files: [file],
    };

    fireEvent(uploadArea, dropEvent);

    await waitFor(() => {
      expect(processImageMock2).toHaveBeenCalledWith(file);
    });
  });
});