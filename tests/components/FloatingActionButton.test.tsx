import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import FloatingActionButton from '../../src/components/FloatingActionButton';

describe('FloatingActionButton Component', () => {
  const mockOnClick = vi.fn();

  const defaultProps = {
    onClick: mockOnClick,
    hasCollapsedSteps: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render when hasCollapsedSteps is true', () => {
      render(<FloatingActionButton {...defaultProps} />);

      const button = screen.getByRole('button', { name: 'Show collapsed steps and quick actions' });
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass('floating-action-btn');
    });

    it('should not render when hasCollapsedSteps is false', () => {
      render(
        <FloatingActionButton
          {...defaultProps}
          hasCollapsedSteps={false}
        />,
      );

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('should display the menu icon', () => {
      render(<FloatingActionButton {...defaultProps} />);

      const icon = screen.getByText('☰');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('fab-icon');
    });
  });

  describe('User Interactions', () => {
    const user = userEvent.setup();

    it('should call onClick when button is clicked', async () => {
      render(<FloatingActionButton {...defaultProps} />);

      const button = screen.getByRole('button', { name: 'Show collapsed steps and quick actions' });
      await user.click(button);

      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('should call onClick when activated with keyboard', async () => {
      render(<FloatingActionButton {...defaultProps} />);

      const button = screen.getByRole('button', { name: 'Show collapsed steps and quick actions' });
      button.focus();
      await user.keyboard('{Enter}');

      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('should call onClick when activated with space', async () => {
      render(<FloatingActionButton {...defaultProps} />);

      const button = screen.getByRole('button', { name: 'Show collapsed steps and quick actions' });
      button.focus();
      await user.keyboard(' ');

      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA label', () => {
      render(<FloatingActionButton {...defaultProps} />);

      const button = screen.getByRole('button', { name: 'Show collapsed steps and quick actions' });
      expect(button).toHaveAttribute('aria-label', 'Show collapsed steps and quick actions');
    });

    it('should be focusable', () => {
      render(<FloatingActionButton {...defaultProps} />);

      const button = screen.getByRole('button', { name: 'Show collapsed steps and quick actions' });
      expect(button).toBeVisible();
      expect(button).not.toHaveAttribute('disabled');
    });
  });

  describe('Conditional Rendering Logic', () => {
    it('should return null when hasCollapsedSteps is false', () => {
      const { container } = render(
        <FloatingActionButton
          onClick={mockOnClick}
          hasCollapsedSteps={false}
        />,
      );

      expect(container.firstChild).toBeNull();
    });

    it('should toggle visibility based on hasCollapsedSteps prop changes', () => {
      const { rerender } = render(<FloatingActionButton {...defaultProps} />);

      expect(screen.getByRole('button')).toBeInTheDocument();

      rerender(
        <FloatingActionButton
          onClick={mockOnClick}
          hasCollapsedSteps={false}
        />,
      );

      expect(screen.queryByRole('button')).not.toBeInTheDocument();

      rerender(<FloatingActionButton {...defaultProps} />);

      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });
});
