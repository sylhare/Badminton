import React from 'react';
import { Pause, Trash } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();

  return (
    <Modal
      isOpen={isOpen}
      title={t('modals.playerRemoval.title')}
      onClose={onCancel}
      testId="player-removal-modal"
      closeButtonTestId="player-removal-modal-close"
    >
      <div className="modal-body">
        <p>
          {t('modals.playerRemoval.message', { name: playerName })}
        </p>
      </div>

      <div className="modal-footer player-removal-actions">
        <button
          className="button button-absent"
          onClick={onMarkAbsent}
          data-testid="player-removal-modal-absent"
        >
          <Pause size={14} weight="bold" />
          {t('modals.playerRemoval.markAbsent')}
        </button>
        <button
          className="button button-danger"
          onClick={onRemove}
          data-testid="player-removal-modal-remove"
        >
          <Trash size={14} />
          {t('modals.playerRemoval.removePlayer')}
        </button>
      </div>
    </Modal>
  );
};

export default PlayerRemovalModal;
