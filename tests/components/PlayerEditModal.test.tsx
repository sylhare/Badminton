import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import PlayerEditModal from '../../src/components/PlayerEditModal';
import type { Player } from '../../src/types';

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'player-1',
    name: 'Alice',
    isPresent: true,
    gender: 'Unknown',
    level: 50,
    ...overrides,
  };
}

describe('PlayerEditModal', () => {
  const mockOnSave = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders nothing when isOpen is false', () => {
      render(
        <PlayerEditModal
          player={makePlayer()}
          isOpen={false}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
      );
      expect(screen.queryByTestId('player-edit-modal')).not.toBeInTheDocument();
    });

    it('renders nothing when player is null', () => {
      render(
        <PlayerEditModal
          player={null}
          isOpen={true}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
      );
      expect(screen.queryByTestId('player-edit-modal')).not.toBeInTheDocument();
    });

    it('renders player name in header when isOpen is true', () => {
      render(
        <PlayerEditModal
          player={makePlayer({ name: 'Alice' })}
          isOpen={true}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
      );
      expect(screen.getByRole('heading', { name: 'Alice' })).toBeInTheDocument();
    });

    it('renders all three gender buttons (F, M, Unknown)', () => {
      render(
        <PlayerEditModal
          player={makePlayer()}
          isOpen={true}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
      );
      expect(screen.getByTestId('gender-pill-F')).toBeInTheDocument();
      expect(screen.getByTestId('gender-pill-M')).toBeInTheDocument();
      expect(screen.getByTestId('gender-pill-Unknown')).toBeInTheDocument();
    });

    it('renders level slider', () => {
      render(
        <PlayerEditModal
          player={makePlayer({ level: 75 })}
          isOpen={true}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
      );
      const slider = screen.getByTestId('level-slider');
      expect(slider).toBeInTheDocument();
      expect(slider).toHaveAttribute('type', 'range');
    });

    it('shows current level value in label', () => {
      render(
        <PlayerEditModal
          player={makePlayer({ level: 75 })}
          isOpen={true}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
      );
      expect(screen.getByText(/Level: 75/)).toBeInTheDocument();
    });

    it('initializes gender pill from player gender', () => {
      render(
        <PlayerEditModal
          player={makePlayer({ gender: 'F' })}
          isOpen={true}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
      );
      expect(screen.getByTestId('gender-pill-F')).toHaveClass('active');
      expect(screen.getByTestId('gender-pill-M')).not.toHaveClass('active');
    });

    it('renders Save and Cancel buttons', () => {
      render(
        <PlayerEditModal
          player={makePlayer()}
          isOpen={true}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
      );
      expect(screen.getByTestId('player-edit-save')).toBeInTheDocument();
      expect(screen.getByTestId('player-edit-cancel')).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    const user = userEvent.setup();

    it('clicking a gender button selects it (visual active state)', async () => {
      render(
        <PlayerEditModal
          player={makePlayer({ gender: 'Unknown' })}
          isOpen={true}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
      );

      await user.click(screen.getByTestId('gender-pill-M'));
      expect(screen.getByTestId('gender-pill-M')).toHaveClass('active');
      expect(screen.getByTestId('gender-pill-Unknown')).not.toHaveClass('active');
    });

    it('moving slider updates the displayed level value', async () => {
      render(
        <PlayerEditModal
          player={makePlayer({ level: 50 })}
          isOpen={true}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
      );

      const slider = screen.getByTestId('level-slider') as HTMLInputElement;
      fireEvent.change(slider, { target: { value: '80' } });

      expect(screen.getByText(/Level: 80/)).toBeInTheDocument();
    });

    it('Save calls onSave with correct id, gender, and level', async () => {
      render(
        <PlayerEditModal
          player={makePlayer({ id: 'p-42', gender: 'Unknown', level: 50 })}
          isOpen={true}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
      );

      await user.click(screen.getByTestId('gender-pill-F'));
      const slider = screen.getByTestId('level-slider') as HTMLInputElement;
      fireEvent.change(slider, { target: { value: '90' } });

      await user.click(screen.getByTestId('player-edit-save'));

      expect(mockOnSave).toHaveBeenCalledWith('p-42', 'F', 90);
      expect(mockOnCancel).not.toHaveBeenCalled();
    });

    it('Cancel calls onCancel without calling onSave', async () => {
      render(
        <PlayerEditModal
          player={makePlayer()}
          isOpen={true}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
      );

      await user.click(screen.getByTestId('player-edit-cancel'));

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('clicking overlay calls onCancel', () => {
      render(
        <PlayerEditModal
          player={makePlayer()}
          isOpen={true}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
      );

      const overlay = screen.getByTestId('player-edit-modal');
      fireEvent.click(overlay);

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    it('clicking modal content does not call onCancel', () => {
      render(
        <PlayerEditModal
          player={makePlayer()}
          isOpen={true}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
      );

      const content = document.querySelector('.modal-content');
      expect(content).toBeInTheDocument();
      fireEvent.click(content!);

      expect(mockOnCancel).not.toHaveBeenCalled();
    });

    it('close button calls onCancel', async () => {
      render(
        <PlayerEditModal
          player={makePlayer()}
          isOpen={true}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
      );

      await user.click(screen.getByTestId('player-edit-modal-close'));
      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    it('re-renders with new player data when player prop changes', async () => {
      const { rerender } = render(
        <PlayerEditModal
          player={makePlayer({ name: 'Alice', gender: 'F', level: 80 })}
          isOpen={true}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
      );

      expect(screen.getByTestId('gender-pill-F')).toHaveClass('active');
      expect(screen.getByText(/Level: 80/)).toBeInTheDocument();

      rerender(
        <PlayerEditModal
          player={makePlayer({ name: 'Bob', gender: 'M', level: 30 })}
          isOpen={true}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
      );

      expect(screen.getByTestId('gender-pill-M')).toHaveClass('active');
      expect(screen.getByText(/Level: 30/)).toBeInTheDocument();
    });
  });
});
