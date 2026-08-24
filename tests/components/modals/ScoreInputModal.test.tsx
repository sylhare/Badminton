import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ScoreInputModal from '../../../src/components/modals/ScoreInputModal';
import type { Player } from '../../../src/types';

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

    it('shows 18 as placeholder for loser when team 1 wins', () => {
      const { input2 } = renderModal(1);
      expect(input2().placeholder).toBe('18');
    });

    it('shows 18 as placeholder for loser when team 2 wins', () => {
      const { input1 } = renderModal(2);
      expect(input1().placeholder).toBe('18');
    });

    it('confirm is enabled when only winner score is filled', () => {
      const { confirmBtn } = renderModal(1);
      expect(confirmBtn()).not.toBeDisabled();
    });

  });

  describe('confirm uses 18 as default loser score', () => {
    it('calls onConfirm with winner 1 and {team1: 21, team2: 18} when team 1 wins and loser is empty', async () => {
      const { confirmBtn, onConfirm } = renderModal(1);
      await user.click(confirmBtn());
      expect(onConfirm).toHaveBeenCalledWith(1, [{ team1: 21, team2: 18 }]);
    });

    it('calls onConfirm with winner 2 and {team1: 18, team2: 21} when team 2 wins and loser is empty', async () => {
      const { confirmBtn, onConfirm } = renderModal(2);
      await user.click(confirmBtn());
      expect(onConfirm).toHaveBeenCalledWith(2, [{ team1: 18, team2: 21 }]);
    });

    it('calls onConfirm with entered scores when both are filled', async () => {
      const { input1, input2, confirmBtn, onConfirm } = renderModal(1);
      await user.clear(input1());
      await user.type(input1(), '21');
      await user.type(input2(), '15');
      await user.click(confirmBtn());
      expect(onConfirm).toHaveBeenCalledWith(1, [{ team1: 21, team2: 15 }]);
    });
  });

  describe('score decides the winner regardless of the clicked team', () => {
    it('resolves the clicked loser as winner when they score more points', async () => {
      const { input1, input2, confirmBtn, onConfirm } = renderModal(2);
      await user.type(input1(), '21');
      await user.clear(input2());
      await user.type(input2(), '18');
      await user.click(confirmBtn());
      expect(onConfirm).toHaveBeenCalledWith(1, [{ team1: 21, team2: 18 }]);
    });

    it('keeps the clicked team as winner on a tie', async () => {
      const { input1, input2, confirmBtn, onConfirm } = renderModal(2);
      await user.type(input1(), '20');
      await user.clear(input2());
      await user.type(input2(), '20');
      await user.click(confirmBtn());
      expect(onConfirm).toHaveBeenCalledWith(2, [{ team1: 20, team2: 20 }]);
    });

    it('updates the title to the score-derived winner', async () => {
      const { input1, input2 } = renderModal(2);
      await user.type(input1(), '21');
      await user.clear(input2());
      await user.type(input2(), '18');
      expect(screen.getByText('🏆 Team 1 wins!')).toBeInTheDocument();
    });

    it('never disables confirm', async () => {
      const { input1, input2, confirmBtn } = renderModal(1);
      await user.clear(input1());
      await user.type(input1(), '10');
      await user.type(input2(), '21');
      expect(confirmBtn()).not.toBeDisabled();
    });
  });

  describe('settles the loser score from the winner score at deuce', () => {
    it('records winner − 2 when team 1 winner scores 23 and the loser is left blank', async () => {
      const { input1, confirmBtn, onConfirm } = renderModal(1);
      await user.clear(input1());
      await user.type(input1(), '23');
      await user.click(confirmBtn());
      expect(onConfirm).toHaveBeenCalledWith(1, [{ team1: 23, team2: 21 }]);
    });

    it('records winner − 2 when team 2 winner scores 25 and the loser is left blank', async () => {
      const { input2, confirmBtn, onConfirm } = renderModal(2);
      await user.clear(input2());
      await user.type(input2(), '25');
      await user.click(confirmBtn());
      expect(onConfirm).toHaveBeenCalledWith(2, [{ team1: 23, team2: 25 }]);
    });

    it('uses the standard 18 margin when the winner scores exactly 21', async () => {
      const { input1, confirmBtn, onConfirm } = renderModal(1);
      await user.clear(input1());
      await user.type(input1(), '21');
      await user.click(confirmBtn());
      expect(onConfirm).toHaveBeenCalledWith(1, [{ team1: 21, team2: 18 }]);
    });
  });

  describe('best-of-N sets', () => {
    function renderBestOf(bestOf: number, winnerTeam: 1 | 2 = 1) {
      const onConfirm = vi.fn();
      render(
        <ScoreInputModal
          isOpen
          winnerTeam={winnerTeam}
          team1Players={team1}
          team2Players={team2}
          bestOf={bestOf}
          onConfirm={onConfirm}
          onCancel={vi.fn()}
        />,
      );
      return {
        onConfirm,
        confirmBtn: () => screen.getByTestId('score-modal-confirm'),
        set: (i: number) => ({
          t1: () => screen.getByTestId(`score-input-team1-${i}`) as HTMLInputElement,
          t2: () => screen.getByTestId(`score-input-team2-${i}`) as HTMLInputElement,
        }),
      };
    }

    it('renders one input row per set for best of 3', () => {
      renderBestOf(3);
      expect(screen.getByTestId('score-input-team1-0')).toBeInTheDocument();
      expect(screen.getByTestId('score-input-team1-1')).toBeInTheDocument();
      expect(screen.getByTestId('score-input-team1-2')).toBeInTheDocument();
      expect(screen.queryByTestId('score-input-team1-3')).not.toBeInTheDocument();
    });

    it('starts blank with the winner default as placeholder and confirms a 2–0 clinch when left empty', async () => {
      const { set, confirmBtn, onConfirm } = renderBestOf(3, 1);
      expect(set(0).t1().value).toBe('');
      expect(set(0).t1().placeholder).toBe('21');
      expect(set(0).t2().placeholder).toBe('18');
      expect(confirmBtn()).toBeEnabled();
      await user.click(confirmBtn());
      expect(onConfirm).toHaveBeenCalledWith(1, [
        { team1: 21, team2: 18 }, { team1: 21, team2: 18 },
      ]);
    });

    it('leaves the deciding set editable while blank and locks it once a side takes the first two', async () => {
      const { set } = renderBestOf(3, 1);
      expect(set(2).t1()).toBeEnabled();
      await user.type(set(0).t1(), '21'); await user.type(set(0).t2(), '18');
      await user.type(set(1).t1(), '21'); await user.type(set(1).t2(), '18');
      expect(set(2).t1()).toBeDisabled();
      expect(set(2).t2()).toBeDisabled();
    });

    it('records every entered set when the first two split and the decider is played out', async () => {
      const { set, confirmBtn, onConfirm } = renderBestOf(3, 1);
      await user.type(set(0).t1(), '15'); await user.type(set(0).t2(), '21');
      await user.type(set(1).t1(), '21'); await user.type(set(1).t2(), '18');
      expect(set(2).t1()).toBeEnabled();
      await user.type(set(2).t1(), '21'); await user.type(set(2).t2(), '18');
      await user.click(confirmBtn());
      expect(onConfirm).toHaveBeenCalledWith(1, [
        { team1: 15, team2: 21 }, { team1: 21, team2: 18 }, { team1: 21, team2: 18 },
      ]);
    });

    it('does not fabricate blank sets: an incomplete best-of-N cannot be confirmed', async () => {
      const { set, confirmBtn } = renderBestOf(3, 1);
      await user.type(set(0).t1(), '19'); await user.type(set(0).t2(), '21');
      expect(confirmBtn()).toBeDisabled();
    });

    it('lets the entered sets flip the winner', async () => {
      const { set, confirmBtn, onConfirm } = renderBestOf(3, 1);
      await user.clear(set(0).t1()); await user.type(set(0).t1(), '18');
      await user.clear(set(0).t2()); await user.type(set(0).t2(), '21');
      await user.clear(set(1).t1()); await user.type(set(1).t1(), '19');
      await user.clear(set(1).t2()); await user.type(set(1).t2(), '21');
      await user.click(confirmBtn());
      expect(onConfirm).toHaveBeenCalledWith(2, [
        { team1: 18, team2: 21 }, { team1: 19, team2: 21 },
      ]);
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
