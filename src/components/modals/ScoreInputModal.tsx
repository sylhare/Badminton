import React, { useEffect, useMemo, useState } from 'react';

import type { Player, SetScore } from '../../types';
import { DEFAULT_SET_SIZE, formatPlayerNames } from '../../types';
import { MatchScore } from '../../scoring/MatchScore';
import { cx } from '../common/cx';

import Modal from './Modal';

interface ScoreInputModalProps {
  isOpen: boolean;
  winnerTeam: 1 | 2;
  team1Players: Player[];
  team2Players: Player[];
  /** Total sets in a match (best-of-N); the modal collects up to this many sets. Defaults to 1. */
  bestOf?: number;
  /** Points a side plays to in a set; seeds the winner's default score. Defaults to 21. */
  setSize?: number;
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
  setSize = DEFAULT_SET_SIZE,
  onConfirm,
  onCancel,
}) => {
  const setCount = Math.max(1, bestOf);
  const isSingle = setCount === 1;
  const defaults = useMemo(() => MatchScore.defaultSingle(winnerTeam, setSize), [winnerTeam, setSize]);
  const [sets, setSets] = useState<SetInput[]>([emptySet()]);

  useEffect(() => {
    if (!isOpen) return;
    const seededSet = (): SetInput => isSingle
      ? { s1: winnerTeam === 1 ? String(defaults.team1) : '', s2: winnerTeam === 2 ? String(defaults.team2) : '' }
      : { s1: String(defaults.team1), s2: String(defaults.team2) };
    setSets(Array.from({ length: setCount }, seededSet));
  }, [isOpen, winnerTeam, setCount, isSingle, defaults]);

  const updateSet = (index: number, side: 's1' | 's2', value: string) => {
    setSets(prev => prev.map((set, i) => (i === index ? { ...set, [side]: value } : set)));
  };

  const rawSets = sets.map(s => ({ team1: s.s1, team2: s.s2 }));
  const result = MatchScore.resolve(rawSets, winnerTeam, setCount, setSize);
  const canConfirm = result !== null;
  const resolvedWinner: 1 | 2 = result?.winner ?? winnerTeam;

  const clinchIndex = MatchScore.clinchSetIndex(rawSets, setCount);
  const isLocked = (index: number) => clinchIndex >= 0 && index > clinchIndex;

  const handleConfirm = () => {
    if (!result || !result.winner) return;
    onConfirm(result.winner, result.sets);
  };

  const setRow = (set: SetInput, index: number) => {
    const suffix = isSingle ? '' : `-${index}`;
    const locked = isLocked(index);
    return (
      <div className={cx('score-modal-set-row', locked && 'score-modal-set-locked')} key={index}>
        {!isSingle && <span className="score-modal-set-label">Set {index + 1}</span>}
        <div className="score-modal-inputs">
          <input
            type="number"
            min="0"
            value={set.s1}
            disabled={locked}
            onChange={(e) => updateSet(index, 's1', e.target.value)}
            placeholder={isSingle ? String(defaults.team1) : '0'}
            aria-label={`Team 1 score${isSingle ? '' : ` set ${index + 1}`}`}
            data-testid={`score-input-team1${suffix}`}
          />
          <span className="court-score-separator">—</span>
          <input
            type="number"
            min="0"
            value={set.s2}
            disabled={locked}
            onChange={(e) => updateSet(index, 's2', e.target.value)}
            placeholder={isSingle ? String(defaults.team2) : '0'}
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
      onClose={onCancel}
      testId="score-input-modal"
    >
      <div className="modal-body">
        <p>{isSingle
          ? `Enter the score (defaults to ${setSize} – ${winnerTeam === 1 ? defaults.team2 : defaults.team1}):`
          : `Enter the score for each set (best of ${setCount}):`}</p>
        <div className="score-modal-teams">
          <span className="score-modal-team-name">{formatPlayerNames(team1Players)}</span>
          <span className="score-modal-vs">vs</span>
          <span className="score-modal-team-name">{formatPlayerNames(team2Players)}</span>
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
