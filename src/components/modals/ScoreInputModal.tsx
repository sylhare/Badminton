import React, { useEffect, useState } from 'react';

import type { Player } from '../../types';
import type { SetScore } from '../../tournament/types';
import { winningSide } from '../../tournament/types';

import Modal from './Modal';

interface ScoreInputModalProps {
  isOpen: boolean;
  winnerTeam: 1 | 2;
  team1Players: Player[];
  team2Players: Player[];
  /** Sets needed to win; the modal collects up to this many sets. Defaults to 1. */
  bestOf?: number;
  onConfirm: (winner: 1 | 2, sets: SetScore[]) => void;
  onCancel: () => void;
}

interface SetInput {
  s1: string;
  s2: string;
}

const emptySet = (): SetInput => ({ s1: '', s2: '' });

const ScoreInputModal: React.FC<ScoreInputModalProps> = ({
  isOpen,
  winnerTeam,
  team1Players,
  team2Players,
  bestOf = 1,
  onConfirm,
  onCancel,
}) => {
  const setCount = Math.max(1, bestOf);
  const isSingle = setCount === 1;
  const [sets, setSets] = useState<SetInput[]>([emptySet()]);

  useEffect(() => {
    if (!isOpen) return;
    const first: SetInput = { s1: winnerTeam === 1 ? '21' : '', s2: winnerTeam === 2 ? '21' : '' };
    setSets([first, ...Array.from({ length: setCount - 1 }, emptySet)]);
  }, [isOpen, winnerTeam, setCount]);

  const updateSet = (index: number, side: 's1' | 's2', value: string) => {
    setSets(prev => prev.map((set, i) => {
      if (i !== index) return set;
      const next = { ...set, [side]: value };
      // Single-set deuce helper: a winning score above 21 fills the loser at n-2.
      const isWinnerSide = (side === 's1' && winnerTeam === 1) || (side === 's2' && winnerTeam === 2);
      if (isSingle && isWinnerSide) {
        const n = parseInt(value, 10);
        if (!isNaN(n) && n > 21) {
          return side === 's1' ? { ...next, s2: String(n - 2) } : { ...next, s1: String(n - 2) };
        }
      }
      return next;
    }));
  };

  const singleDefaults = winnerTeam === 1 ? { team1: 21, team2: 18 } : { team1: 18, team2: 21 };

  const resolveSets = (): SetScore[] => {
    const resolved: SetScore[] = [];
    sets.forEach((set, index) => {
      const p1 = parseInt(set.s1, 10);
      const p2 = parseInt(set.s2, 10);
      const blank1 = isNaN(p1);
      const blank2 = isNaN(p2);
      // The single-set path keeps the 21–18 default so an empty confirm still records a score.
      if (isSingle && index === 0) {
        resolved.push({
          team1: blank1 ? singleDefaults.team1 : p1,
          team2: blank2 ? singleDefaults.team2 : p2,
        });
        return;
      }
      if (blank1 && blank2) return; // an unplayed set contributes nothing
      resolved.push({ team1: blank1 ? 0 : p1, team2: blank2 ? 0 : p2 });
    });
    return resolved;
  };

  const resolvedSets = resolveSets();
  // The sets decide the winner; a tie keeps the clicked team.
  const resolvedWinner: 1 | 2 = winningSide(resolvedSets) ?? winnerTeam;

  const handleConfirm = () => {
    onConfirm(resolvedWinner, resolvedSets);
    setSets([emptySet()]);
  };

  const handleCancel = () => {
    setSets([emptySet()]);
    onCancel();
  };

  const teamNames = (players: Player[]) => players.map(p => p.name).join(' & ');

  const setRow = (set: SetInput, index: number) => {
    const suffix = isSingle ? '' : `-${index}`;
    return (
      <div className="score-modal-set-row" key={index}>
        {!isSingle && <span className="score-modal-set-label">Set {index + 1}</span>}
        <div className="score-modal-inputs">
          <input
            type="number"
            min="0"
            value={set.s1}
            onChange={(e) => updateSet(index, 's1', e.target.value)}
            placeholder={isSingle ? String(singleDefaults.team1) : '0'}
            aria-label={`Team 1 score${isSingle ? '' : ` set ${index + 1}`}`}
            data-testid={`score-input-team1${suffix}`}
          />
          <span className="court-score-separator">—</span>
          <input
            type="number"
            min="0"
            value={set.s2}
            onChange={(e) => updateSet(index, 's2', e.target.value)}
            placeholder={isSingle ? String(singleDefaults.team2) : '0'}
            aria-label={`Team 2 score${isSingle ? '' : ` set ${index + 1}`}`}
            data-testid={`score-input-team2${suffix}`}
          />
        </div>
      </div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      title={`🏆 Team ${resolvedWinner} wins!`}
      onClose={handleCancel}
      testId="score-input-modal"
    >
      <div className="modal-body">
        <p>{isSingle ? 'Enter the score (defaults to 21 – 18):' : `Enter the score for each set (best of ${setCount}):`}</p>
        <div className="score-modal-teams">
          <span className="score-modal-team-name">{teamNames(team1Players)}</span>
          <span className="score-modal-vs">vs</span>
          <span className="score-modal-team-name">{teamNames(team2Players)}</span>
        </div>
        <div className="score-modal-sets">
          {sets.map(setRow)}
        </div>
      </div>

      <div className="modal-footer">
        <button
          className="button button-primary"
          onClick={handleConfirm}
          data-testid="score-modal-confirm"
        >
          Confirm
        </button>
      </div>
    </Modal>
  );
};

export default ScoreInputModal;
