import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ScoreInputModal from '../../src/components/ScoreInputModal';
import type { Player } from '../../src/types';

const team1: Player[] = [{ id: '1', name: 'Alice', isPresent: true }];
const team2: Player[] = [{ id: '2', name: 'Bob', isPresent: true }];

function renderModal(winnerTeam: 1 | 2 = 1) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ScoreInputModal
      isOpen
      winnerTeam={winnerTeam}
      team1Players={team1}
      team2Players={team2}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  );
  return {
    onConfirm,
    confirmBtn: () => screen.getByTestId('score-modal-confirm'),
    input1: () => screen.getByTestId('score-input-team1') as HTMLInputElement,
    input2: () => screen.getByTestId('score-input-team2') as HTMLInputElement,
  };
}

describe('ScoreInputModal', () => {
  const user = userEvent.setup();

  beforeEach(() => vi.clearAllMocks());

  describe('initial state', () => {
    it('pre-fills winner team 1 score with 21', () => {
      const { input1, input2 } = renderModal(1);
      expect(input1().value).toBe('21');
      expect(input2().value).toBe('');
    });

    it('pre-fills winner team 2 score with 21', () => {
      const { input1, input2 } = renderModal(2);
      expect(input1().value).toBe('');
      expect(input2().value).toBe('21');
    });

    it('confirm is enabled when only winner score is filled', () => {
      const { confirmBtn } = renderModal(1);
      expect(confirmBtn()).not.toBeDisabled();
    });
  });

  describe('confirm disabled when winner has fewer points', () => {
    it('disables confirm when team 1 wins but score1 < score2', async () => {
      const { input1, input2, confirmBtn } = renderModal(1);
      await user.clear(input1());
      await user.type(input1(), '15');
      await user.type(input2(), '21');
      expect(confirmBtn()).toBeDisabled();
    });

    it('disables confirm when team 2 wins but score2 < score1', async () => {
      const { input1, input2, confirmBtn } = renderModal(2);
      await user.type(input1(), '21');
      await user.clear(input2());
      await user.type(input2(), '10');
      expect(confirmBtn()).toBeDisabled();
    });

    it('does not call onConfirm when confirm button is disabled', async () => {
      const { input1, input2, confirmBtn, onConfirm } = renderModal(1);
      await user.clear(input1());
      await user.type(input1(), '10');
      await user.type(input2(), '21');
      expect(confirmBtn()).toBeDisabled();
      await user.click(confirmBtn());
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  describe('loser auto-fill when winner scores above 21', () => {
    it('sets loser score to winner − 2 when team 1 winner scores 23', async () => {
      const { input1, input2 } = renderModal(1);
      await user.clear(input1());
      await user.type(input1(), '23');
      expect(input2().value).toBe('21');
    });

    it('sets loser score to winner − 2 when team 1 winner scores 25', async () => {
      const { input1, input2 } = renderModal(1);
      await user.clear(input1());
      await user.type(input1(), '25');
      expect(input2().value).toBe('23');
    });

    it('sets loser score to winner − 2 when team 2 winner scores 23', async () => {
      const { input1, input2 } = renderModal(2);
      await user.clear(input2());
      await user.type(input2(), '23');
      expect(input1().value).toBe('21');
    });

    it('does not auto-fill loser when winner scores exactly 21', async () => {
      const { input1, input2 } = renderModal(1);
      await user.clear(input1());
      await user.type(input1(), '21');
      expect(input2().value).toBe('');
    });

    it('does not auto-fill winner when loser score changes above 21', async () => {
      const { input1, input2 } = renderModal(1);
      await user.clear(input1());
      await user.type(input2(), '23');
      expect(input1().value).toBe('');
    });
  });

  describe('confirm enabled with valid scores', () => {
    it('is enabled when winner score equals loser score', async () => {
      const { input1, input2, confirmBtn } = renderModal(1);
      await user.clear(input1());
      await user.type(input1(), '21');
      await user.type(input2(), '21');
      expect(confirmBtn()).not.toBeDisabled();
    });

    it('is enabled when winner score is greater than loser score', async () => {
      const { input1, input2, confirmBtn } = renderModal(1);
      await user.clear(input1());
      await user.type(input1(), '21');
      await user.type(input2(), '15');
      expect(confirmBtn()).not.toBeDisabled();
    });

    it('is enabled when only one score is entered', async () => {
      const { input2, confirmBtn } = renderModal(1);
      await user.type(input2(), '15');
      expect(confirmBtn()).not.toBeDisabled();
    });

    it('is enabled when no scores are entered', async () => {
      const { input1, confirmBtn } = renderModal(1);
      await user.clear(input1());
      expect(confirmBtn()).not.toBeDisabled();
    });
  });
});
