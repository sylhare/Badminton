import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import PlayerRemovalModal from '../../src/components/PlayerRemovalModal';

describe('PlayerRemovalModal Component', () => {
  const mockOnRemove = vi.fn();
  const mockOnMarkAbsent = vi.fn();
  const mockOnCancel = vi.fn();

  const defaultProps = {
    isOpen: true,
    playerName: 'John Doe',
    onRemove: mockOnRemove,
    onMarkAbsent: mockOnMarkAbsent,
    onCancel: mockOnCancel,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should not render when isOpen is false', () => {
      render(
        <PlayerRemovalModal
          {...defaultProps}
          isOpen={false}
        />,
      );

      expect(screen.queryByText('Remove Player')).not.toBeInTheDocument();
      expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
    });

    it('should render all elements when isOpen is true', () => {
      render(<PlayerRemovalModal {...defaultProps} />);

      expect(screen.getByRole('heading', { name: 'Remove Player' })).toBeInTheDocument();
      expect(screen.getByText(/John Doe/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Remove Player/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Mark as Absent/i })).toBeInTheDocument();
    });

    it('should render the X close button', () => {
      render(<PlayerRemovalModal {...defaultProps} />);

      const closeButton = screen.getByTestId('player-removal-modal-close');
      expect(closeButton).toBeInTheDocument();
    });

    it('should display the player name in the message', () => {
      render(<PlayerRemovalModal {...defaultProps} playerName="Alice Smith" />);

      expect(screen.getByText(/Alice Smith/)).toBeInTheDocument();
    });

    it('should have correct button styling', () => {
      render(<PlayerRemovalModal {...defaultProps} />);

      const removeButton = screen.getByTestId('player-removal-modal-remove');
      const absentButton = screen.getByTestId('player-removal-modal-absent');

      expect(removeButton).toHaveClass('button-danger');
      expect(absentButton).toHaveClass('button-absent');
    });
  });

  describe('User Interactions', () => {
    const user = userEvent.setup();

    it('should call onRemove when Remove Player button is clicked', async () => {
      render(<PlayerRemovalModal {...defaultProps} />);

      const removeButton = screen.getByTestId('player-removal-modal-remove');
      await user.click(removeButton);

      expect(mockOnRemove).toHaveBeenCalledTimes(1);
      expect(mockOnMarkAbsent).not.toHaveBeenCalled();
      expect(mockOnCancel).not.toHaveBeenCalled();
    });

    it('should call onMarkAbsent when Mark as Absent button is clicked', async () => {
      render(<PlayerRemovalModal {...defaultProps} />);

      const absentButton = screen.getByTestId('player-removal-modal-absent');
      await user.click(absentButton);

      expect(mockOnMarkAbsent).toHaveBeenCalledTimes(1);
      expect(mockOnRemove).not.toHaveBeenCalled();
      expect(mockOnCancel).not.toHaveBeenCalled();
    });

    it('should call onCancel when X close button is clicked', async () => {
      render(<PlayerRemovalModal {...defaultProps} />);

      const closeButton = screen.getByTestId('player-removal-modal-close');
      await user.click(closeButton);

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
      expect(mockOnRemove).not.toHaveBeenCalled();
      expect(mockOnMarkAbsent).not.toHaveBeenCalled();
    });

    it('should call onCancel when overlay is clicked', () => {
      render(<PlayerRemovalModal {...defaultProps} />);

      const overlay = screen.getByTestId('player-removal-modal');
      fireEvent.click(overlay);

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
      expect(mockOnRemove).not.toHaveBeenCalled();
      expect(mockOnMarkAbsent).not.toHaveBeenCalled();
    });

    it('should not call any handler when modal content is clicked', () => {
      render(<PlayerRemovalModal {...defaultProps} />);

      const modalContent = document.querySelector('.modal-content');
      expect(modalContent).toBeInTheDocument();

      fireEvent.click(modalContent!);

      expect(mockOnCancel).not.toHaveBeenCalled();
      expect(mockOnRemove).not.toHaveBeenCalled();
      expect(mockOnMarkAbsent).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA structure', () => {
      render(<PlayerRemovalModal {...defaultProps} />);

      expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Remove Player');
      expect(screen.getByRole('button', { name: /Remove Player/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Mark as Absent/i })).toBeInTheDocument();
    });

    it('should have aria-label on close button', () => {
      render(<PlayerRemovalModal {...defaultProps} />);

      const closeButton = screen.getByTestId('player-removal-modal-close');
      expect(closeButton).toHaveAttribute('aria-label', 'Close');
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<PlayerRemovalModal {...defaultProps} />);

      await user.tab();
      expect(screen.getByTestId('player-removal-modal-close')).toHaveFocus();

      await user.tab();
      expect(screen.getByTestId('player-removal-modal-absent')).toHaveFocus();

      await user.tab();
      expect(screen.getByTestId('player-removal-modal-remove')).toHaveFocus();
    });

    it('should trigger action with Enter key on Remove button', async () => {
      const user = userEvent.setup();
      render(<PlayerRemovalModal {...defaultProps} />);

      const removeButton = screen.getByTestId('player-removal-modal-remove');
      removeButton.focus();
      await user.keyboard('{Enter}');

      expect(mockOnRemove).toHaveBeenCalledTimes(1);
    });

    it('should trigger action with Enter key on Mark as Absent button', async () => {
      const user = userEvent.setup();
      render(<PlayerRemovalModal {...defaultProps} />);

      const absentButton = screen.getByTestId('player-removal-modal-absent');
      absentButton.focus();
      await user.keyboard('{Enter}');

      expect(mockOnMarkAbsent).toHaveBeenCalledTimes(1);
    });
  });

  describe('Event Propagation', () => {
    it('should stop propagation when clicking modal content', () => {
      const overlayClickHandler = vi.fn();
      render(
        <div onClick={overlayClickHandler}>
          <PlayerRemovalModal {...defaultProps} />
        </div>,
      );

      const modalContent = document.querySelector('.modal-content');
      expect(modalContent).toBeInTheDocument();

      fireEvent.click(modalContent!);

      expect(overlayClickHandler).not.toHaveBeenCalled();
    });
  });
});
