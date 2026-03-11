import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ShareModal from '../../src/components/ShareModal';

describe('ShareModal Component', () => {
  const mockOnClose = vi.fn();

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    shareUrl: 'https://example.com/share?state=abc123',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  describe('Rendering', () => {
    it('should not render when isOpen is false', () => {
      render(<ShareModal {...defaultProps} isOpen={false} />);

      expect(screen.queryByTestId('share-modal')).not.toBeInTheDocument();
    });

    it('should render all elements when isOpen is true', () => {
      render(<ShareModal {...defaultProps} />);

      expect(screen.getByTestId('share-modal')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Share Session');
      expect(screen.getByTestId('share-url-input')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
      expect(screen.getByTestId('copy-share-url-button')).toHaveTextContent('Copy URL');
    });

    it('should display the share URL in the input', () => {
      render(<ShareModal {...defaultProps} />);

      const input = screen.getByTestId('share-url-input');
      expect(input).toHaveValue(defaultProps.shareUrl);
    });

    it('should render the input as read-only', () => {
      render(<ShareModal {...defaultProps} />);

      expect(screen.getByTestId('share-url-input')).toHaveAttribute('readonly');
    });
  });

  describe('User Interactions', () => {
    it('should call onClose when Close button is clicked', async () => {
      const user = userEvent.setup();
      render(<ShareModal {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: 'Close' }));

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when the X button is clicked', async () => {
      const user = userEvent.setup();
      render(<ShareModal {...defaultProps} />);

      const closeButton = screen.getByRole('button', { name: '' });
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when overlay is clicked', () => {
      render(<ShareModal {...defaultProps} />);

      fireEvent.click(screen.getByTestId('share-modal'));

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should not call onClose when modal content is clicked', () => {
      render(<ShareModal {...defaultProps} />);

      fireEvent.click(document.querySelector('.modal-content')!);

      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should copy share URL to clipboard when Copy URL is clicked', async () => {
      const user = userEvent.setup();
      render(<ShareModal {...defaultProps} />);

      await user.click(screen.getByTestId('copy-share-url-button'));

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(defaultProps.shareUrl);
    });

    it('should show "Copied!" after clicking Copy URL', async () => {
      const user = userEvent.setup();
      render(<ShareModal {...defaultProps} />);

      await user.click(screen.getByTestId('copy-share-url-button'));

      expect(screen.getByTestId('copy-share-url-button')).toHaveTextContent('Copied!');
    });

    it('should revert to "Copy URL" after 2 seconds', async () => {
      vi.useFakeTimers();
      render(<ShareModal {...defaultProps} />);

      fireEvent.click(screen.getByTestId('copy-share-url-button'));
      await act(async () => { await Promise.resolve(); });

      expect(screen.getByTestId('copy-share-url-button')).toHaveTextContent('Copied!');

      act(() => { vi.advanceTimersByTime(2000); });

      expect(screen.getByTestId('copy-share-url-button')).toHaveTextContent('Copy URL');
      vi.useRealTimers();
    });
  });
});
