import React from 'react';
import { Pause, Trash, X } from '@phosphor-icons/react';

interface PlayerRemovalModalProps {
  isOpen: boolean;
  playerName: string;
  onRemove: () => void;
  onMarkAbsent: () => void;
  onCancel: () => void;
}

const PlayerRemovalModal: React.FC<PlayerRemovalModalProps> = ({
  isOpen,
  playerName,
  onRemove,
  onMarkAbsent,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel} data-testid="player-removal-modal">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Remove Player</h3>
          <button
            className="modal-close"
            onClick={onCancel}
            data-testid="player-removal-modal-close"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <p>
            What would you like to do with <strong>{playerName}</strong>?
          </p>
        </div>

        <div className="modal-footer player-removal-actions">
          <button
            className="button button-absent"
            onClick={onMarkAbsent}
            data-testid="player-removal-modal-absent"
          >
            <Pause size={14} weight="bold" />
            Mark as Absent
          </button>
          <button
            className="button button-danger"
            onClick={onRemove}
            data-testid="player-removal-modal-remove"
          >
            <Trash size={14} />
            Remove Player
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlayerRemovalModal;
