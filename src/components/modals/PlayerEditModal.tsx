import React, { useEffect, useState } from 'react';

import type { Player } from '../../types';
import { Tooltip } from '../Tooltip';

import Modal from './Modal';

interface PlayerEditModalProps {
  player: Player | null;
  isOpen: boolean;
  onSave: (id: string, gender: Player['gender'], level: number) => void;
  onCancel: () => void;
}

const PlayerEditModal: React.FC<PlayerEditModalProps> = ({
  player,
  isOpen,
  onSave,
  onCancel,
}) => {
  const [gender, setGender] = useState<Player['gender']>('Unknown');
  const [level, setLevel] = useState<number>(50);

  useEffect(() => {
    if (player) {
      setGender(player.gender ?? 'Unknown');
      setLevel(player.level ?? 50);
    }
  }, [player]);

  if (!player) return null;

  const handleSave = () => {
    onSave(player.id, gender, level);
  };

  return (
    <Modal isOpen={isOpen} title={player.name} onClose={onCancel} testId="player-edit-modal" closeButtonTestId="player-edit-modal-close">
      <div className="modal-body">
        <div className="player-edit-field">
          <label className="player-edit-label">
            Gender
            <Tooltip testId="gender" text="Setting gender helps Smart Engine balance mixed doubles — it avoids putting all players of the same gender on one team." />
          </label>
          <div className="gender-selector">
            {(['F', 'M', 'Unknown'] as const).map((option) => (
              <button
                key={option}
                className={`gender-pill ${gender === option ? 'active' : ''}`}
                onClick={() => setGender(option)}
                data-testid={`gender-pill-${option}`}
              >
                {option === 'F' && '💁‍♀️ F'}
                {option === 'M' && '🙋‍♂️ M'}
                {option === 'Unknown' && 'Unknown'}
              </button>
            ))}
          </div>
        </div>

        <div className="player-edit-field">
          <label className="player-edit-label">
            Level: {level}
            <Tooltip testId="level" text="Level (0–100) represents playing skill. Smart Engine pairs players of similar levels together for more competitive and enjoyable matches." />
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={level}
            onChange={(e) => setLevel(Number(e.target.value))}
            className="level-slider"
            data-testid="level-slider"
          />
        </div>
      </div>

      <div className="modal-footer">
        <button className="button button-secondary" onClick={onCancel} data-testid="player-edit-cancel">
          Cancel
        </button>
        <button className="button button-primary" onClick={handleSave} data-testid="player-edit-save">
          Save
        </button>
      </div>
    </Modal>
  );
};

export default PlayerEditModal;
