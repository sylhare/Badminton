import React from 'react';
import { Pause, Trash } from '@phosphor-icons/react';

import Modal from './Modal';

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
  return (
    <Modal
      isOpen={isOpen}
      title="Remove Player"
      onClose={onCancel}
      testId="player-removal-modal"
      closeButtonTestId="player-removal-modal-close"
    >
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
    </Modal>
  );
};

export default PlayerRemovalModal;
