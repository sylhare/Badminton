import React, { useEffect, useState } from 'react';

import type { Player } from '../../types';
import type { SetScore } from '../../tournament/types';
import { resolveMatchResult } from '../../tournament/types';

import Modal from './Modal';

interface ScoreInputModalProps {
  isOpen: boolean;
  winnerTeam: 1 | 2;
  team1Players: Player[];
  team2Players: Player[];
  /** Total sets in a match (best-of-N); the modal collects up to this many sets. Defaults to 1. */
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
    const first: SetInput = isSingle
      ? { s1: winnerTeam === 1 ? '21' : '', s2: winnerTeam === 2 ? '21' : '' }
      : emptySet();
    setSets([first, ...Array.from({ length: setCount - 1 }, emptySet)]);
  }, [isOpen, winnerTeam, setCount, isSingle]);

  const updateSet = (index: number, side: 's1' | 's2', value: string) => {
    setSets(prev => prev.map((set, i) => {
      if (i !== index) return set;
      const next = { ...set, [side]: value };
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

  const parseScore = (value: string): number | null => {
    const n = parseInt(value, 10);
    return isNaN(n) ? null : n;
  };
  const result = resolveMatchResult(
    sets.map(s => ({ team1: parseScore(s.s1), team2: parseScore(s.s2) })),
    winnerTeam,
    setCount,
  );
  const canConfirm = result !== null;
  const resolvedWinner: 1 | 2 = result?.winner ?? winnerTeam;

  const handleConfirm = () => {
    if (!result) return;
    onConfirm(result.winner, result.sets);
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
      title={canConfirm ? `🏆 Team ${resolvedWinner} wins!` : 'Enter the set scores'}
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
          disabled={!canConfirm}
          data-testid="score-modal-confirm"
        >
          Confirm
        </button>
      </div>
    </Modal>
  );
};

export default ScoreInputModal;
