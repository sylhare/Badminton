import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import ConfirmModal from '../../src/components/ConfirmModal';

describe('ConfirmModal Component', () => {
  const mockOnConfirm = vi.fn();
  const mockOnCancel = vi.fn();

  const defaultProps = {
    isOpen: true,
    title: 'Test Title',
    message: 'Test message content',
    onConfirm: mockOnConfirm,
    onCancel: mockOnCancel,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should not render when isOpen is false', () => {
      render(
        <ConfirmModal
          {...defaultProps}
          isOpen={false}
        />
      );

      expect(screen.queryByText('Test Title')).not.toBeInTheDocument();
      expect(screen.queryByText('Test message content')).not.toBeInTheDocument();
    });

    it('should render all elements when isOpen is true', () => {
      render(<ConfirmModal {...defaultProps} />);

      expect(screen.getByText('Test Title')).toBeInTheDocument();
      expect(screen.getByText('Test message content')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('should render with custom button text', () => {
      render(
        <ConfirmModal
          {...defaultProps}
          confirmText="Delete"
          cancelText="Keep"
        />
      );

      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Keep' })).toBeInTheDocument();
    });

    it('should apply destructive styling when isDestructive is true', () => {
      render(
        <ConfirmModal
          {...defaultProps}
          isDestructive={true}
        />
      );

      const confirmButton = screen.getByRole('button', { name: 'Confirm' });
      expect(confirmButton).toHaveClass('button-danger');
    });

    it('should apply primary styling when isDestructive is false', () => {
      render(
        <ConfirmModal
          {...defaultProps}
          isDestructive={false}
        />
      );

      const confirmButton = screen.getByRole('button', { name: 'Confirm' });
      expect(confirmButton).toHaveClass('button-primary');
    });

    it('should apply primary styling by default', () => {
      render(<ConfirmModal {...defaultProps} />);

      const confirmButton = screen.getByRole('button', { name: 'Confirm' });
      expect(confirmButton).toHaveClass('button-primary');
    });
  });

  describe('User Interactions', () => {
    const user = userEvent.setup();

    it('should call onConfirm when confirm button is clicked', async () => {
      render(<ConfirmModal {...defaultProps} />);

      const confirmButton = screen.getByRole('button', { name: 'Confirm' });
      await user.click(confirmButton);

      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
      expect(mockOnCancel).not.toHaveBeenCalled();
    });

    it('should call onCancel when cancel button is clicked', async () => {
      render(<ConfirmModal {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await user.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    it('should call onCancel when close button is clicked', async () => {
      render(<ConfirmModal {...defaultProps} />);

      const closeButton = screen.getByRole('button', { name: '' }); // Close button has no text, just an icon
      await user.click(closeButton);

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    it('should call onCancel when overlay is clicked', () => {
      render(<ConfirmModal {...defaultProps} />);

      const overlay = document.querySelector('.modal-overlay');
      expect(overlay).toBeInTheDocument();
      
      fireEvent.click(overlay!);

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    it('should not call onCancel when modal content is clicked', () => {
      render(<ConfirmModal {...defaultProps} />);

      const modalContent = document.querySelector('.modal-content');
      expect(modalContent).toBeInTheDocument();
      
      fireEvent.click(modalContent!);

      expect(mockOnCancel).not.toHaveBeenCalled();
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA structure', () => {
      render(<ConfirmModal {...defaultProps} />);

      // Check that buttons have proper roles
      expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      
      // Check heading structure
      expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Test Title');
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<ConfirmModal {...defaultProps} />);

      // First tab goes to the close button (X)
      await user.tab();
      const closeButton = screen.getAllByRole('button').find(button => 
        button.innerHTML.includes('svg') && !button.textContent?.trim()
      );
      expect(closeButton).toHaveFocus();

      // Second tab goes to Cancel button
      await user.tab();
      expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();

      // Third tab goes to Confirm button
      await user.tab();
      expect(screen.getByRole('button', { name: 'Confirm' })).toHaveFocus();

      // Enter should trigger the focused button
      await user.keyboard('{Enter}');
      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    });
  });

  describe('Event Propagation', () => {
    it('should stop propagation when clicking modal content', () => {
      const overlayClickHandler = vi.fn();
      render(
        <div onClick={overlayClickHandler}>
          <ConfirmModal {...defaultProps} />
        </div>
      );

      const modalContent = document.querySelector('.modal-content');
      expect(modalContent).toBeInTheDocument();
      
      fireEvent.click(modalContent!);

      // The parent click handler should not be called because event propagation is stopped
      expect(overlayClickHandler).not.toHaveBeenCalled();
    });
  });
});
