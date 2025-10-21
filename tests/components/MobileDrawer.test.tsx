import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import MobileDrawer from '../../src/components/MobileDrawer';
import { StepDefinition } from '../../src/hooks/useStepRegistry';

describe('MobileDrawer Component', () => {
  const mockOnClose = vi.fn();
  const mockOnStepClick = vi.fn();

  const mockSteps: StepDefinition[] = [
    {
      id: 1,
      title: 'Step 1: Add Players',
      baseTitle: 'Add Players',
      isVisible: true,
      isCollapsed: true,
    },
    {
      id: 2,
      title: 'Step 2: Manage Players',
      baseTitle: 'Manage Players',
      isVisible: true,
      isCollapsed: true,
      actions: [
        {
          label: 'Clear All Players',
          icon: React.createElement('span', {}, '🗑️'),
          onClick: vi.fn(),
          isDestructive: true,
        },
        {
          label: 'Reset Algorithm',
          icon: React.createElement('span', {}, '🔄'),
          onClick: vi.fn(),
          isDestructive: false,
        },
      ],
    },
    {
      id: 3,
      title: 'Step 3: Court Settings',
      baseTitle: 'Court Settings',
      isVisible: true,
      isCollapsed: false, // Not collapsed - shouldn't show in drawer
    },
  ];

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    steps: mockSteps,
    onStepClick: mockOnStepClick,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should not render when isOpen is false', () => {
      render(
        <MobileDrawer
          {...defaultProps}
          isOpen={false}
        />,
      );

      expect(screen.queryByText('Quick Access')).not.toBeInTheDocument();
    });

    it('should render when isOpen is true', () => {
      render(<MobileDrawer {...defaultProps} />);

      expect(screen.getByText('Quick Access')).toBeInTheDocument();
      expect(screen.getByText('Collapsed Steps')).toBeInTheDocument();
      expect(screen.getByText('Quick Actions')).toBeInTheDocument();
    });

    it('should render only collapsed steps in the step list', () => {
      render(<MobileDrawer {...defaultProps} />);

      expect(screen.getByText('Add Players')).toBeInTheDocument();
      expect(screen.getByText('Manage Players')).toBeInTheDocument();
      expect(screen.queryByText('Court Settings')).not.toBeInTheDocument(); // Not collapsed
    });

    it('should render step buttons with icons', () => {
      render(<MobileDrawer {...defaultProps} />);

      const stepButtons = screen.getAllByText('📋');
      expect(stepButtons).toHaveLength(2); // Two collapsed steps
    });

    it('should render action buttons from all steps', () => {
      render(<MobileDrawer {...defaultProps} />);

      expect(screen.getByText('Clear All Players')).toBeInTheDocument();
      expect(screen.getByText('Reset Algorithm')).toBeInTheDocument();
      expect(screen.getByText('🗑️')).toBeInTheDocument();
      expect(screen.getByText('🔄')).toBeInTheDocument();
    });

    it('should apply destructive class to destructive actions', () => {
      render(<MobileDrawer {...defaultProps} />);

      const clearButton = screen.getByRole('button', { name: /Clear All Players/i });
      expect(clearButton).toHaveClass('destructive');

      const resetButton = screen.getByRole('button', { name: /Reset Algorithm/i });
      expect(resetButton).not.toHaveClass('destructive');
    });

    it('should render close button', () => {
      render(<MobileDrawer {...defaultProps} />);

      const closeButton = screen.getByRole('button', { name: 'Close drawer' });
      expect(closeButton).toBeInTheDocument();
      expect(screen.getByText('✕')).toBeInTheDocument();
    });

    it('should handle empty collapsed steps', () => {
      const stepsWithNoCollapsed = mockSteps.map(step => ({ ...step, isCollapsed: false }));

      render(
        <MobileDrawer
          {...defaultProps}
          steps={stepsWithNoCollapsed}
        />,
      );

      expect(screen.getByText('Collapsed Steps')).toBeInTheDocument();
      expect(screen.queryByText('Add Players')).not.toBeInTheDocument();
      expect(screen.queryByText('Manage Players')).not.toBeInTheDocument();
    });

    it('should handle steps with no actions', () => {
      const stepsWithNoActions = [
        {
          id: 1,
          title: 'Step 1: Add Players',
          baseTitle: 'Add Players',
          isVisible: true,
          isCollapsed: true,
        },
      ];

      render(
        <MobileDrawer
          {...defaultProps}
          steps={stepsWithNoActions}
        />,
      );

      expect(screen.getByText('Quick Actions')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Clear All Players/i })).not.toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    const user = userEvent.setup();

    it('should call onClose when close button is clicked', async () => {
      render(<MobileDrawer {...defaultProps} />);

      const closeButton = screen.getByRole('button', { name: 'Close drawer' });
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when backdrop is clicked', () => {
      render(<MobileDrawer {...defaultProps} />);

      const overlay = document.querySelector('.mobile-drawer-overlay');
      expect(overlay).toBeInTheDocument();

      fireEvent.click(overlay!);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should not call onClose when drawer content is clicked', () => {
      render(<MobileDrawer {...defaultProps} />);

      const drawer = document.querySelector('.mobile-drawer');
      expect(drawer).toBeInTheDocument();

      fireEvent.click(drawer!);

      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should call onStepClick and onClose when step button is clicked', async () => {
      render(<MobileDrawer {...defaultProps} />);

      const stepButton = screen.getByRole('button', { name: /Add Players/i });
      await user.click(stepButton);

      expect(mockOnStepClick).toHaveBeenCalledWith(1);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call action onClick and onClose when action button is clicked', async () => {
      const mockActionClick = vi.fn();
      const stepsWithMockAction = [
        {
          id: 2,
          title: 'Step 2: Manage Players',
          baseTitle: 'Manage Players',
          isVisible: true,
          isCollapsed: true,
          actions: [
            {
              label: 'Test Action',
              icon: React.createElement('span', {}, '🧪'),
              onClick: mockActionClick,
              isDestructive: false,
            },
          ],
        },
      ];

      render(
        <MobileDrawer
          {...defaultProps}
          steps={stepsWithMockAction}
        />,
      );

      const actionButton = screen.getByRole('button', { name: /Test Action/i });
      await user.click(actionButton);

      expect(mockActionClick).toHaveBeenCalledTimes(1);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA structure', () => {
      render(<MobileDrawer {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'Close drawer' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 3, name: 'Quick Access' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 4, name: 'Collapsed Steps' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 4, name: 'Quick Actions' })).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<MobileDrawer {...defaultProps} />);

      // Tab to close button
      await user.tab();
      expect(screen.getByRole('button', { name: 'Close drawer' })).toHaveFocus();

      // Tab to first step button
      await user.tab();
      expect(screen.getByRole('button', { name: /Add Players/i })).toHaveFocus();

      // Continue tabbing through elements
      await user.tab();
      expect(screen.getByRole('button', { name: /Manage Players/i })).toHaveFocus();
    });

    it('should handle keyboard activation of buttons', async () => {
      const user = userEvent.setup();
      render(<MobileDrawer {...defaultProps} />);

      const closeButton = screen.getByRole('button', { name: 'Close drawer' });
      closeButton.focus();
      await user.keyboard('{Enter}');

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Event Propagation', () => {
    it('should stop propagation when clicking drawer content', () => {
      const overlayClickHandler = vi.fn();
      render(
        <div onClick={overlayClickHandler}>
          <MobileDrawer {...defaultProps} />
        </div>,
      );

      const drawer = document.querySelector('.mobile-drawer');
      expect(drawer).toBeInTheDocument();

      fireEvent.click(drawer!);

      expect(overlayClickHandler).not.toHaveBeenCalled();
    });

    it('should handle backdrop click correctly when clicking overlay directly', () => {
      render(<MobileDrawer {...defaultProps} />);

      const overlay = document.querySelector('.mobile-drawer-overlay');

      // Create a click event that targets the overlay itself
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      });

      Object.defineProperty(clickEvent, 'target', {
        value: overlay,
        enumerable: true,
      });
      Object.defineProperty(clickEvent, 'currentTarget', {
        value: overlay,
        enumerable: true,
      });

      overlay?.dispatchEvent(clickEvent);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Conditional Rendering Logic', () => {
    it('should return null when isOpen is false', () => {
      const { container } = render(
        <MobileDrawer
          {...defaultProps}
          isOpen={false}
        />,
      );

      expect(container.firstChild).toBeNull();
    });

    it('should filter steps correctly', () => {
      const mixedSteps: StepDefinition[] = [
        { id: 1, title: 'Step 1', baseTitle: 'Step 1', isVisible: true, isCollapsed: true },
        { id: 2, title: 'Step 2', baseTitle: 'Step 2', isVisible: true, isCollapsed: false },
        { id: 3, title: 'Step 3', baseTitle: 'Step 3', isVisible: true, isCollapsed: true },
      ];

      render(
        <MobileDrawer
          {...defaultProps}
          steps={mixedSteps}
        />,
      );

      expect(screen.getByText('Step 1')).toBeInTheDocument();
      expect(screen.queryByText('Step 2')).not.toBeInTheDocument();
      expect(screen.getByText('Step 3')).toBeInTheDocument();
    });
  });
});
