import React, { useState } from 'react';
import { X } from '@phosphor-icons/react';

import type { Player } from '../types';

interface ScoreInputModalProps {
  isOpen: boolean;
  winnerTeam: 1 | 2;
  team1Players: Player[];
  team2Players: Player[];
  onConfirm: (score?: { team1: number; team2: number }) => void;
  onCancel: () => void;
}

const ScoreInputModal: React.FC<ScoreInputModalProps> = ({
  isOpen,
  winnerTeam,
  team1Players,
  team2Players,
  onConfirm,
  onCancel,
}) => {
  const [score1, setScore1] = useState('');
  const [score2, setScore2] = useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    const n1 = parseInt(score1, 10);
    const n2 = parseInt(score2, 10);
    if (!isNaN(n1) && !isNaN(n2)) {
      onConfirm({ team1: n1, team2: n2 });
    } else {
      onConfirm(undefined);
    }
    setScore1('');
    setScore2('');
  };

  const handleSkip = () => {
    onConfirm(undefined);
    setScore1('');
    setScore2('');
  };

  const handleCancel = () => {
    setScore1('');
    setScore2('');
    onCancel();
  };

  const teamNames = (players: Player[]) => players.map(p => p.name).join(' & ');

  return (
    <div className="modal-overlay" onClick={handleCancel} data-testid="score-input-modal">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>🏆 Team {winnerTeam} wins!</h3>
          <button className="modal-close" onClick={handleCancel}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <p>Optionally enter the score:</p>
          <div className="score-modal-teams">
            <span className="score-modal-team-name">{teamNames(team1Players)}</span>
            <span className="score-modal-vs">vs</span>
            <span className="score-modal-team-name">{teamNames(team2Players)}</span>
          </div>
          <div className="score-modal-inputs">
            <input
              type="number"
              min="0"
              value={score1}
              onChange={(e) => setScore1(e.target.value)}
              placeholder="T1"
              aria-label="Team 1 score"
              data-testid="score-input-team1"
            />
            <span className="court-score-separator">—</span>
            <input
              type="number"
              min="0"
              value={score2}
              onChange={(e) => setScore2(e.target.value)}
              placeholder="T2"
              aria-label="Team 2 score"
              data-testid="score-input-team2"
            />
          </div>
        </div>

        <div className="modal-footer">
          <button
            className="button button-secondary"
            onClick={handleSkip}
            data-testid="score-modal-skip"
          >
            Skip
          </button>
          <button
            className="button button-primary"
            onClick={handleConfirm}
            data-testid="score-modal-confirm"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScoreInputModal;
