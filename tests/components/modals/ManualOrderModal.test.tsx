import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ManualOrderModal from '../../../src/components/modals/ManualOrderModal';
import { createTournamentTeams } from '../../data/testFactories';

describe('ManualOrderModal Component', () => {
  const mockOnConfirm = vi.fn();
  const mockOnCancel = vi.fn();

  const teams = createTournamentTeams(['a', 'b', 'c']);

  const defaultProps = {
    isOpen: true,
    teams,
    onConfirm: mockOnConfirm,
    onCancel: mockOnCancel,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('does not render when isOpen is false', () => {
      render(<ManualOrderModal {...defaultProps} isOpen={false} />);
      expect(screen.queryByTestId('manual-order-modal')).not.toBeInTheDocument();
    });

    it('lists the tied teams in their given standings order', () => {
      render(<ManualOrderModal {...defaultProps} />);

      const items = screen.getAllByTestId(/^manual-order-item-/);
      expect(items).toHaveLength(3);
      expect(items[0]).toHaveTextContent('a');
      expect(items[1]).toHaveTextContent('b');
      expect(items[2]).toHaveTextContent('c');
    });

    it('disables ▲ on the first row and ▼ on the last row', () => {
      render(<ManualOrderModal {...defaultProps} />);

      expect(screen.getByTestId('manual-order-up-0')).toBeDisabled();
      expect(screen.getByTestId('manual-order-down-0')).toBeEnabled();
      expect(screen.getByTestId('manual-order-up-2')).toBeEnabled();
      expect(screen.getByTestId('manual-order-down-2')).toBeDisabled();
    });
  });

  describe('Reordering', () => {
    const user = userEvent.setup();

    it('confirms the current order when nothing is moved', async () => {
      render(<ManualOrderModal {...defaultProps} />);

      await user.click(screen.getByTestId('manual-order-save'));

      expect(mockOnConfirm).toHaveBeenCalledWith(['a', 'b', 'c']);
    });

    it('moves a team down and saves the new order', async () => {
      render(<ManualOrderModal {...defaultProps} />);

      await user.click(screen.getByTestId('manual-order-down-0'));
      await user.click(screen.getByTestId('manual-order-save'));

      expect(mockOnConfirm).toHaveBeenCalledWith(['b', 'a', 'c']);
    });

    it('moves a team up and saves the new order', async () => {
      render(<ManualOrderModal {...defaultProps} />);

      await user.click(screen.getByTestId('manual-order-up-2'));
      await user.click(screen.getByTestId('manual-order-save'));

      expect(mockOnConfirm).toHaveBeenCalledWith(['a', 'c', 'b']);
    });

    it('reflects the moved position in the rendered list', async () => {
      render(<ManualOrderModal {...defaultProps} />);

      await user.click(screen.getByTestId('manual-order-down-0'));

      const items = screen.getAllByTestId(/^manual-order-item-/);
      expect(items[0]).toHaveTextContent('b');
      expect(items[1]).toHaveTextContent('a');
    });
  });

  describe('Cancel / close', () => {
    const user = userEvent.setup();

    it('calls onCancel without confirming when Cancel is clicked', async () => {
      render(<ManualOrderModal {...defaultProps} />);

      await user.click(screen.getByTestId('manual-order-cancel'));

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });
  });

  describe('Reset on reopen', () => {
    it('resets any in-progress reordering when reopened with new teams', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<ManualOrderModal {...defaultProps} />);

      await user.click(screen.getByTestId('manual-order-down-0'));
      rerender(<ManualOrderModal {...defaultProps} isOpen={false} />);

      const nextTeams = createTournamentTeams(['x', 'y']);
      rerender(<ManualOrderModal {...defaultProps} isOpen teams={nextTeams} />);

      const items = screen.getAllByTestId(/^manual-order-item-/);
      expect(items).toHaveLength(2);
      expect(items[0]).toHaveTextContent('x');
      expect(items[1]).toHaveTextContent('y');
    });
  });
});
