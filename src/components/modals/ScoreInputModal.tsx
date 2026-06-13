import React, { useEffect, useState } from 'react';

import type { Player } from '../../types';

import Modal from './Modal';

interface ScoreInputModalProps {
  isOpen: boolean;
  winnerTeam: 1 | 2;
  team1Players: Player[];
  team2Players: Player[];
  onConfirm: (score: { team1: number; team2: number }) => void;
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

  const defaults = winnerTeam === 1 ? { team1: 21, team2: 18 } : { team1: 18, team2: 21 };

  const parsed1 = parseInt(score1, 10);
  const parsed2 = parseInt(score2, 10);
  const resolvedScore = {
    team1: isNaN(parsed1) ? defaults.team1 : parsed1,
    team2: isNaN(parsed2) ? defaults.team2 : parsed2,
  };

  const handleConfirm = () => {
    onConfirm(resolvedScore);
    setScore1('');
    setScore2('');
  };

  const handleCancel = () => {
    setScore1('');
    setScore2('');
    onCancel();
  };

  const isConfirmDisabled =
    (winnerTeam === 1 && resolvedScore.team1 < resolvedScore.team2) ||
    (winnerTeam === 2 && resolvedScore.team2 < resolvedScore.team1);

  const teamNames = (players: Player[]) => players.map(p => p.name).join(' & ');

  return (
    <Modal
      isOpen={isOpen}
      title={`🏆 Team ${winnerTeam} wins!`}
      onClose={handleCancel}
      testId="score-input-modal"
    >
      <div className="modal-body">
        <p>Enter the score (defaults to 21 – 18):</p>
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
            placeholder={String(defaults.team1)}
            aria-label="Team 1 score"
            data-testid="score-input-team1"
          />
          <span className="court-score-separator">—</span>
          <input
            type="number"
            min="0"
            value={score2}
            onChange={(e) => handleScore2Change(e.target.value)}
            placeholder={String(defaults.team2)}
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
    </Modal>
  );
};

export default ScoreInputModal;
