import React, { useEffect, useState } from 'react';
import { X } from '@phosphor-icons/react';

import type { Player } from '../types';
import { Tooltip } from './Tooltip';

interface PlayerEditModalProps {
  player: Player | null;
  isOpen: boolean;
  onSave: (id: string, sex: Player['sex'], level: number) => void;
  onCancel: () => void;
}

const PlayerEditModal: React.FC<PlayerEditModalProps> = ({
  player,
  isOpen,
  onSave,
  onCancel,
}) => {
  const [sex, setSex] = useState<Player['sex']>('Unknown');
  const [level, setLevel] = useState<number>(50);

  useEffect(() => {
    if (player) {
      setSex(player.sex ?? 'Unknown');
      setLevel(player.level ?? 50);
    }
  }, [player]);

  if (!isOpen || !player) return null;

  const handleSave = () => {
    onSave(player.id, sex, level);
  };

  return (
    <div className="modal-overlay" onClick={onCancel} data-testid="player-edit-modal">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{player.name}</h3>
          <button className="modal-close" onClick={onCancel} aria-label="Close" data-testid="player-edit-modal-close">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div className="player-edit-field">
            <label className="player-edit-label">
              Gender
              <Tooltip testId="gender" text="Setting gender helps Smart Engine balance mixed doubles — it avoids putting all players of the same gender on one team." />
            </label>
            <div className="sex-selector">
              {(['F', 'M', 'Unknown'] as const).map((option) => (
                <button
                  key={option}
                  className={`sex-pill ${sex === option ? 'active' : ''}`}
                  onClick={() => setSex(option)}
                  data-testid={`sex-pill-${option}`}
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
      </div>
    </div>
  );
};

export default PlayerEditModal;
