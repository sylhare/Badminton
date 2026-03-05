import React, { useEffect, useState } from 'react';
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

  useEffect(() => {
    if (isOpen) {
      setScore1(winnerTeam === 1 ? '21' : '');
      setScore2(winnerTeam === 2 ? '21' : '');
    }
  }, [isOpen, winnerTeam]);

  if (!isOpen) return null;

  const handleScore1Change = (value: string) => {
    setScore1(value);
    if (winnerTeam === 1) {
      const n = parseInt(value, 10);
      if (!isNaN(n) && n > 21) setScore2(String(n - 2));
    }
  };

  const handleScore2Change = (value: string) => {
    setScore2(value);
    if (winnerTeam === 2) {
      const n = parseInt(value, 10);
      if (!isNaN(n) && n > 21) setScore1(String(n - 2));
    }
  };

  const handleConfirm = () => {
    const parsed1 = parseInt(score1, 10);
    const parsed2 = parseInt(score2, 10);
    const team1Score = isNaN(parsed1) ? (winnerTeam === 2 ? 18 : 21) : parsed1;
    const team2Score = isNaN(parsed2) ? (winnerTeam === 1 ? 18 : 21) : parsed2;
    onConfirm({ team1: team1Score, team2: team2Score });
    setScore1('');
    setScore2('');
  };

  const handleCancel = () => {
    setScore1('');
    setScore2('');
    onCancel();
  };

  const n1 = parseInt(score1, 10);
  const n2 = parseInt(score2, 10);
  const eff1 = isNaN(n1) ? (winnerTeam === 2 ? 18 : 21) : n1;
  const eff2 = isNaN(n2) ? (winnerTeam === 1 ? 18 : 21) : n2;
  const isConfirmDisabled = (winnerTeam === 1 && eff1 < eff2) || (winnerTeam === 2 && eff2 < eff1);

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
              onChange={(e) => handleScore1Change(e.target.value)}
              placeholder={winnerTeam === 2 ? '18' : '21'}
              aria-label="Team 1 score"
              data-testid="score-input-team1"
            />
            <span className="court-score-separator">—</span>
            <input
              type="number"
              min="0"
              value={score2}
              onChange={(e) => handleScore2Change(e.target.value)}
              placeholder={winnerTeam === 1 ? '18' : '21'}
              aria-label="Team 2 score"
              data-testid="score-input-team2"
            />
          </div>
        </div>

        <div className="modal-footer">
          <button
            className="button button-primary"
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
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
